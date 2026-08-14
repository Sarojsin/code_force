# Video Recommendation System — Detailed Workflow

> How the **Smart Health Library** ("For You") video recommendation feature works end-to-end in SheCare.
> Authoritative design doc: `plans/DayDetailSheet_VideoLibraryScreen_recommendation_plan.md`.

---

## 1. Architecture in one paragraph

Video recommendation is a **client-side-only** feature. The FastAPI backend
(`nurse_content` module) is purely a **content CRUD / approval / delivery**
system — it has **zero recommendation logic**. All "recommendation intelligence"
lives in a **single pure TypeScript scoring engine**:

- `mobile/src/utils/videoRecommendations.ts` — the scoring/ranking engine
- `mobile/src/hooks/useVideoRecommendations.ts` — the React hook that wires
  symptoms + content into the engine

There is **no `/recommend` or `/feed` endpoint** on the backend. The mobile app
fetches the flat list of approved content, reads the user's recent symptoms from
**local SQLite**, scores everything **on device**, and renders the ranked tiers.

```
┌──────────────┐   approve    ┌──────────────────┐    GET /api/v1/contents    ┌──────────────────┐
│  web-admin   │─────────────▶│  Backend (FastAPI)│◀──────────────────────────│  React Native app │
│ (nurse/admin)│  upload to   │  nurse_content    │                            │  (health library) │
│  Cloudinary  │              │  (CRUD only)      │                            │                   │
└──────────────┘              └──────────────────┘                            │   local SQLite    │
                                                                               │  cycle_days (7d)  │
                                                                               └──────────────────┘
                                                                                        │
                                                                                        ▼
                                                              videoRecommendations.ts ◀┘  (client-side scroing)
```

---

## 2. System components

### Backend (`/backend`) — content delivery only

| File | Role |
|------|------|
| `app/modules/nurse_content/models.py` | `EducationalContent` + `NurseProfile` SQLAlchemy models |
| `app/modules/nurse_content/services.py` | `NurseContentService`: CRUD + draft→pending→approved→unpublished state machine |
| `app/modules/nurse_content/routes.py` | HTTP endpoints (nurse CRUD + public `GET /contents`) |
| `app/modules/nurse_content/schemas.py` | Pydantic `ContentCreate` / `ContentUpdate` / `ContentResponse` |
| `app/modules/admin/routes.py` + `services.py` | Admin approve/reject/publish/unpublish + Cloudinary signed upload |
| `app/integrations/cloudinary_client.py` | `signed_upload_payload()` — server-side signature, secret never leaves backend |
| `alembic/versions/0002_domain_tables.py` | Creates `educational_contents` table |

### Mobile (`/mobile`) — where the recommendation actually happens

| File | Role |
|------|------|
| `src/utils/videoRecommendations.ts` | **The scoring/ranking engine** (pure, framework-free, unit-testable) |
| `src/hooks/useVideoRecommendations.ts` | Combines symptoms + content, runs the engine, re-runs on `day_logged` |
| `src/hooks/useVideoLibrarySettings.ts` | Global "Smart recommendations" master switch (AsyncStorage) |
| `src/screens/wellness/VideoLibraryScreen.tsx` | "Smart Health Library" UI with "For You" toggle |
| `src/screens/wellness/ContentDetailScreen.tsx` | Detail/player screen (expo-av `<Video>`) |
| `src/services/api/nurse_content.ts` | API client (`getContents`, `getContentDetail`) |
| `src/services/queries/nurse_content.ts` | React Query hooks `useContents`, `useContentDetail` |
| `src/utils/expertRecommendations.ts` | Shared `ALIAS_MAP` reused by the video engine |
| `src/components/ui/HorizontalCardCarousel.tsx` | Horizontal carousel for the recommended tier |
| `src/screens/profile/SettingsScreen.tsx` | "Smart recommendations" switch (Settings → Content & Personalization) |

### Web Admin (`/web-admin`) — where videos originate

| File | Role |
|------|------|
| `src/pages/ContentLibrary.tsx` | Content creation/editing UI + upload to Cloudinary |
| `src/api/nurseContent.ts` | API client incl. `uploadToCloudinary()` |
| `src/types/api.ts` | `ContentItem`, `ContentPayload`, `UploadUrlResponse` |

---

## 3. Content pipeline (where videos come from)

1. **Creation** — Nurses/admins use `web-admin/src/pages/ContentLibrary.tsx`. They enter
   title, category, description, tags and upload a video/thumbnail.
2. **Upload** — The browser uploads the file **directly to Cloudinary**:
   - `GET upload URL` → backend `POST /api/v1/admin/contents/upload-url`
   - `CloudinaryClient.signed_upload_payload()` signs the request server-side
     (secret never leaves the backend).
   - web-admin posts the file straight to Cloudinary and stores the returned
     `secure_url` as `video_url`.
3. **Storage** — `POST /api/v1/nurse/contents` → `NurseContentService.create_content()`
   (`services.py:64`) → insert into Postgres `educational_contents`
   (`models.py:25`). Status defaults to `draft`.
4. **Approval** — `draft → submit → pending → approve → approved`
   (sets `published_at`, `services.py:150`). Admin endpoints live in
   `admin/routes.py`. **Only `status == "approved"` content is ever served
   publicly** (`get_public_content`, `list_approved`).
5. **Delivery** — Mobile fetches `GET /api/v1/contents` (public, no auth needed),
   optionally filtered by `category` / `content_type`, `limit`/`offset`, ordered
   by `published_at desc` (`services.py:211-226`).

### Backend model — `EducationalContent`

```python
nurse_id          # foreign key to the authoring nurse
title             # max 200 chars
description
video_url         # Cloudinary secure_url
thumbnail_url
category          # wellness | pregnancy | cycle | nutrition | mental_health (indexed)
tags              # JSON array
status            # draft | pending | approved | unpublished (indexed)
approved_by
published_at
is_active         # soft delete
```

`content_type` is **derived**, not stored: `video` if `video_url`, `image` if
`thumbnail_url`, else `article` (Pydantic `model_validator` in `schemas.py`).

### API endpoints involved

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/contents` | Public list of approved content (mobile library) |
| GET | `/api/v1/contents/{content_id}` | Single approved content (mobile detail) |
| POST | `/api/v1/nurse/contents` | Create content (web-admin) |
| PUT | `/api/v1/nurse/contents/{id}` | Update own content |
| POST | `/api/v1/nurse/contents/{id}/submit` | Submit for review |
| GET | `/api/v1/admin/contents/pending` | List pending |
| PUT | `/api/v1/admin/contents/{id}/approve` | / `reject` / `publish` / `unpublish` | Admin moderation |
| POST | `/api/v1/admin/contents/upload-url` | Cloudinary signed upload |

---

## 4. Mobile recommendation flow

### 4.1 Entry points

The Health Library is reachable from:
- Home dashboard "Health Library" card (`HomeDashboardScreen.tsx:362`)
- Wellness stack → `Videos` (`FeatureStacks.tsx:81`, `HomeStack.tsx:49`)

Both navigate to `VideoLibraryScreen` → `ContentDetail` for playback.

### 4.2 Fetch content

`useVideoRecommendations` (`useVideoRecommendations.ts:39`) calls
`useContents({ limit: 100, category })` → React Query →
`nurseContentService.getContents()` → `GET /contents`. The list feeds the whole
screen in `all`.

### 4.3 Master-switch gate

`useVideoLibrarySettings` reads `shecare.smart_recommendations` from AsyncStorage
(default **ON**). When **OFF**:
- the hook **skips symptom reads entirely** (`useVideoRecommendations.ts:51`),
- returns `recommended: []`, `general: all`,
- the "For You" toggle is **hidden** in the UI (`VideoLibraryScreen.tsx:76`).

This is a plain, non-sensitive preference, so plain AsyncStorage is acceptable
(rule §2.13 only requires encrypted storage for tokens/keys).

### 4.4 Read symptoms (offline-first)

When the master switch is ON, the hook reads the **last 7 days of `cycle_days`**
from **local SQLite** (`localDb.cycleDay.getByRange(userId, start, end)` at
`DayLocalService`), collecting unique `symptoms[].name` values.

Live refresh: it subscribes to the `day_logged` event bus event
(`useVideoRecommendations.ts:77`), so logging a symptom immediately triggers a
re-read → new recommendations on next open.

```ts
// pseudocode — useVideoRecommendations.ts
const start = format(subDays(new Date(), 6), 'yyyy-MM-dd');
const end   = format(new Date(), 'yyyy-MM-dd');
const days  = await localDb.cycleDay.getByRange(userId, start, end);
const names = dedupe(days.flatMap(d => d.symptoms.map(s => s.name)));
setSymptomNames(names);
// re-runs every time eventBus emits 'day_logged'
```

Note: symptoms are offline-first (local SQLite), but the content list is
**network-only** — the `nurseContents` table in `mobile/src/db/schema.ts:309`
is never written by any sync engine.

### 4.5 Score client-side

`recommendContents(all, symptomNames)` (`videoRecommendations.ts:106`) splits
content into:
- `recommended` — score > 0, sorted `published_at desc`, capped at 12
- `general` — score 0, sorted `published_at desc`

### 4.6 Render

| State | UI |
|-------|----|
| "For You" ON + has data + matches | `RecommendedSection` carousel ("Based on your recent symptoms") + symptom chips (≤ 4) + "Browse all videos" list of `general` |
| "For You" ON + **no symptoms** | `NoSymptomsBanner` ("No recent symptoms logged.") + full general list (**"No Data, No Issue" rule — never an empty state**) |
| Master switch OFF | Category chips (`all/wellness/pregnancy/cycle/nutrition/mental_health`) + FlatList of all content |
| Error | `EmptyState` with Retry (calls `refetch`) |
| Loading | `SkeletonRows` |

Tapping a card navigates to `ContentDetail` → `ContentDetailScreen.tsx` plays
the video via expo-av `<Video>` with native controls.

---

## 5. The scoring algorithm (`videoRecommendations.ts`)

Deliberately a **simple v1 hit-count model**. No ML, no weights, no embeddings.
Three stages: keyword extraction → hit-count scoring → tiering.

### 5.1 Keyword extraction — `getKeywordsForSymptom` (line 53)

1. **Resolve alias** — `resolveSymptomName(name)` maps legacy names to canonical
   via `ALIAS_MAP` from `expertRecommendations.ts` (e.g. `Cramps → Abdominal
   Cramps`, `Low Energy → Fatigue`).
2. **Curated keywords** — if the canonical name has an entry in `SYMPTOM_KEYWORDS`
   (line 16), use those keywords. 22 entries:

```
'Abdominal Cramps'   → ['cramps', 'abdominal', 'period pain', 'menstrual']
'Lower Back Pain'    → ['back pain', 'lumbar', 'spine']
Headache             → ['headache', 'head pain', 'migraine']
Migraine             → ['migraine', 'headache', 'head pain']
Fatigue / Low Energy → ['fatigue', 'energy', 'tired', 'exhaustion']
Bloating             → ['bloating', 'bloat', 'gas', 'swollen']
Nausea               → ['nausea', 'queasy', 'sick']
'Trouble Sleeping'   → ['sleep', 'insomnia', 'restless']
'Mood Swings'        → ['mood', 'emotional', 'irritability']
'Anxiety / Nervousness' → ['anxiety', 'stress', 'calm', 'nervous']
'Depressed Mood / Sadness' → ['depression', 'sadness', 'mood', 'mental health']
'Brain Fog'          → ['brain fog', 'focus', 'concentration', 'mental clarity']
'Heart Palpitations' → ['heart', 'palpitations', 'anxiety']
'Breast Tenderness'  → ['breast', 'tenderness', 'chest']
'Hot Flashes'        → ['hot flash', 'sweating', 'temperature']
'Heavy / Prolonged Bleeding' → ['heavy bleeding', 'period', 'menstrual', 'blood']
'Painful Ovulation'  → ['ovulation', 'ovary', 'pain']
'Acne / Pimples'     → ['acne', 'pimples', 'skin', 'breakout']
'Hair Thinning / Loss' → ['hair', 'thinning', 'hair loss']
...
```

3. **Fallback word-split** — symptoms without a curated entry are lowercased,
   split on non-alphanumerics, and drop stopwords
   (`and/or/the/a/an/of/in/on/with`). So `Vision Changes` → `['vision', 'changes']`.
   This guarantees **every symptom** produces keywords.

### 5.2 Scoring — `scoreContent` (line 67)

- Builds a lowercase "haystack": `title + description + tags + category`.
- For each keyword: **+1 if the haystack contains the keyword as a substring**.
- **No weighting** — a title hit scores the same as a tag hit; a video scores
  the same as an article. Each keyword counts at most once per content item.

```ts
function scoreContent(content, keywords): number {
  const haystack = [content.title, content.description ?? '',
    (content.tags ?? []).join(' '), content.category ?? '']
    .join(' ').toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 1;
  }
  return score;
}
```

### 5.3 Ranking — `recommendContents` (line 106)

1. Dedupe + trim symptom names.
2. **Empty symptoms → everything goes to `general`, `hasData: false`** (early return).
3. Build per-symptom keyword sets.
4. For each content item, take the **best score across all symptom keyword sets**
   (loop at lines 130–146), tracking which symptom produced it.
5. `score > 0` → `recommended` tier (+ symptom recorded in `matchedSymptoms`);
   `score == 0` → `general`.
6. Both tiers sorted by `published_at desc` (recency breaks ties).
7. `recommended` is **capped at 12** (`MAX_RECOMMENDED`) to keep the carousel tight.

Return type `RecommendResult`:

```ts
{
  recommended: NurseContent[];   // score > 0, newest first, ≤ 12
  general: NurseContent[];       // score 0, newest first
  matchedSymptoms: string[];     // canonical names that produced a match
  hasData: boolean;              // symptoms logged in the 7-day window
}
```

### 5.4 What scores 0 and why

Real-world example: symptom `Bloating` → keywords `['bloating', 'bloat', 'gas', 'swollen']`.
A content item titled "Relaxation techniques for stress" contains none of those
substrings → score 0 → lands in `general` even though it might be clinically useful.
This is the known limitation of pure keyword matching (see §8).

---

## 6. Functional rules and edge cases

| Rule | Behavior |
|------|----------|
| No Data, No Issue (§7.4) | No symptoms logged → info banner + full library, **never empty** |
| Master switch OFF | "For You" hidden, plain category browsing, no symptom reads at all |
| Live update on `day_logged` | Hook re-reads symptoms so new logs surface immediately |
| Recommended cap | `MAX_RECOMMENDED = 12` |
| All content empty | `EmptyState` "Check back soon for new health content." |
| Fetch error | `EmptyState` with Retry (`refetch`) |
| Offline category | `getByRange` read fails → symptoms reset to `[]`, gracefully degrades to general list |

---

## 7. Data sources summary

| Source | Type | Used for |
|--------|------|----------|
| `educational_contents` (Postgres) | Network fetch | The full content list |
| `cycle_days` (local SQLite) | Offline-first | Last-7-days symptom names |
| AsyncStorage `shecare.smart_recommendations` | Local pref | Master switch (default ON) |
| `ALIAS_MAP` (`expertRecommendations.ts`) | Static map | Symptom name normalization |

---

## 8. Known limitations (from the plan)

Both intentionally **deferred / out of scope** for v1:

- **No scoring weighting** — `title > description > tags` weighting and
  `video > article` preference are not implemented.
- **No backend search index** for when the library exceeds ~500 videos — scoring
  is O(contents × symptoms) on device.
- **Keyword, not semantics** — `Bloating` won't match a "gut health" video unless
  the literal words appear. No embeddings, no synonyms beyond `ALIAS_MAP`.
- **Content list is never cached locally** — recommendations require network for
  the content even though symptoms are offline.

## 9. Proposed future roadmap (when scaling)

1. Push scoring to the backend (`POST /api/v1/contents/recommend` sending
   normalized symptom names) once content volume demands it.
2. Add field weighting (`title` hits > `tag` hits) and content-type preference.
3. Add a search index (e.g. Postgres TSVECTOR or a dedicated search service).
4. Personalization signals beyond symptoms: watch history, category affinity,
   saved content.

---

## 10. Tests

- `mobile/src/utils/__tests__/videoRecommendations.test.ts` — unit tests for the
  pure scoring engine (alias resolution, curated keywords, fallback word-split,
  empty-symptom handling, cap at 12, tier split).
- Backend tests: `backend/tests/modules/nurse_content/test_routes.py`,
  `test_services.py` — cover the CRUD/approval pipeline, not ranking.

Run with: `cd mobile && npx jest videoRecommendations`