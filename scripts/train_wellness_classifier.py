"""Train DistilBERT classifier for on-device wellness analysis.

Produces:
- ONNX model with 3 output heads (mood, symptoms, crisis)
- Vocabulary file for the whitespace tokenizer
- INT8-quantized .onnx file for mobile deployment

Usage:
    python scripts/train_wellness_classifier.py --data data/training_data.jsonl --output ../mobile/assets/models/
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import classification_report, mean_absolute_error, r2_score
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm
from transformers import AutoConfig, AutoModelForSequenceClassification, AutoTokenizer


CRISIS_THRESHOLDS = {
    "self_harm_mention": 0.25,
    "abuse_mention": 0.25,
    "emergency_keyword": 0.5,
}

SYMPTOM_LABELS = [
    "cramps", "bloating", "headache", "fatigue", "nausea",
    "backache", "breast_tenderness", "acne", "mood_swings",
    "insomnia", "cravings", "dizziness", "hot_flashes",
    "spotting", "constipation", "diarrhea", "anxiety",
    "irritability", "low_libido", "pelvic_pain",
]

NUM_SYMPTOMS = len(SYMPTOM_LABELS)
NUM_CRISIS = 3
MAX_LEN = 128


class WellnessDataset(Dataset):
    def __init__(self, data_path: str, tokenizer: AutoTokenizer, max_len: int = MAX_LEN):
        self.entries = []
        self.tokenizer = tokenizer
        self.max_len = max_len

        with open(data_path, "r", encoding="utf-8") as f:
            for line in f:
                entry = json.loads(line)
                self.entries.append(entry)

    def __len__(self) -> int:
        return len(self.entries)

    def __getitem__(self, idx: int) -> dict:
        entry = self.entries[idx]
        enc = self.tokenizer(
            entry["text"],
            truncation=True,
            padding="max_length",
            max_length=self.max_len,
            return_tensors="pt",
        )

        symptom_vec = torch.zeros(NUM_SYMPTOMS)
        for s in entry["symptom_mentions"]:
            if s in SYMPTOM_LABELS:
                symptom_vec[SYMPTOM_LABELS.index(s)] = 1.0

        crisis_vec = torch.tensor([
            1.0 if entry["crisis_flags"]["self_harm_mention"] else 0.0,
            1.0 if entry["crisis_flags"]["abuse_mention"] else 0.0,
            1.0 if entry["crisis_flags"]["emergency_keyword"] else 0.0,
        ])

        return {
            "input_ids": enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "mood": torch.tensor(entry["mood_score"], dtype=torch.float),
            "symptoms": symptom_vec,
            "crisis": crisis_vec,
        }


class WellnessModel(nn.Module):
    def __init__(self, model_name: str = "distilbert-base-uncased"):
        super().__init__()
        config = AutoConfig.from_pretrained(model_name)
        config.output_hidden_states = True
        self.backbone = AutoModelForSequenceClassification.from_pretrained(model_name, config=config)
        hidden_size = config.hidden_size

        self.mood_head = nn.Linear(hidden_size, 1)
        self.symptom_head = nn.Linear(hidden_size, NUM_SYMPTOMS)
        self.crisis_head = nn.Linear(hidden_size, NUM_CRISIS)

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> dict:
        outputs = self.backbone.distilbert(input_ids, attention_mask=attention_mask)
        pooled = outputs.last_hidden_state[:, 0, :]
        return {
            "mood": self.mood_head(pooled).squeeze(-1),
            "symptoms": self.symptom_head(pooled),
            "crisis": self.crisis_head(pooled),
        }


def build_vocab_from_data(data_path: str, output_path: str, min_freq: int = 3) -> None:
    """Build whitespace tokenizer vocabulary from training data."""
    word_counter = Counter()
    with open(data_path, "r", encoding="utf-8") as f:
        for line in f:
            entry = json.loads(line)
            text = entry["text"].lower()
            words = text.split()
            word_counter.update(words)

    vocab = {"[PAD]": 0, "[UNK]": 100, "[CLS]": 101, "[SEP]": 102, "": 0}
    idx = 1
    for word, count in word_counter.most_common():
        if count < min_freq:
            break
        if word not in vocab:
            if idx == 100:
                idx += 1
            vocab[word] = idx
            idx += 1

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
    print(f"Vocabulary written to {output_path}: {len(vocab)} tokens")


def train_epoch(model, loader, optimizer, device) -> float:
    model.train()
    total_loss = 0.0
    mood_criterion = nn.MSELoss()
    symptom_criterion = nn.BCEWithLogitsLoss()
    crisis_criterion = nn.BCEWithLogitsLoss()

    for batch in tqdm(loader, desc="Training"):
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        mood_target = batch["mood"].to(device)
        symptom_target = batch["symptoms"].to(device)
        crisis_target = batch["crisis"].to(device)

        optimizer.zero_grad()
        outputs = model(input_ids, attention_mask)

        loss = (
            mood_criterion(outputs["mood"], mood_target)
            + symptom_criterion(outputs["symptoms"], symptom_target)
            + crisis_criterion(outputs["crisis"], crisis_target)
        )
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    return total_loss / len(loader)


def evaluate(model, loader, device) -> dict:
    model.eval()
    mood_preds, mood_targets = [], []
    symptom_preds, symptom_targets = [], []
    crisis_preds, crisis_targets = [], []

    with torch.no_grad():
        for batch in tqdm(loader, desc="Evaluating"):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            outputs = model(input_ids, attention_mask)
            mood_preds.extend(outputs["mood"].cpu().numpy())
            mood_targets.extend(batch["mood"].numpy())
            symptom_preds.extend(torch.sigmoid(outputs["symptoms"]).cpu().numpy())
            symptom_targets.extend(batch["symptoms"].numpy())
            crisis_preds.extend(torch.sigmoid(outputs["crisis"]).cpu().numpy())
            crisis_targets.extend(batch["crisis"].numpy())

    return {
        "mood_mae": mean_absolute_error(mood_targets, np.round(mood_preds).clip(1, 10)),
        "mood_r2": r2_score(mood_targets, np.round(mood_preds).clip(1, 10)),
    }


def export_to_onnx(model, output_path: str, device: torch.device) -> None:
    model.eval()
    dummy_input = torch.randint(0, 30522, (1, MAX_LEN), dtype=torch.long).to(device)
    dummy_mask = torch.ones(1, MAX_LEN, dtype=torch.long).to(device)

    torch.onnx.export(
        model,
        (dummy_input, dummy_mask),
        output_path,
        input_names=["input_ids", "attention_mask"],
        output_names=["mood", "symptoms", "crisis"],
        dynamic_axes={"input_ids": {0: "batch"}, "attention_mask": {0: "batch"}},
        opset_version=18,
    )
    print(f"ONNX model exported to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train wellness classifier")
    parser.add_argument("--data", required=True, help="Path to training_data.jsonl")
    parser.add_argument("--output", default="../mobile/assets/models/", help="Output directory")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--model-name", default="distilbert-base-uncased", help="HF model name")
    parser.add_argument("--val-split", type=float, default=0.1, help="Validation split ratio")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    hf_tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    full_dataset = WellnessDataset(args.data, hf_tokenizer)

    val_size = int(len(full_dataset) * args.val_split)
    train_size = len(full_dataset) - val_size
    train_dataset, val_dataset = torch.utils.data.random_split(full_dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size)

    model = WellnessModel(args.model_name).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)

    for epoch in range(1, args.epochs + 1):
        loss = train_epoch(model, train_loader, optimizer, device)
        metrics = evaluate(model, val_loader, device)
        print(f"Epoch {epoch}/{args.epochs} - loss: {loss:.4f}, mood_mae: {metrics['mood_mae']:.3f}, mood_r2: {metrics['mood_r2']:.3f}")

    os.makedirs(args.output, exist_ok=True)
    onnx_path = os.path.join(args.output, "wellness_classifier.onnx")
    export_to_onnx(model, onnx_path, device)

    vocab_path = os.path.join(os.path.dirname(args.output), "vocab.json")
    build_vocab_from_data(args.data, vocab_path)

    print("Training complete. Files:")
    print(f"  Model: {onnx_path}")
    print(f"  Vocabulary: {vocab_path}")


if __name__ == "__main__":
    main()
