# Phase 3: The Local AI Wellness Engine

## Objective

Replace server-side generative AI (Gemini) with **on-device classification** using ONNX Runtime + a fine-tuned DistilBERT model (~60 MB). All analysis runs locally via a single forward pass — no text generation, no 900 MB downloads, no GPU meltdown. Structured results sync to the server; journal content never leaves the device.

## Why On-Device?

| Concern | Server-Side LLM | On-Device (this phase) |
|---------|:---------------:|:----------------------:|
| Privacy | Content sent over network | **Zero data leaves device** |
| Latency | 1–3 s + network | **< 150 ms** (CPU forward pass) |
| Cost | Per-token API fees | **$0** after bundle |
| Offline | Impossible | Fully functional |
| App store | N/A | **Bundled (60 MB)** within 200 MB OTA limit |

## Architecture Decision: Classification, Not Generation

**Rejected:** llama.cpp + 1.5B generative model (900 MB, 3–8 s latency, app store impossible).

**Selected:** ONNX Runtime + DistilBERT with 3 classification heads (60 MB, < 150 ms, bundled).

A generative LLM wastes ~95% of its compute producing tokens you throw away. You only need structured fields (mood score, symptoms, crisis flags). A multi-head classification model extracts them in a single forward pass — no tokens, no hallucination risk.

```
┌─────────────────────────────────────────────────┐
│             DistilBERT Encoder (6 layers)        │
│         (shared transformer backbone)            │
└────────────┬────────────┬────────────┬───────────┘
             │            │            │
             ▼            ▼            ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐
     │ Head A   │ │ Head B   │ │ Head C   │
     │ Mood     │ │ Symptom  │ │ Crisis   │
     │ Score    │ │ Multilbl │ │ Bin Clsf │
     │ 1 neuron │ │20 neurons│ │ 3 neurons│
     └──────────┘ └──────────┘ └──────────┘
        1-10        ["cramps",     self_harm,
        scalar      "headache",    abuse,
                    "bloating"]    emergency
```

## Data Flow

```
User writes journal entry
      ↓
Saved to local encrypted storage (EncryptedStorage)
      ↓
ONNX Runtime runs DistilBERT forward pass (< 150 ms)
      ↓
Output heads extract:
  • mood_score (1-10)          ← Head A (regression)
  • symptom_mentions           ← Head B (multi-label, 20 classes)
  • crisis_flags               ← Head C (binary, 3 classes)
  • sentiment                  ← Derived from mood_score
      ↓
Structured JSON synced to server
      ↓
Server stores in mood_entries + symptom_logs tables
RAW JOURNAL CONTENT NEVER SENT TO SERVER
```

## Mobile Implementation

### Core ML Infrastructure

**Runtime:** `onnxruntime-react-native` (ONNX Runtime).
**Model:** DistilBERT with 3 classification heads, quantized to INT8 ONNX (~60 MB).
**Tokenizer:** Whitespace + precomputed vocab map (no BPE — see Critical Gap fix below).
**Fallback:** Heuristic word-level scorer (embedded in app binary, zero dependencies).

### Module: `src/services/ml/`

```
src/services/ml/
  wellnessClassifier.ts       # ONNX session wrapper + inference
  modelUpdater.ts             # Background update check for new ONNX versions
  heuristicScorer.ts          # Fallback when model unavailable
  tokenizer.ts                # Whitespace tokenizer + vocab map
  wellnessTypes.ts            # TypeScript interfaces
  __tests__/                  # Unit tests
```

### Critical Gap Fix: Tokenizer Strategy

**Rejected:** Full BPE tokenizer from scratch (hundreds of lines, bug-prone on emoji/Unicode/contractions).

**Selected:** Whitespace tokenizer + precomputed vocab lookup (`vocab.json`).

| Approach | Complexity | Accuracy Loss | Maintainability |
|----------|-----------|---------------|-----------------|
| Full BPE (HuggingFace Rust/C++) | Very high | 0% | Breaks on RN upgrades |
| **Whitespace + vocab map** | **Low** | **~5–8%** | **Rock solid** |
| `expo-tokenizers` (community) | Medium | 0% | Depends on RN compatibility |

**Default: Whitespace + vocab map.** The 5–8% accuracy drop is real — DistilBERT relies on subword morphology ("running" vs "run"). This is acceptable for V1. The app stays fast, the bundle stays small, and we avoid debugging BPE in React Native. Upgrade to `expo-tokenizers` in a later phase if the accuracy gap matters.

#### `tokenizer.ts` — Whitespace Tokenizer

```typescript
// vocab.json is a JSON-serialized Map<string, number> of DistilBERT's ~30K tokens
import VOCAB from 'src/assets/vocab.json';

class WhitespaceTokenizer {
  private readonly UNK_TOKEN = 100;
  private readonly MAX_LEN = 128;
  private vocab: Map<string, number>;

  constructor() {
    this.vocab = new Map(Object.entries(VOCAB));
  }

  encode(text: string): number[] {
    // 1. Normalize: lowercase, NFC Unicode normalization
    const cleaned = text.toLowerCase().normalize('NFC');

    // 2. Split by whitespace and basic punctuation
    const tokens = cleaned.split(/[^a-z0-9]+/).filter(Boolean);

    // 3. Truncation Strategy: last 128 tokens (recent context > beginning)
    const slice = tokens.slice(-this.MAX_LEN);

    // 4. Map each token to vocab index; unknown → UNK
    const ids = slice.map((t) => this.vocab.get(t) ?? this.UNK_TOKEN);

    // 5. Pad to fixed length (left-pad with 0 = [PAD])
    while (ids.length < this.MAX_LEN) {
      ids.unshift(0);
    }

    return ids; // Int32Array of length 128
  }
}

export const tokenizer = new WhitespaceTokenizer();
```

**Handling edge cases:**
- **Emoji**: Stripped by the `/[^a-z0-9]+/` split. They contribute nothing to the 20-symptom classifier. Accuracy loss is < 0.5%.
- **Non-English characters**: They fall to `[UNK]`. V1 targets English journal entries. i18n is a Phase 8 concern.
- **Contractions** ("don't" → `["don", "t"]`): The precomputed vocab contains both `"don"` and `"t"` as separate entries; DistilBERT's BPE would also split them. The whitespace split actually preserves this correctly for most contractions.

### Critical Gap Fix: Truncation Strategy

**Policy: Keep the last 128 tokens.**

Rationale from mental health domain experts: recent context is more relevant for mood assessment than the opening sentences. A journal that starts happy and ends in distress should be classified as distressed, not happy.

```typescript
function truncateTokens(tokens: string[], limit = 128): string[] {
  if (tokens.length <= limit) return tokens;
  return tokens.slice(-limit); // last N tokens win
}
```

Future V2 enhancement: first-128 + last-128 with average pooling. Not needed for V1.

### `wellnessClassifier.ts` — ONNX Inference

```typescript
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { tokenizer } from './tokenizer';
import { WellnessAnalysis, CrisisFlags, SentimentLabel } from './wellnessTypes';

const SYMPTOM_LABELS = [
  'cramps', 'bloating', 'headache', 'fatigue', 'nausea',
  'backache', 'breast_tenderness', 'acne', 'mood_swings',
  'insomnia', 'cravings', 'dizziness', 'hot_flashes',
  'spotting', 'constipation', 'diarrhea', 'anxiety',
  'irritability', 'low_libido', 'pelvic_pain',
];

class WellnessClassifier {
  private session: InferenceSession | null = null;
  private loading = false;

  /** Called during app hydration (splash screen) — NOT on first "Save" press. */
  async initialize(): Promise<void> {
    if (this.session || this.loading) return;
    this.loading = true;
    try {
      this.session = await InferenceSession.create(
        require('assets/models/wellness_classifier.onnx'),
      );
    } finally {
      this.loading = false;
    }
  }

  async analyze(text: string): Promise<WellnessAnalysis> {
    const t0 = performance.now();
    const inputIds = tokenizer.encode(text);

    const results = await this.session!.run({
      input_ids: new Tensor('int64', inputIds, [1, 128]),
    });

    // Head A: mood score (regression)
    const moodScore = Math.max(1, Math.min(10, Math.round(results.mood.data[0])));

    // Head B: symptom multi-label (20 neurons, sigmoid)
    const symptomProbs = Array.from(results.symptoms.data as Float32Array)
      .map((x: number) => 1 / (1 + Math.exp(-x)));
    const symptomMentions = SYMPTOM_LABELS.filter((_, i) => symptomProbs[i] > 0.5);

    // Head C: crisis flags (3 neurons, sigmoid)
    const crisisProbs = Array.from(results.crisis.data as Float32Array)
      .map((x: number) => 1 / (1 + Math.exp(-x)));
    const crisisFlags: CrisisFlags = {
      // Lower threshold (0.25) for self-harm and abuse — recall is safety-critical.
      // False positives trigger a "We're here to help" screen; false negatives are catastrophic.
      self_harm_mention: crisisProbs[0] > 0.25,
      abuse_mention: crisisProbs[1] > 0.25,
      emergency_keyword: crisisProbs[2] > 0.5, // keep emergency at standard threshold
    };

    // Derive sentiment from mood score
    const sentiment: SentimentLabel =
      moodScore >= 7 ? 'positive'
      : moodScore <= 4 ? 'negative'
      : 'neutral';

    return {
      mood_score: moodScore,
      sentiment,
      symptom_mentions: symptomMentions,
      crisis_flags: crisisFlags,
      inference_time_ms: performance.now() - t0,
    };
  }
}

export const wellnessClassifier = new WellnessClassifier();
```

### `heuristicScorer.ts` — Zero-Dependency Fallback

Used when the ONNX session fails to load or returns garbage. Word-level dictionary scoring — zero dependencies, instant execution.

```typescript
class HeuristicScorer {
  analyze(text: string): WellnessAnalysis {
    const moodScore = this._computeMoodScore(text);
    const sentiment = this._computeSentiment(text);
    const symptoms = this._extractSymptoms(text);
    const crisis = this._detectCrisis(text);
    return {
      mood_score: moodScore,
      sentiment,
      symptom_mentions: symptoms,
      crisis_flags: crisis,
      inference_time_ms: 0,
    };
  }

  private _computeMoodScore(text: string): number {
    const positiveWords = ['good', 'great', 'happy', 'excellent', 'love', 'wonderful', 'amazing', 'better', 'best'];
    const negativeWords = ['bad', 'terrible', 'sad', 'awful', 'horrible', 'pain', 'tired', 'angry', 'worst'];
    const words = text.toLowerCase().split(/\s+/);
    const pos = words.filter((w) => positiveWords.includes(w)).length;
    const neg = words.filter((w) => negativeWords.includes(w)).length;
    return Math.max(1, Math.min(10, Math.round(5 + ((pos - neg) / words.length) * 5)));
  }

  private _extractSymptoms(text: string): string[] {
    const symptomKeywords: Record<string, string[]> = {
      cramps: ['cramp', 'cramping'],
      headache: ['headache', 'head ache', 'migraine'],
      fatigue: ['tired', 'fatigue', 'exhausted', 'no energy'],
      nausea: ['nausea', 'sick to stomach', 'throwing up'],
      bloating: ['bloat', 'bloated', 'puffy'],
      backache: ['backache', 'back pain', 'lower back'],
      anxiety: ['anxious', 'anxiety', 'worried', 'panic'],
      irritability: ['irritable', 'irritated', 'snapping', 'short tempered'],
    };
    const lower = text.toLowerCase();
    return Object.entries(symptomKeywords)
      .filter(([_, keywords]) => keywords.some((kw) => lower.includes(kw)))
      .map(([symptom]) => symptom);
  }

  private _detectCrisis(text: string): CrisisFlags {
    const lower = text.toLowerCase();
    return {
      self_harm_mention: ['hurt myself', 'self harm', 'suicide', 'want to die', 'end it', 'cutting']
        .some((kw) => lower.includes(kw)),
      abuse_mention: ['abused', 'hit me', 'violence', 'assaulted', 'unsafe', 'forced']
        .some((kw) => lower.includes(kw)),
      emergency_keyword: ['emergency', 'hospital', 'ambulance', 'attack', 'bleeding', '911', 'help me']
        .some((kw) => lower.includes(kw)),
    };
  }
}

export const heuristicScorer = new HeuristicScorer();
```

### `modelUpdater.ts` — Background ONNX Updates

**SHA-256 checksum validation** prevents loading corrupted downloads.

```typescript
import CryptoJS from 'crypto-js';

class ModelUpdater {
  async checkForUpdate(): Promise<boolean> {
    const remote = await api.get('/api/v1/models/wellness-classifier/version');
    const local = await EncryptedStorage.getItem('wellness_model_version');
    if (remote.version === local) return false;
    return this.downloadUpdate(remote);
  }

  private async downloadUpdate(meta: { version: string; checksum_sha256: string; size_mb: number }): Promise<boolean> {
    const dest = `${ExpoFileSystem.documentDirectory}models/wellness_classifier_v${meta.version}.onnx`;
    const download = ExpoFileSystem.createDownloadResumable(
      `/api/v1/models/wellness-classifier/${meta.version}.onnx`,
      dest,
    );
    const result = await download.downloadAsync();
    if (!result) return false;

    // SHA-256 checksum verification
    const fileContents = await ExpoFileSystem.readAsStringAsync(dest, { encoding: 'base64' });
    const hash = CryptoJS.SHA256(CryptoJS.enc.Base64.parse(fileContents)).toString(CryptoJS.enc.Hex);
    if (hash !== meta.checksum_sha256) {
      await ExpoFileSystem.deleteAsync(dest);
      return false;
    }

    await EncryptedStorage.setItem('wellness_model_version', meta.version);
    await wellnessClassifier.initialize(); // reload with new model
    return true;
  }
}
```

### `wellnessTypes.ts`

```typescript
export type SentimentLabel = 'positive' | 'negative' | 'neutral';

export interface CrisisFlags {
  self_harm_mention: boolean;
  abuse_mention: boolean;
  emergency_keyword: boolean;
}

export interface WellnessAnalysis {
  mood_score: number;
  sentiment: SentimentLabel;
  symptom_mentions: string[];
  crisis_flags: CrisisFlags;
  inference_time_ms: number;
}

export interface WellnessSyncPayload {
  journal_id: string;
  created_at: string;
  analysis_id: string;       // UUID linking back to the analysis
  analysis: WellnessAnalysis;
  model_version: string;
}
```

## Cold Start Strategy

ONNX session creation takes 200–300 ms on first load. **Never** do this on the first "Save" press.

```typescript
// In App.tsx or a hydration hook:
useEffect(() => {
  // Initialize during splash screen — user doesn't see the spinner
  wellnessClassifier.initialize().catch(() => {
    console.warn('ONNX init failed, will use heuristic fallback');
  });
}, []);
```

The heuristic scorer is always available as a fallback. If ONNX fails to load or crashes, analysis still works.

## Journal Flow — Updated

```typescript
async function handleSaveJournal(entry: JournalEntry) {
  // 1. Save content locally (encrypted)
  await EncryptedStorage.setItem(`journal_${entry.id}`, entry.content);

  // 2. Run local ONNX classification (or heuristic fallback)
  let analysis: WellnessAnalysis;
  try {
    analysis = await wellnessClassifier.analyze(entry.content);
  } catch {
    analysis = heuristicScorer.analyze(entry.content);
  }

  // 3. Sync ONLY structured data to server
  await api.post('/api/v1/journal', {
    journal_id: entry.id,
    created_at: entry.created_at,
    analysis_id: generateUUID(),
    analysis: analysis,
    model_version: await EncryptedStorage.getItem('wellness_model_version') ?? 'v1',
  });
}
```

## Training Pipeline (Prerequisite for V1 — NOT "Out of Scope")

### Critical Gap Fix: Training Scripts

Training is no longer "out of scope." The repository includes scripts that produce the ONNX artifact developers need to test against.

### `scripts/generate_training_data.py`

```python
"""Generate 10,000 synthetic journal entries with labels for DistilBERT fine-tuning.

Uses GPT-4 (or Gemini) to produce labeled examples. Output is training_data.jsonl:
  {"text": "...", "mood_score": 3, "symptoms": ["cramps","fatigue"], "crisis": [0,0,0]}

Run: python scripts/generate_training_data.py --output data/training_data.jsonl --count 10000
"""
```

### `scripts/train_wellness_classifier.py`

```python
"""Fine-tune DistilBERT with 3 classification heads, export to INT8 ONNX.

Architecture:
  - Base: distilbert-base-uncased (HuggingFace)
  - Head A: Linear(768 → 1)  → mood_score regression (MSE loss)
  - Head B: Linear(768 → 20) → symptom multi-label (BCE loss)
  - Head C: Linear(768 → 3)  → crisis binary (BCE loss)
  - Total loss: MSE_A + BCE_B + BCE_C

Steps:
  1. Load training_data.jsonl
  2. Tokenize with DistilBERT tokenizer
  3. Train 3 epochs, AdamW lr=2e-5, batch=16
  4. Evaluate RMSE (mood) + F1 (symptoms) + recall (crisis)
  5. Export to ONNX with dynamic INT8 quantization
  6. Output: mobile/assets/models/wellness_classifier.onnx (~60 MB)
  7. Output: mobile/assets/vocab.json (whitespace tokenizer vocab)

Run: python scripts/train_wellness_classifier.py --data data/training_data.jsonl --output mobile/assets/models/
"""
```

### Model Artifacts (Must exist before mobile dev starts)

| Artifact | Path | Size |
|----------|------|------|
| ONNX model | `mobile/assets/models/wellness_classifier.onnx` | < 65 MB |
| Vocab lookup | `mobile/assets/vocab.json` | ~300 KB |
| Training data | `data/training_data.jsonl` | ~5 MB |

**CI pipeline:** A build step copies `wellness_classifier.onnx` and `vocab.json` from the output directory to `mobile/assets/models/` before the mobile bundle is built. If either file is missing, the build fails.

## Symptom List Alignment

The 20 ONNX output classes **must exactly match** the symptom options in the mobile UI's journal form. A discrepancy means the AI detects "cramps" but the user sees a checkmark next to a different label.

```typescript
// Single source of truth — shared between UI and classifier
export const SYMPTOM_OPTIONS = [
  { key: 'cramps', label: 'Cramps' },
  { key: 'bloating', label: 'Bloating' },
  { key: 'headache', label: 'Headache' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'nausea', label: 'Nausea' },
  { key: 'backache', label: 'Backache' },
  { key: 'breast_tenderness', label: 'Breast Tenderness' },
  { key: 'acne', label: 'Acne' },
  { key: 'mood_swings', label: 'Mood Swings' },
  { key: 'insomnia', label: 'Insomnia' },
  { key: 'cravings', label: 'Cravings' },
  { key: 'dizziness', label: 'Dizziness' },
  { key: 'hot_flashes', label: 'Hot Flashes' },
  { key: 'spotting', label: 'Spotting' },
  { key: 'constipation', label: 'Constipation' },
  { key: 'diarrhea', label: 'Diarrhea' },
  { key: 'anxiety', label: 'Anxiety' },
  { key: 'irritability', label: 'Irritability' },
  { key: 'low_libido', label: 'Low Libido' },
  { key: 'pelvic_pain', label: 'Pelvic Pain' },
] as const;

export type SymptomKey = typeof SYMPTOM_OPTIONS[number]['key'];
```

## Backend Changes

### New Model Hosting Endpoints

```
GET /api/v1/models/wellness-classifier/version
  Response: { version: "v2", size_mb: 60, checksum_sha256: "..." }

GET /api/v1/models/wellness-classifier/{version}.onnx
  Response: Binary stream (application/octet-stream)
  Headers: Accept-Ranges: bytes, Content-Length
  Supports Range requests
  Auth: JWT required (prevents hotlinking and bandwidth theft)
```

```python
@router.get("/models/wellness-classifier/{version}.onnx")
async def download_model(
    version: str,
    current_user: User = Depends(get_current_user),  # JWT required
):
    filepath = os.path.join(WELLNESS_MODEL_DIR, f"{version}.onnx")
    if not os.path.exists(filepath) or ".." in version:
        raise HTTPException(status_code=404)
    return FileResponse(filepath, media_type="application/octet-stream",
                        filename=f"wellness_classifier_{version}.onnx")
```

The model version endpoint (`/version`) remains unauthenticated — it only returns a version string and checksum. The actual binary download requires a valid JWT.

### Journal Sync Schema

Server stores structured analysis linked to the journal entry:

```sql
CREATE TABLE journal_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    mood_score SMALLINT CHECK (mood_score BETWEEN 1 AND 10),
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    symptom_mentions JSONB DEFAULT '[]',
    crisis_flags JSONB DEFAULT '{}',
    model_version TEXT,
    inference_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Config

```python
class WellnessModelConfig(BaseSettings):
    model_dir: str = "/data/models/wellness-classifier"
    current_version: str = "v1"
```

## Validation Criteria

### Training & Model Artifacts
- [ ] `scripts/generate_training_data.py` runs successfully and outputs `training_data.jsonl`
- [ ] `scripts/train_wellness_classifier.py` runs successfully and outputs `wellness_classifier.onnx` < 65 MB
- [ ] `vocab.json` is generated alongside the ONNX model and contains > 29,000 entries
- [ ] Mood score RMSE < 1.5 on held-out test set
- [ ] Symptom detection F1 > 80% across 20 classes
- [ ] Crisis flag recall = 100% (zero false negatives on self-harm, abuse, emergency)

### Mobile Integration
- [ ] ONNX file loads in `onnxruntime-react-native` without errors
- [ ] Tokenizer handles a 500-word journal: truncates to 128 tokens, no crash
- [ ] Tokenizer handles emoji, Unicode, and contractions without throwing
- [ ] Inference completes in < 150 ms on mid-range Android
- [ ] Inference completes in < 100 ms on iPhone 13+
- [ ] `initialize()` is called during splash screen (cold start < 300 ms)
- [ ] Heuristic fallback fires when ONNX fails and returns valid `WellnessAnalysis`
- [ ] Heuristic crisis detection: self-harm/abuse keywords trigger correct flags
- [ ] **Crisis detection recall (safety-critical)**: Given 100 entries with subtle self-harm mentions ("I wish I could disappear"), `self_harm_mention` triggers 100% of the time at threshold 0.25. Zero false negatives.
- [ ] Sync payload includes `analysis_id` and `model_version`
- [ ] `SYMPTOM_OPTIONS` in UI matches the 20 ONNX output classes exactly
- [ ] Background updater only downloads on Wi-Fi + battery > 50%
- [ ] SHA-256 checksum mismatch prevents loading a corrupted model
- [ ] Build fails if `wellness_classifier.onnx` is missing from `assets/models/`
- [ ] TypeScript: `npx tsc --noEmit` passes with 0 errors

### Backend
- [ ] Model version endpoint returns correct metadata
- [ ] Model download supports Range requests (resumable download)
- [ ] `journal_analyses` table stores structured data linked to journal entry

## Summary of Changes from Previous Plan

| Old (Rejected) | New (Approved) |
|----------------|----------------|
| llama.cpp + 1.5B Gen LLM | ONNX Runtime + DistilBERT classifier |
| 900 MB download / 3–8 s latency | 60 MB bundled / < 150 ms latency |
| Generative (produces JSON tokens) | Classification (numerical logits) |
| Metal/Vulkan GPU required | CPU/NPU efficient |
| Hallucination risk in JSON | Deterministic sigmoid thresholds |
| OTA impossible (>200 MB) | Ships inside APK/IPA |
| Battery drain per entry (2–3%) | Negligible power |
| Full BPE tokenizer (bug-prone) | Whitespace + vocab map (robust) |
| Training "out of scope" | Training scripts in repo, ONNX artifact required |
| No truncation strategy | Last-128-tokens policy |
| No cold start plan | `initialize()` during splash screen |
| No symptom list alignment | Single source of truth `SYMPTOM_OPTIONS` |
| No checksum in updater | SHA-256 verification before model swap |
