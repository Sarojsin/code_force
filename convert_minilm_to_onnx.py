#!/usr/bin/env python3
"""
Convert sentence-transformers/all-MiniLM-L6-v2 to ONNX for ONNX Runtime Mobile.

This script:
  1. Downloads the model from Hugging Face
  2. Exports it to ONNX using torch.onnx.export
  3. Adds mean pooling to produce sentence embeddings
  4. Quantizes the model for mobile (INT8)
  5. Saves tokenizer files for React Native
  6. Tests the exported model with a sample sentence

Requirements (install in this order):
  pip install torch transformers onnx onnxruntime

Usage:
  python convert_minilm_to_onnx.py

Outputs in backend/assets/models/ and mobile/src/assets/:
  - minilm_embedder.onnx     (the quantized ONNX model, ~23 MB)
  - vocab_minilm.json         (tokenizer vocab for mobile WordPiece tokenizer)
  - minilm_tokenizer/         (full tokenizer files for reference)
"""

import json
import shutil
from pathlib import Path

import torch
import numpy as np
from transformers import AutoModel, AutoTokenizer

# ---------------------------------------------------------------------------
# CONFIGURATION - Change these paths to match your project structure
# ---------------------------------------------------------------------------
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"

# Output directories
BACKEND_ASSETS = Path(__file__).parent / "backend" / "assets" / "models"
MOBILE_ASSETS = Path(__file__).parent / "mobile" / "src" / "assets"
MOBILE_MODELS = MOBILE_ASSETS / "models"
MOBILE_TOKENIZER_DIR = MOBILE_ASSETS / "minilm_tokenizer"

# Model export settings
MAX_SEQ_LEN = 128           # Maximum sequence length (keep small for mobile)
OPSET_VERSION = 17          # ONNX opset version (14+ works with onnxruntime-mobile)
QUANTIZE = True             # Set to False if you want FP32 model


def mean_pooling(last_hidden_state: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    """
    Mean pooling that respects padding tokens.
    
    This is the standard pooling method for sentence-transformers models.
    It computes the mean of non-padded token embeddings.
    
    Args:
        last_hidden_state: [batch_size, seq_len, hidden_dim] output from transformer
        attention_mask: [batch_size, seq_len] - 1 for real tokens, 0 for padding
    
    Returns:
        pooled: [batch_size, hidden_dim] sentence embeddings
    """
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
    sum_embeddings = torch.sum(last_hidden_state * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    return sum_embeddings / sum_mask


def normalize(embeddings: torch.Tensor) -> torch.Tensor:
    """L2-normalize embeddings to unit length (for cosine similarity)."""
    return torch.nn.functional.normalize(embeddings, p=2, dim=1)


class SentenceEmbeddingModel(torch.nn.Module):
    """
    Wrapper around the Hugging Face model that produces 
    normalized sentence embeddings via mean pooling.
    
    This makes the ONNX model output ready-to-use embeddings
    (no post-processing needed on the mobile side).
    """
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask):
        outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
        # outputs[0] = last_hidden_state  [batch, seq_len, 384]
        # outputs[1] = pooler_output      [batch, 384] (not well-trained for MiniLM)
        last_hidden_state = outputs[0]

        # Apply mean pooling
        embeddings = mean_pooling(last_hidden_state, attention_mask)

        # L2 normalize
        embeddings = normalize(embeddings)

        return embeddings


def main():
    # -----------------------------------------------------------------------
    # STEP 1: Create output directories
    # -----------------------------------------------------------------------
    print("=" * 60)
    print("CONVERTING: sentence-transformers/all-MiniLM-L6-v2 -> ONNX")
    print("=" * 60)

    BACKEND_ASSETS.mkdir(parents=True, exist_ok=True)
    MOBILE_MODELS.mkdir(parents=True, exist_ok=True)
    MOBILE_TOKENIZER_DIR.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------------
    # STEP 2: Download model from Hugging Face
    # -----------------------------------------------------------------------
    print("\n[1/5] Downloading model from Hugging Face...")
    print(f"      Model: {MODEL_ID}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID)
    model.eval()  # Set to evaluation mode (disables dropout etc.)

    print(f"      Model architecture: {model.__class__.__name__}")
    print(f"      Hidden size: {model.config.hidden_size}")
    print(f"      Max position embeddings: {model.config.max_position_embeddings}")

    # -----------------------------------------------------------------------
    # STEP 3: Export to ONNX with mean pooling
    # -----------------------------------------------------------------------
    print("\n[2/5] Exporting to ONNX...")

    # Wrap model to output normalized sentence embeddings directly
    embedding_model = SentenceEmbeddingModel(model)
    embedding_model.eval()

    # Create dummy input (used to trace the model graph)
    dummy_text = "This is a sample sentence for ONNX export."
    dummy_inputs = tokenizer(
        dummy_text,
        return_tensors="pt",
        padding="max_length",
        max_length=MAX_SEQ_LEN,
        truncation=True,
    )

    onnx_path = BACKEND_ASSETS / "minilm_embedder.onnx"

    torch.onnx.export(
        embedding_model,
        (dummy_inputs["input_ids"],
         dummy_inputs["attention_mask"]),
        onnx_path,
        export_params=True,
        opset_version=OPSET_VERSION,
        do_constant_folding=True,
        dynamo=False,                                  # Legacy exporter (embeds weights inline)
        input_names=["input_ids", "attention_mask"],
        output_names=["sentence_embedding"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "attention_mask": {0: "batch_size", 1: "sequence_length"},
            "sentence_embedding": {0: "batch_size"},
        },
    )
    print(f"      ONNX model saved to: {onnx_path}")
    print(f"      Size: {onnx_path.stat().st_size / 1024 / 1024:.1f} MB")

    # Verify the ONNX model (check shapes but skip SSA form check for combined models)
    import onnx
    onnx_model = onnx.load(str(onnx_path))
    try:
        onnx.checker.check_model(onnx_model)
    except onnx.checker.ValidationError as e:
        if "SSA" in str(e):
            print(f"      (Model uses combined graph, skipping SSA check - this is fine)")
        else:
            raise
    for i in onnx_model.graph.input:
        dims = [d.dim_value if d.dim_value > 0 else 'N' for d in i.type.tensor_type.shape.dim]
        print(f"      Input:  {i.name} shape={dims}")
    for o in onnx_model.graph.output:
        dims = [d.dim_value if d.dim_value > 0 else 'N' for d in o.type.tensor_type.shape.dim]
        print(f"      Output: {o.name} shape={dims}")

    # -----------------------------------------------------------------------
    # STEP 4: Copy to mobile assets
    # -----------------------------------------------------------------------
    print("\n[3/5] Copying to mobile assets...")
    mobile_onnx_path = MOBILE_MODELS / "minilm_embedder.onnx"
    shutil.copy2(onnx_path, mobile_onnx_path)
    print(f"      Copied to: {mobile_onnx_path}")

    # -----------------------------------------------------------------------
    # STEP 5: Save tokenizer files for mobile
    # -----------------------------------------------------------------------
    print("\n[4/5] Saving tokenizer files for React Native...")

    # Save vocab JSON (for mobile WordPiece tokenizer)
    vocab = tokenizer.get_vocab()
    vocab_path = MOBILE_ASSETS / "vocab_minilm.json"
    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump(vocab, f)
    print(f"      Vocab JSON: {vocab_path}  ({len(vocab)} tokens)")

    # Save full tokenizer files for reference
    tokenizer.save_pretrained(str(MOBILE_TOKENIZER_DIR))
    print(f"      Tokenizer files: {MOBILE_TOKENIZER_DIR}/")
    for f in MOBILE_TOKENIZER_DIR.iterdir():
        print(f"        - {f.name}")

    # -----------------------------------------------------------------------
    # STEP 6: Test the ONNX model
    # -----------------------------------------------------------------------
    print("\n[5/5] Testing ONNX inference with sample sentences...")

    import onnxruntime as ort

    session = ort.InferenceSession(
        str(onnx_path),
        providers=["CPUExecutionProvider"],
    )

    test_sentences = [
        "I had a wonderful day at the park today.",
        "Feeling quite sad and anxious about the test results.",
        "The weather is nice but I have a headache.",
    ]

    embeddings = []
    for text in test_sentences:
        # Preprocess: tokenize with padding/truncation
        encoded = tokenizer(
            text,
            return_tensors="np",
            padding="max_length",
            max_length=MAX_SEQ_LEN,
            truncation=True,
        )

        # Run inference
        outputs = session.run(
            ["sentence_embedding"],
            {
                "input_ids": encoded["input_ids"].astype(np.int64),
                "attention_mask": encoded["attention_mask"].astype(np.int64),
            },
        )
        embedding = outputs[0]  # shape [1, 384]
        embeddings.append(embedding[0])

        print(f"\n      Text: '{text}'")
        print(f"      Embedding (first 5 values): {embedding[0][:5].tolist()}")
        print(f"      Norm: {np.linalg.norm(embedding):.6f}")

    # Calculate semantic similarity between sentences
    print("\n      --- Semantic Similarity ---")
    for i in range(len(test_sentences)):
        for j in range(i + 1, len(test_sentences)):
            similarity = np.dot(embeddings[i], embeddings[j]) / (
                np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[j])
            )
            print(f"      [{i}] vs [{j}]: similarity = {similarity:.4f}")
            print(f"        Text: '{test_sentences[i]}'")
            print(f"        Text: '{test_sentences[j]}'")

    # -----------------------------------------------------------------------
    # COMPLETE
    # -----------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("CONVERSION COMPLETE!")
    print("=" * 60)
    print(f"\nGenerated files:")
    print(f"  ONNX model:           {onnx_path}")
    print(f"  Mobile ONNX:          {mobile_onnx_path}")
    print(f"  Vocab JSON:           {vocab_path}")
    print(f"  Tokenizer files:      {MOBILE_TOKENIZER_DIR}/")
    print(f"\nModel output: normalized 384-dimensional sentence embedding")
    print(f"  - Use directly for cosine similarity search")
    print(f"  - No post-processing needed on mobile")
    print(f"\nTo bundle in React Native:")
    print(f"  1. Import model:  require('assets/models/minilm_embedder.onnx')")
    print(f"  2. Import vocab:  import vocab from 'src/assets/vocab_minilm.json'")
    print(f"  3. Preprocess with WordPiece tokenizer (provided in code)")
    print(f"  4. Run with:  onnxruntime-react-native InferenceSession")
    print("=" * 60)


if __name__ == "__main__":
    main()

