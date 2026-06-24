# Phase 4: Safety & Emergency (SOS) Module

## Objective

A multi-channel emergency alert system: API alert (best effort) → push notification to emergency contacts → native SMS fallback. Idempotent on the server side so repeated triggers from a struggling user don't dispatch a cavalry every time.

## SOS Flow

```
User triggers SOS (button, shake, or hardware triple-press — voice is Phase 5)
  ↓
Pre-alert confirmation screen (2-second countdown, Cancel option)
  ↓
Step 1: Save SOS event locally (priority=critical in offline queue)
  ↓
Step 2: Attempt API alert → POST /api/v1/safety/sos (with Idempotency-Key)
  ↓ (server accepts, dedupes by idempotency key)
Server: logs event, sends push to E-contacts (with contact_user_id),
        sends SMS to non-users (no contact_user_id), starts 15-min check-in
  ↓
If API fails (offline):
  Step 3: Native SMS fallback (requires cellular)
  ↓
If all API + SMS fail:
  Show "Call 911 (or local emergency)" button + local alarm
  ↓
On connectivity restore:
  Sync engine processes critical queue items (SOS) before normal items
```

## Backend: New Module `app/modules/safety/`

### `models.py`

```python
class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True)
    contact_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    relationship: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notify_via: Mapped[str] = mapped_column(String(20), default="push")
      # "push" | "sms" | "both"
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False)

class SOSEvent(Base):
    __tablename__ = "sos_events"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
      # "active" | "resolved" | "false_alarm"
    trigger_source: Mapped[str] = mapped_column(String(30), nullable=False)
      # "button" | "shake" | "power_button" | "voice" (Phase 5) | "hardware_key"
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    locally_cached: Mapped[bool] = mapped_column(default=False, nullable=False)
    synced: Mapped[bool] = mapped_column(default=True, nullable=False)
    notified_contacts: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
      # [{contact_id, name, method, sent_at, status}]
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False)
```

### `schemas.py`

| Schema | Fields |
|--------|--------|
| `EmergencyContactCreate` | `name: str`, `phone: str` (E.164), `contact_user_id: uuid?`, `relationship: str?`, `notify_via: str = "push"` |
| `EmergencyContactUpdate` | All optional |
| `EmergencyContactResponse` | All + `id`, `is_active`, `created_at` |
| `SOSCreate` | `idempotency_key: str` (UUID), `trigger_source: str`, `lat: float?`, `lng: float?`, `accuracy: float?` |
| `SOSResolve` | `status: Literal["resolved", "false_alarm"]` |
| `SOSResponse` | All fields + `id`, `status`, `created_at`, `notified_contacts` |
| `SafetyStatusResponse` | `active_sos: SOSResponse?`, `emergency_contacts: list[EmergencyContactResponse]`, `location_permission: bool` |

### `services.py`

```python
class SafetyService:
    def __init__(self, db: AsyncSession, fcm_client: FCMClient | None = None,
                 twilio_client: TwilioClient | None = None) -> None

    async def create_contact(self, user_id: uuid.UUID, data: EmergencyContactCreate) -> EmergencyContact
    async def update_contact(self, user_id: uuid.UUID, contact_id: uuid.UUID,
                             data: EmergencyContactUpdate) -> EmergencyContact
    async def delete_contact(self, user_id: uuid.UUID, contact_id: uuid.UUID) -> None
    async def get_contacts(self, user_id: uuid.UUID) -> list[EmergencyContact]

    async def trigger_sos(self, user_id: uuid.UUID, data: SOSCreate) -> SOSEvent:
        # 1. Check idempotency: SELECT FROM sos_events WHERE idempotency_key = ?
        #    If exists AND status == "active", return existing (no duplicate dispatch)
        # 2. Create SOSEvent with status = "active"
        # 3. Fetch active emergency contacts (max 5 — validated on create)
        # 4. For each contact:
        #    a. If contact has contact_user_id (registered SheCare user):
        #       - Look up UserDevice by contact_user_id
        #       - If fcm_token exists: send FCM push notification
        #    b. If contact has no contact_user_id (non-user) OR notify_via includes "sms":
        #       - Validate phone is E.164 format (+977XXXXXXXXX)
        #       - Send Twilio SMS (rate-limited: 5 SMS per user per hour)
        #    c. Record notification results in notified_contacts JSONB
        # 5. Emit event: event_bus.emit("sos_triggered", user_id=str(user_id))
        # 6. Return SOSEvent

    async def resolve_sos(self, user_id: uuid.UUID, sos_id: uuid.UUID,
                          data: SOSResolve) -> SOSEvent:
        # 1. Fetch SOSEvent (verify ownership)
        # 2. Update status + resolved_at
        # 3. If resolved: emit event

    async def get_safety_status(self, user_id: uuid.UUID) -> SafetyStatusResponse:
        # 1. Check if any active SOS
        # 2. Return contacts
```

### `routes.py`

```
# Safety module
GET    /api/v1/safety/contacts           -> list contacts
POST   /api/v1/safety/contacts           -> create contact  (max 5, E.164 validation)
PUT    /api/v1/safety/contacts/{id}       -> update contact
DELETE /api/v1/safety/contacts/{id}       -> delete contact
POST   /api/v1/safety/sos                -> trigger SOS (idempotent)
POST   /api/v1/safety/sos/{id}/resolve   -> resolve SOS  ("resolved" | "false_alarm")
GET    /api/v1/safety/status             -> get safety status

# Auth module (device registration)
POST   /api/v1/auth/device/register      -> register FCM token for push notifications
```

**Idempotency:** `POST /sos` requires `Idempotency-Key` header matching the `idempotency_key` in the body. If same key within 24h → return 200 with existing record (no re-dispatch).

**Contact limit:** Maximum **5** emergency contacts per user. Validated on create. Prevents notification fatigue.

**Phone validation:** All phone numbers must be E.164 format (`+977XXXXXXXXX`). Malformed numbers are rejected on create.

**SMS rate limit:** Maximum **5** SMS per user per hour via Twilio. Prevents runaway costs from bugs.

### `schemas.py` (Device Registration)

| Schema | Fields |
|--------|--------|
| `DeviceRegisterRequest` | `fcm_token: str`, `device_name: str?`, `platform: Literal["ios", "android"]` |
| `DeviceRegisterResponse` | `id: uuid`, `message: str` |

### `services.py` (Device Registration)

```python
class DeviceService:
    def __init__(self, db: AsyncSession) -> None

    async def register_device(self, user_id: uuid.UUID, data: DeviceRegisterRequest) -> UserDevice:
        # Upsert: if device already registered for this user, update fcm_token
        # Otherwise create new UserDevice record
```

### `tasks.py`

```python
@celery_app.task(name="app.modules.safety.tasks.sos_checkin",
                 soft_time_limit=30, time_limit=60)
def sos_checkin(sos_event_id: str) -> None:
    """Re-send notifications if SOS not resolved after 15 min."""
    sos = db.get(SOSEvent, uuid.UUID(sos_event_id))
    if sos and sos.status == "active":
        # 1. SMS all contacts: "Reminder: [user] still needs help"
        # 2. Push to user: "Tap to resolve if you're safe now"
```

### Integration: `FCMClient` Push Notification (SOS)

**Push vs SMS dispatch rule:**
1. Contacts with `contact_user_id` → look up their `UserDevice.fcm_token` → FCM push
2. Contacts without `contact_user_id` (non-users) → Twilio SMS only
3. If a registered user has no `fcm_token` registered → fallback to SMS

```python
# Sent to each emergency contact via FCM (only if contact has contact_user_id)
{
  "to": contact_fcm_token,
  "priority": "high",
  "notification": {
    "title": "🚨 EMERGENCY — [user.display_name] needs help!",
    "body": f"Location: maps.google.com/?q={lat},{lng}"
  },
  "data": {
    "type": "sos_alert",
    "user_id": str(user_id),
    "sos_event_id": str(sos_event.id),
  }
}
```

```python
# Sent to non-user contacts (no contact_user_id) via Twilio SMS
# "Help! [user.display_name] needs emergency help. Location: https://maps.google.com/?q={lat},{lng}. Sent from SheCare."
```

## Mobile Implementation

### `src/screens/safety/`

```
SafetyScreen.tsx            # Main safety dashboard — contacts list + SOS button
SOSActiveScreen.tsx         # Shown during active SOS — countdown, map, resolve option
EmergencyContactsScreen.tsx # CRUD list for emergency contacts
AddContactScreen.tsx        # Form to add/edit a contact
```

### `SafetyScreen.tsx`

```
Layout:
┌──────────────────────────────────┐
│  [Header: "Safety"]             │  gradient + shield icon
├──────────────────────────────────┤
│  ┌────────────────────────────┐  │
│  │    [SOS — Hold 3 seconds]  │  │  Large red button, haptic feedback
│  └────────────────────────────┘  │  On press → 3s haptic countdown →
├──────────────────────────────────┤  cancel or trigger
│  Emergency Contacts              │
│  + Add Emergency Contact         │  Full-width button
│  ┌─ Name: Mom ─────────────────┐ │
│  │  Phone: +1 555-0100         │ │  Swipeable row
│  │  Notify via: Push + SMS     │ │
│  └─────────────────────────────┘ │
│  ┌─ Name: Best Friend ─────────┐ │
│  │  Phone: +1 555-0200         │ │
│  └─────────────────────────────┘ │
├──────────────────────────────────┤
│  Self Check-in                    │
│  [I'm safe — Mark as Resolved]   │  Only if active SOS
└──────────────────────────────────┘
```

### `SOSActiveScreen.tsx` — Pre-Trigger Countdown

```typescript
const SOS_TRIGGER_DELAY_MS = 2000;  // 2-second hold

function SOSActiveScreen() {
  const [countdown, setCountdown] = useState(SOS_TRIGGER_DELAY_MS / 1000);
  const [cancelled, setCancelled] = useState(false);

  // Start haptic feedback loop
  // Show countdown overlay
  // On cancel → return to SafetyScreen
  // On expiry → execute triggerSOS()
}
```

### API Service: `src/services/api/safety.ts`

```typescript
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  notify_via: 'push' | 'sms' | 'both';
  is_active: boolean;
  created_at: string;
}

export interface SOSEventResponse {
  id: string;
  user_id: string;
  status: 'active' | 'resolved' | 'false_alarm';
  trigger_source: string;
  location_lat?: number;
  location_lng?: number;
  notified_contacts: Array<{ contact_id: string; name: string; method: string; sent_at: string; status: string }>;
  created_at: string;
}

export const safetyService = {
  async getContacts(): Promise<EmergencyContact[]>,
  async createContact(data: Partial<EmergencyContact>): Promise<EmergencyContact>,
  async updateContact(id: string, data: Partial<EmergencyContact>): Promise<EmergencyContact>,
  async deleteContact(id: string): Promise<void>,
  async triggerSOS(data: { idempotency_key: string; trigger_source: string; lat?: number; lng?: number }): Promise<SOSEventResponse>,
  async resolveSOS(id: string): Promise<SOSEventResponse>,
  async getStatus(): Promise<{ active_sos: SOSEventResponse | null; emergency_contacts: EmergencyContact[] }>,
};
```

## Native SMS Fallback (Mobile)

```typescript
// In safetyService.ts or a native module helper
async function sendSMSFallback(contact: EmergencyContact, userName: string, lat?: number, lng?: number) {
  const locationText = lat && lng ? `Location: https://maps.google.com/?q=${lat},${lng}` : '';
  const message = `Help! ${userName} needs emergency help. ${locationText} Sent from SheCare.`;

  // Attempt via native SMS intent/URL scheme
  if (Platform.OS === 'android') {
    Linking.openURL(`sms:${contact.phone}?body=${encodeURIComponent(message)}`);
  } else {
    Linking.openURL(`sms:${contact.phone}&body=${encodeURIComponent(message)}`);
  }
}
```

## Offline SOS Queuing (Critical — Sync Priority)

**Problem:** In rural Nepal (target market), network drops are common. If SOS fires offline, both the API call and native SMS fallback (requires cellular) may fail. The event must be stored locally and synced with highest priority when connectivity returns.

### A. Local SOS Cache (Mobile)

```typescript
// src/services/sync/offlineQueue.ts

interface SyncQueueItem {
  id: string;
  endpoint: string;
  payload: any;
  priority: 'critical' | 'normal' | 'low';  // SOS = 'critical'
  attempts: number;
  maxAttempts: number;
  created_at: string;
}

class OfflineSyncQueue {
  private items: SyncQueueItem[] = [];

  async add(item: Omit<SyncQueueItem, 'id' | 'attempts' | 'created_at'>): Promise<void> {
    // Persist to EncryptedStorage
  }

  async processPending(): Promise<void> {
    // 1. Sort by priority (critical first)
    // 2. Attempt API calls
    // 3. Remove successfully synced items
    // 4. Retry failed items up to maxAttempts
  }
}
```

### B. Auto-Retry on Connectivity Restore

```typescript
// In sync manager: when network status changes from offline → online
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    syncQueue.processPending();  // Critical SOS items processed first
  }
});
```

### C. Server-Side Handling

- Accept SOS events even if `locally_cached = true` and `synced = false`
- Idempotency key prevents duplicate dispatch when retrying

## Voice Trigger Decision

**Decision for V1:** Hardware trigger only (triple-press power button / side button).

| Approach | Complexity | Reliability | Recommendation |
|----------|-----------|-------------|----------------|
| Full hotphrase ("Help me Navya") — Porcupine | Very high | Medium | ❌ Phase 5 |
| Simple speech detection on Safety Screen | Medium | Low | ❌ Not worth it |
| Hardware triple-press (power button) | Low | **100%** | ✅ V1 |

- Voice trigger (`trigger_source = "voice"`) is reserved in the database schema for Phase 5
- V1 focuses on **shake gesture** (`react-native-shake`) as the primary non-UI trigger — well-supported, works offline, no special permissions
- Triple-press power button is **best-effort only**: iOS reserves triple-press for Accessibility (Guided Access, VoiceOver); Android requires a foreground service and newer versions may limit interception
- Even without hardware interception, the UI SOS button + shake gesture provide a fully functional emergency trigger

## Minor Refinements

| Area | Detail |
|------|--------|
| **Phone validation** | All phone numbers must be E.164 format (`+977XXXXXXXXX`). Reject malformed on create in `EmergencyContactCreate`. |
| **Location precision** | If `location_accuracy > 500` meters, append "Location approximate — please call user." to SMS/push body. |
| **Contact limit** | Maximum **5** emergency contacts per user. Prevents notification fatigue. Validated in `POST /safety/contacts`. |
| **SMS rate limit** | Global rate limit: **5 SMS per user per hour** on Twilio fallback. Prevents runaway costs from bugs. |
| **User triage UI** | Show persistent badge on Safety tab while SOS is active. On "I'm Safe" tap, send "false alarm / I'm safe" notification to all contacts. |

## Location Permission: Request-on-Use

```typescript
async function requestSOSLocationPermission(): Promise<boolean> {
  // Not at app start — only when SOS is about to trigger
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}
```

## Validation Criteria

### Backend
- [ ] Emergency contact CRUD: create, update, delete, list
- [ ] Contact create validates max 5 contacts per user
- [ ] Contact create validates E.164 phone format
- [ ] SOS trigger: creates SOSEvent with idempotency check
- [ ] SOS trigger: duplicate idempotency key within 24h returns existing event (no re-dispatch)
- [ ] SOS trigger: contacts with `contact_user_id` → FCM push (look up UserDevice.fcm_token)
- [ ] SOS trigger: contacts without `contact_user_id` → Twilio SMS
- [ ] SOS trigger: if registered user has no fcm_token → fallback to SMS
- [ ] SOS trigger: SMS rate limit (5/user/hour) enforced
- [ ] SOS resolve: updates status + emits "sos_resolved" event
- [ ] Check-in task: 15-min re-notification for unresolved SOS
- [ ] Device registration: `POST /auth/device/register` stores FCM token
- [ ] Device registration: upsert (update existing token, create new device)

### Mobile
- [ ] SOS button has 2-second hold with haptic countdown
- [ ] Cancel during countdown aborts trigger
- [ ] Safety dashboard shows contacts + active SOS status
- [ ] Native SMS fallback: opens SMS app with pre-filled message
- [ ] Offline SOS: event stored locally with priority='critical'
- [ ] Sync order: critical items (SOS) processed before normal items (journals, cycle)
- [ ] Safety tab shows persistent badge while SOS active
- [ ] "I'm Safe" sends false-alarm notification to all contacts
- [ ] Location: requested at SOS time, not at app start
- [ ] Voice trigger: explicitly marked as Phase 5 (no hotphrase training in V1)
- [ ] TypeScript: `npx tsc --noEmit` passes with 0 errors

### Critical QA Additions

| Check | Rule |
|-------|------|
| Idempotency | Same `Idempotency-Key` within 24h → 200 with existing event (no re-dispatch) |
| Push vs SMS | Contacts with `contact_user_id` → FCM push; non-users → SMS. Fallback to SMS if no FCM token |
| Offline sync priority | SOS events processed before journals/cycles on connectivity restore |
| SMS rate limit | 5 SMS per user per hour enforced globally |
| Contact limit | Max 5 contacts per user enforced on `POST /contacts` |
| E.164 validation | `+977XXXXXXXXX` format enforced on create |
| Check-in task | 15-min re-notification for unresolved SOS |
| User triage | "I'm Safe" sends false-alarm notification to all contacts |
