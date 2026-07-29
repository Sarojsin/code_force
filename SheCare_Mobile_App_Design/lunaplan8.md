# lunaplan8 — Luna Download Pipeline Fix

> **Priority:** High
> **Files:** `backend/app/modules/luna/routes.py`, `backend/app/modules/luna/__init__.py`, `backend/app/main.py`, `mobile/src/services/assetDownloader.ts`

---

## 1. Backend — Register Luna module

### 1.1 Current state

`backend/app/modules/luna/routes.py` has a router and metadata endpoint but no `init_module()` function, so the module is **never loaded** — `main.py:46-60` doesn't include it in `MODULE_INITS`. Router prefix is wrong (includes `/api/v1` but `init_module` will also prepend it).

### 1.2 Changes

| File | What |
|---|---|
| `luna/routes.py` | Fix prefix `"/api/v1/features/luna"` → `"/features/luna"`; add `init_module(app, event_bus)` |
| `luna/__init__.py` | Add module docstring |
| `main.py` | Add `"app.modules.luna.routes:init_module"` to `MODULE_INITS` |

### 1.3 New static-file endpoint

Add `GET /features/luna/assets/{filename}` to serve the zip from a new `assets/` directory within the module:

```
backend/app/modules/luna/assets/luna_assets_v1.1.0.zip
```

This avoids requiring an external CDN for development. Return `FileResponse` with `media_type="application/zip"`.

### 1.4 Updated metadata response

- `download_url` → `http://localhost:8000/api/v1/features/luna/assets/luna_assets_v1.1.0.zip`
- `checksum_sha256` → real SHA256 of the zip (computed after step 3)

---

## 2. Mobile — Fix checksum bug

### 2.1 Current bug

`assetDownloader.ts:89-94`:

```typescript
async function computeChecksum(filePath: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    filePath   // <-- BUG: hashes the PATH STRING, not file contents!
  );
}
```

`digestStringAsync` hashes a **string** — it's hashing the literal path like `"file:///cache/luna_assets_v1.zip"`, not the file's bytes. Every download "passes" verification regardless of corruption.

### 2.2 Fix

Read the file as base64, then hash that string:

```typescript
async function computeChecksum(filePath: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
}
```

Note: The backend must compute the SHA256 of the **base64-encoded zip content** for the checksums to match. Alternatively if the backend uses plain binary sha256sum, use a raw-bytes approach on mobile instead.

---

## 3. Create the asset bundle

### 3.1 Zip structure

```
luna_assets_v1.1.0.zip
├── spritesheet.png          (copy of luna_deepseek/luna1.png, ~1.7 MB)
├── spritesheet.json         (copy from mobile/src/assets/companion/spritesheet.json)
├── dialogues.json           (copy from mobile/src/assets/companion/dialogues.json)
└── sounds/
    ├── meow.mp3             (A_soft,_adorable_kit_#1-1785337761442.mp3)
    ├── purr.mp3             (A_gentle_kitten_purr_#1-1785337839791.mp3)
    ├── yawn.mp3             (Soft_sleeping_kitten_#1-1785338214088.mp3)
    └── celebrate.mp3        (A_magical_success_ch_#3-1785338008588.mp3)
```

### 3.2 Sound mapping

| Target file | Source file |
|---|---|
| `sounds/meow.mp3` | `her_care/sounds/A_soft,_adorable_kit_#1-1785337761442.mp3` |
| `sounds/purr.mp3` | `her_care/sounds/A_gentle_kitten_purr_#1-1785337839791.mp3` |
| `sounds/yawn.mp3` | `her_care/sounds/Soft_sleeping_kitten_#1-1785338214088.mp3` |
| `sounds/celebrate.mp3` | `her_care/sounds/A_magical_success_ch_#3-1785338008588.mp3` |

### 3.3 Build steps

1. Create temp dir with the structure above
2. Copy/copy-rename files into place
3. Zip the `companion/` directory into `luna_assets_v1.1.0.zip`
4. Place zip at `backend/app/modules/luna/assets/luna_assets_v1.1.0.zip`
5. Compute SHA256 of the zip file
6. Copy zip to `mobile/src/assets/companion/luna_assets_v1.1.0.zip` for offline dev

### 3.4 Checksum computation (backend side)

```bash
# Get SHA256 of base64-encoded content (matching mobile fix)
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\luna_assets_v1.1.0.zip"))
$sha256 = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($base64))
$hex = ($sha256 | ForEach-Object ToString x2) -join ''
```

Or, if using raw binary checksums, adjust mobile code accordingly.

---

## 4. Test plan

```bash
# Backend
cd backend
uvicorn app.main:app --reload
curl http://localhost:8000/api/v1/features/luna/metadata
curl -O http://localhost:8000/api/v1/features/luna/assets/luna_assets_v1.1.0.zip

# Mobile
cd mobile
npx tsc --noEmit          # zero new errors

# Visual
# Open app → Profile tab → Companion Setup → tap "Download Luna"
# Verify: progress bar shows, download completes, installed badge appears
```

### 4.1 Assertions

- [ ] `GET /api/v1/features/luna/metadata` returns valid JSON with real checksum & URL
- [ ] `GET /api/v1/features/luna/assets/luna_assets_v1.1.0.zip` returns the zip file
- [ ] Zip downloads and extracts correctly on mobile
- [ ] Checksum verification passes (both sides match)
- [ ] `soundEngine.loadAssets()` loads all 4 sounds without error
- [ ] `dialogueEngine.loadAssets()` loads dialogues
- [ ] Installed badge shows `✅ Installed (v1.1.0)`
- [ ] Uninstall works (removes assets, resets state)
- [ ] `npx tsc --noEmit` — zero new errors
