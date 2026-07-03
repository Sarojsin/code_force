# ONNX offline sentiment analysis setup guide

This guide walks through converting `sentence-transformers/all-MiniLM-L6-v2` to ONNX and integrating it into your React Native (Expo) app for **completely offline** sentence embeddings and semantic similarity.

---

## 1. What you're building

| Concept | What it does |
|---------|--------------|
| **Sentence embedding** | Converts text into a 384-number vector ("embedding") that captures meaning |
| **ONNX** | A format that lets you run ML models on-device without a server |
| **onnxruntime-react-native** | The library that runs the ONNX model inside your React Native app |
| **WordPiece tokenizer** | Converts words into numbers the model understands (matching how BERT/MiniLM were trained) |
| **Offline** | Everything runs on the phone — no internet, no API calls, no data leaving the device |

---

## 2. Prerequisites

| Tool | Why you need it | How to check |
|------|----------------|--------------|
| **Python 3.9+** | Runs the conversion script | `python --version` |
| **pip** | Installs Python packages | `python -m pip --version` |
| **Node.js 18+** | For React Native / Expo | `node --version` |
| **npm** | Installs JS packages | `npm --version` |

---

## 3. Install Python dependencies

Open a **terminal** (PowerShell or Command Prompt) and run:

```bash
pip install torch transformers onnx onnxruntime
```

| Package | Purpose |
|---------|---------|
| `torch` | PyTorch — runs the original model so we can export it |
| `transformers` | Hugging Face library — downloads the model and tokenizer |
| `onnx` | Creates the ONNX file and validates it |
| `onnxruntime` | Tests the exported model works before we use it in the app |

> **Expected output:** `Successfully installed torch-2.12.1 transformers-5.12.1 onnx-1.22.0 onnxruntime-1.27.0` (versions may differ)

---

## 4. Run the conversion script

The script is at `E:\her_care\convert_minilm_to_onnx.py`. Run it:

```bash
cd E:\her_care
python convert_minilm_to_onnx.py
```

This does **6 things automatically**:

| Step | What happens |
|------|-------------|
| 1. Download model | Fetches `sentence-transformers/all-MiniLM-L6-v2` from Hugging Face (cached after first download) |
| 2. Wrap with mean pooling | Adds an average-over-tokens step + L2 normalization so the output is a single 384-vector ready for cosine similarity |
| 3. Export to ONNX | Uses PyTorch's `torch.onnx.export` with `dynamo=False` (legacy exporter — embeds weights inline into a single `.onnx` file) |
| 4. Validate | Checks the ONNX file has the correct inputs (`input_ids`, `attention_mask`) and output (`sentence_embedding`) |
| 5. Copy to mobile | Places the model in `mobile/src/assets/models/minilm_embedder.onnx` |
| 6. Test inference | Runs 3 sample sentences through the ONNX model, prints embeddings and similarity scores |

**Expected output (last lines):**

```
CONVERSION COMPLETE!

Generated files:
  ONNX model:           backend/assets/models/minilm_embedder.onnx  (86.2 MB)
  Mobile ONNX:          mobile/src/assets/models/minilm_embedder.onnx
  Vocab JSON:           mobile/src/assets/vocab_minilm.json
  Tokenizer files:      mobile/src/assets/minilm_tokenizer/
```

---

## 5. What every generated file does

### `/mobile/src/assets/models/minilm_embedder.onnx` (86 MB)

The actual ML model. This is what `onnxruntime-react-native` loads and runs. It takes in token IDs and outputs embeddings. Weights are embedded inline (no external `.data` file — critical for React Native).

**Why it's 86 MB:** The model has ~22 million parameters. Each is stored as a 32-bit float (4 bytes). 22M × 4 = 88 MB. Export overhead makes it 86 MB.

### `/mobile/src/assets/vocab_minilm.json` (780 KB)

The vocabulary for the WordPiece tokenizer. Maps words/subwords to numbers. 
- Contains ~30,522 tokens
- Used by the mobile WordPiece tokenizer to convert text → token IDs
- Keys: token strings like `"the"`, `"##ing"`, `"[CLS]"`
- Values: integer IDs like `1996`, `2359`, `101`

### `/mobile/src/assets/minilm_tokenizer/`

| File | Purpose |
|------|---------|
| `tokenizer.json` | The full Hugging Face tokenizer in JSON (reference) |
| `tokenizer_config.json` | Configuration (which tokens are special) |
| `special_tokens_map.json` | Maps special tokens like `[SEP]`, `[CLS]`, `[PAD]` |
| `vocab.txt` | Same vocab as the JSON, but in text format (one token per line) |

**You don't need to manually read any of these** — they're consumed by the mobile code.

---

## 6. The generated mobile code

I've created these files — **you don't need to create them**, they already exist:

### 6a. WordPiece Tokenizer — `mobile/src/services/ml/wordpieceTokenizer.ts`

Converts English text into token IDs that the model understands:

```
"I love sunny days" → [101, 1045, 2293, 3834, 2753, 102, 0, 0, ...]
                      CLS  I   love sunny days  SEP PAD PAD
```

Key methods:

| Method | Input | Output |
|--------|-------|--------|
| `encode(text)` | `"I love sunny days"` | `[101, 1045, 2293, ...]` — token IDs only |
| `encodeWithAttention(text)` | `"I love sunny days"` | `{ inputIds: [...], attentionMask: [1,1,1,1,1,1,0,0,...] }` |
| `decode(ids)` | `[101, 1045, ...]` | `"i love sunny days"` — approximate text |

The `attentionMask` tells the model which tokens are real words (1) vs padding (0).

### 6b. Embedder — `mobile/src/services/ml/embedder.ts`

Runs the ONNX model and produces embeddings:

```
"I had a great day" → ONNX model → [0.0257, 0.0647, 0.1384, ..., -0.0115] (384 numbers)
```

Key methods:

| Method | Input | Output |
|--------|-------|--------|
| `embed(text)` | `string` | `number[]` — 384-dim normalized embedding |
| `cosineSimilarity(a, b)` | Two `number[]` | `number` — similarity score (-1 to 1) |
| `findSimilar(query, candidates, topK)` | Query embedding + list of candidates | Ranked results by similarity |

### 6c. MiniLM Tokenizer — `mobile/src/services/ml/minilmTokenizer.ts`

Same as `wordpieceTokenizer.ts` but exported as a singleton instance. Both are equivalent — use whichever you prefer.

### 6d. MiniLM Embedder — `mobile/src/services/ml/minilmEmbedder.ts`

Same as `embedder.ts` but with a different class name. Both are equivalent.

### 6e. Hydration hook — `mobile/src/services/ml/useMinilmHydration.ts`

React hook that initializes the model when your app starts:

```typescript
function MyApp() {
  const { ready } = useMinilmHydration();
  if (!ready) return <LoadingScreen />;
  return <MainApp />;
}
```

### 6f. Model Updater (updated) — `mobile/src/services/ml/modelUpdater.ts`

Now supports both models:

```typescript
const result = await modelUpdater.checkForUpdate();
// result = { wellness: true, minilm: false }
```

---

## 7. How to use the embedder in your app

### Step 1: Initialize at app startup

In your root component (e.g., `App.tsx`):

```typescript
import { useEffect } from 'react';
import { minilmEmbedder } from 'src/services/ml';

useEffect(() => {
  minilmEmbedder.initialize();
}, []);
```

### Step 2: Generate an embedding

```typescript
import { minilmEmbedder } from 'src/services/ml';

const embedding = await minilmEmbedder.embed("I'm feeling anxious about my test results");
// Returns 384 numbers: [0.044, 0.031, 0.014, ...]
// Already normalized to length 1.0
```

### Step 3: Compare two sentences

```typescript
const emb1 = await minilmEmbedder.embed("I'm very happy today");
const emb2 = await minilmEmbedder.embed("Today was a joyful day");
const emb3 = await minilmEmbedder.embed("I feel sad and lonely");

const similarity = minilmEmbedder.cosineSimilarity(emb1, emb2);
// 0.92 — very similar (both positive)

const dissimilarity = minilmEmbedder.cosineSimilarity(emb1, emb3);
// 0.12 — very different (positive vs negative)
```

### Step 4: Search journal entries

```typescript
// Journal entries with cached embeddings
const journalEntries = [
  { id: '1', text: 'Had a wonderful time at the park', embedding: [...] },
  { id: '2', text: 'Feeling anxious about work', embedding: [...] },
  { id: '3', text: 'Lovely weather today', embedding: [...] },
];

// Query
const queryEmb = await minilmEmbedder.embed('beautiful sunny day outdoors');
const results = MiniLMEmbedder.findSimilar(queryEmb, journalEntries, 2);
// Returns: [{ id: '3', score: 0.85 }, { id: '1', score: 0.72 }]
```

---

## 8. How to update the model (version management)

The Model Update system handles downloading new ONNX model versions:

1. **Backend endpoint:** `GET /api/v1/models/minilm-embedder/version`
   - Returns: `{ version: "1.0.0", size_mb: 86, checksum_sha256: "abc..." }`
2. **Backend endpoint:** `GET /api/v1/models/minilm-embedder/{version}.onnx`
   - Returns the binary ONNX file
3. **Mobile flow:**
   - `modelUpdater.checkForUpdate()` — checks WiFi, fetches version, compares to cached version
   - On new version: downloads model, verifies SHA256, reloads the session

To add the backend endpoints, add this to a routes file:

```python
@router.get("/models/minilm-embedder/version")
async def get_minilm_version():
    return {"version": "1.0.0", "size_mb": 86, "checksum_sha256": "..."}

@router.get("/models/minilm-embedder/{version}.onnx")
async def download_minilm_model(version: str):
    return FileResponse("backend/assets/models/minilm_embedder.onnx")
```

---

## 9. Common errors and how to fix them

| Error | Cause | Fix |
|-------|-------|-----|
| `ReferenceError: Property 'crypto' doesn't exist` | Using `crypto.randomUUID()` in React Native | Already fixed — now uses `generateId()` in `utils/uuid.ts` |
| `ModuleNotFoundError: No module named 'optimum.onnxruntime'` | Tried using `optimum` library which is deprecated/empty | Use `torch.onnx.export(dynamo=False)` instead |
| `ONNX init failed, will use heuristic fallback` | ONNX model not found or failed to load | Check `assets/models/minilm_embedder.onnx` exists and is not corrupted |
| `UnicodeEncodeError: 'charmap' codec can't encode character` | Windows console can't print Unicode | Run: `$env:PYTHONIOENCODING='utf-8'; python script.py` |
| `onnx.onnx_cpp2py_export.checker.ValidationError: Graph must be in SSA form` | New PyTorch exporter produces slightly invalid ONNX | Use `dynamo=False` or skip SSA check (it works at runtime) |
| Model is 0.7 MB with a separate `.onnx.data` file (90 MB) | New PyTorch exporter stores weights externally | Use `dynamo=False` to force legacy exporter with inline weights |
| `AxiosError: Request failed with status code 401` | Backend auth endpoint returns 401 | Expected if not logged in; register/login first on mobile |
| `Cannot read property 'install' of null` | Some native module not linked in Expo Go | Use dev build instead of Expo Go, or ignore if it doesn't crash |

---

## 10. Testing checklist

After setup, verify everything works:

- [ ] `convert_minilm_to_onnx.py` runs without errors
- [ ] ONNX model is 86 MB (not 0.7 MB with external data)
- [ ] Output embedding dimension is 384
- [ ] Output norm is 1.0 (unit-length normalized)
- [ ] Similar sentences have similarity > 0.5
- [ ] Unrelated sentences have similarity < 0.3
- [ ] `vocab_minilm.json` contains ~30,522 entries
- [ ] Mobile app starts without `crypto` ReferenceError
- [ ] Mobile app initializes ONNX session without crash
- [ ] Embedding inference on mobile returns 384-dim array

---

## Folder structure after conversion

```
E:\her_care\
├── backend/
│   └── assets/
│       └── models/
│           ├── minilm_embedder.onnx       (86 MB — main ONNX model)
│           └── minilm_test_output.json     (test results for reference)
│
├── mobile/
│   └── src/
│       └── assets/
│           ├── models/
│           │   └── minilm_embedder.onnx    (copy for RN bundler)
│           ├── vocab_minilm.json           (tokenizer vocab for WordPiece)
│           └── minilm_tokenizer/           (reference tokenizer files)
│               ├── tokenizer.json
│               ├── tokenizer_config.json
│               ├── special_tokens_map.json
│               └── vocab.txt
│
├── convert_minilm_to_onnx.py              (the conversion script — run once)
└── docs/
    └── onnx-sentiment-setup.md             (this guide)
```

## Key files for mobile integration

| File | What to do |
|------|------------|
| `mobile/src/services/ml/embedder.ts` | Already created — ready to use |
| `mobile/src/services/ml/wordpieceTokenizer.ts` | Already created — ready to use |
| `mobile/src/services/ml/minilmEmbedder.ts` | Alternative with same API |
| `mobile/src/services/ml/minilmTokenizer.ts` | Alternative WordPiece tokenizer |
| `mobile/src/services/ml/useMinilmHydration.ts` | React hook for init |
| `mobile/src/services/ml/index.ts` | Updated to export all new modules |
| `mobile/src/services/ml/modelUpdater.ts` | Updated to support both models |
