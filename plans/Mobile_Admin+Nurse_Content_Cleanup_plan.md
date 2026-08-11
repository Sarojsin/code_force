# Mobile Admin + Nurse Content Cleanup Plan

## Goal

Remove all admin management functionality from the mobile app (screens, API, navigation).
Keep the user-facing Health Library so users can view content uploaded via web-admin.

**Date:** 2026-08-11
**Status:** Pending approval

---

## 1. Files to DELETE (6 files)

| # | File Path | Reason |
|---|-----------|--------|
| 1 | `mobile/src/screens/admin/AdminDashboardScreen.tsx` | Admin dashboard → web only |
| 2 | `mobile/src/screens/admin/UserManagementScreen.tsx` | User management → web only |
| 3 | `mobile/src/screens/admin/AdminContentManagementScreen.tsx` | Content CRUD → web only |
| 4 | `mobile/src/services/api/admin.ts` | Admin API calls → unused in mobile |
| 5 | `mobile/src/services/queries/admin.ts` | Admin query hooks → unused in mobile |
| 6 | `mobile/src/screens/admin/` (directory) | Empty after screen deletions |

---

## 2. Files to EDIT (6 files)

### 2.1 `mobile/src/screens/profile/ProfileHomeScreen.tsx`

**Remove:**
- `ADMIN_MENU_ITEMS` array (lines 28-32)
- Conditional admin menu block (lines 121-144):
  ```tsx
  {user?.role === 'admin' ? (
    <>
      <Txt variant="caption" ...>Admin</Txt>
      {ADMIN_MENU_ITEMS.map(...)}
    </>
  ) : null}
  ```

**Keep:**
- All `MENU_ITEMS` (Daily Log, Edit Profile, Health Info, Settings, Linked Family, Change Password, Companion Setup)
- Profile hero, logout, styles

---

### 2.2 `mobile/src/navigation/types.ts`

**Remove from `ProfileStackParamList` (lines 63-65):**
```typescript
AdminDashboard: undefined;
UserManagement: undefined;
AdminContentManagement: undefined;
```

**Keep:**
- `ProfileHome`, `DailyLog`, `EditProfile`, `EditHealth`, `ChangePassword`, `Settings`, `LinkedFamily`, `CompanionInstall`, `DiaryAssetInstall`

---

### 2.3 `mobile/src/navigation/FeatureStacks.tsx`

**Remove imports (lines 25-27):**
```typescript
import { AdminDashboardScreen } from 'src/screens/admin/AdminDashboardScreen';
import { UserManagementScreen } from 'src/screens/admin/UserManagementScreen';
import { AdminContentManagementScreen } from 'src/screens/admin/AdminContentManagementScreen';
```

**Remove from `ProfileStack` navigator (lines 144-146):**
```typescript
<ProfileNav.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Dashboard' }} />
<ProfileNav.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'User Management' }} />
<ProfileNav.Screen name="AdminContentManagement" component={AdminContentManagementScreen} options={{ title: 'Content Management' }} />
```

**Keep:**
- All other screen registrations in `ProfileStack`, `WellnessStack`, `CycleStack`, `PregnancyStack`, `SafetyStack`
- `VideoLibraryScreen` in `WellnessStack` (user-facing Health Library)

---

### 2.4 `mobile/src/services/api/index.ts`

**Remove (line 10):**
```typescript
export * from './admin';
```

**Keep:**
- `export * from './nurse_content'` (public endpoints used by Health Library)

---

### 2.5 `mobile/src/services/queries/index.ts`

**Remove (line 9):**
```typescript
export * from './admin';
```

**Keep:**
- `export * from './nurse_content'` (hooks used by Health Library)

---

### 2.6 `mobile/src/services/api/nurse_content.ts`

**Remove admin methods from `nurseContentService` object (lines 110-136):**
- `getUploadUrl(resourceType)` — `POST /admin/contents/upload-url`
- `createContent(data)` — `POST /admin/contents`
- `getAllContents(params)` — `GET /admin/contents`
- `updateContent(id, data)` — `PUT /admin/contents/:id`
- `deleteContent(id)` — `DELETE /admin/contents/:id`

**Remove unused type exports:**
- `ContentCreate`
- `ContentUpdate`
- `UploadUrlResponse`

**Keep:**
- Types: `ContentType`, `ContentImage`, `NurseContent`
- Public methods: `getContents(params)` — `GET /contents`, `getContentDetail(id)` — `GET /contents/:id`

---

## 3. Files to KEEP UNCHANGED

| # | File Path | Reason |
|---|-----------|--------|
| 1 | `mobile/src/screens/wellness/VideoLibraryScreen.tsx` | User-facing Health Library — displays approved content to users |
| 2 | `mobile/src/services/queries/nurse_content.ts` | `useContents`, `useContentDetail` hooks — used by Health Library |
| 3 | `mobile/src/db/schema.ts` | `nurse_contents` table — local cache for offline support |
| 4 | `mobile/src/types/auth.ts` | `UserRole` includes `'nurse'` — needed for auth model |
| 5 | `mobile/src/services/sessionReset.ts` | Clears `nurse_contents` table on logout — data hygiene |
| 6 | `mobile/src/screens/home/VideoLibraryScreen.tsx` | Mock-data video screen — no API calls, independent |
| 7 | `mobile/src/navigation/HomeStack.tsx` | Registers home VideoLibraryScreen — independent |

---

## 4. What Stays on Mobile vs Web-Admin

| Function | Mobile | Web-Admin |
|----------|--------|-----------|
| View Health Library | ✅ `VideoLibraryScreen` | — |
| Create/edit/delete content | ❌ removed | ✅ Content Library page |
| User management | ❌ removed | ✅ Users page |
| Dashboard analytics | ❌ removed | ✅ Overview page |
| Broadcast messages | ❌ removed | ✅ Broadcast page |
| Nurse verification | ❌ removed | ✅ Users page |

---

## 5. Verification Checklist

- [ ] `cd mobile && npx tsc --noEmit` — 0 errors
- [ ] `cd backend && python -m pytest tests/` — unchanged, should pass
- [ ] `cd backend && python -m ruff check app/` — unchanged, should pass
- [ ] Manual: Health Library screen still loads content
- [ ] Manual: Profile screen no longer shows Admin menu
- [ ] Manual: No admin screens reachable via deep links
