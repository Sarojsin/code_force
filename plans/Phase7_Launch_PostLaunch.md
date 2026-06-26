# Phase 7: Launch & Post-Launch

## Objective

Ship v1.0.0 to iOS App Store and Google Play, establish production monitoring/alerting, and execute a phased rollout with feature flags for safe iteration post-launch.

## 7.1 Pre-Launch Checklist

### App Store Preparation

| Item | Details |
|------|---------|
| App name | SheCare |
| Bundle ID | `com.shecare.app` |
| Primary language | English (US) |
| Age rating | 17+ (health/medical references, crisis content) |
| Privacy policy URL | Must cover: health data encryption, no data sharing, HIPAA-style (even if not HIPAA-covered) |
| Terms of service | Standard SaaS terms |
| Screenshots | 6.7" + 5.5" display sizes: Dashboard, Calendar, Journal, Safety, Cycle Analytics, Onboarding |
| Preview video | 15–30s walkthrough of core flow (Register → Onboard → Calendar → SOS) |
| Keywords | women's health, period tracker, ovulation, fertility, cycle, wellness, safety |
| Support URL | `https://shecare.app/support` |
| Marketing URL | `https://shecare.app` |

### App Review Notes

- Emphasize **no medical claims** — the app is a wellness tool, not a diagnostic device
- **SOS feature**: document that it sends notifications to user-provided contacts, does not call emergency services directly
- **Encryption**: note that journal content is processed entirely on-device
- Test account credentials for reviewer (provide in Review Notes)

### Google Play Specifics

- Content rating questionnaire (health/fitness category)
- Data safety section: health data encrypted, not shared with third parties
- In-app purchases: none in v1 (free app)

### Legal

- [ ] Privacy policy drafted and hosted at `https://shecare.app/privacy`
- [ ] Terms of service drafted and hosted at `https://shecare.app/terms`
- [ ] COPPA compliance: age gate at registration (min 13)
- [ ] GDPR compliance: data export endpoint (`GET /api/v1/account/export`)
- [ ] CCPA compliance: data deletion endpoint (`DELETE /api/v1/account/data`)
- [ ] App store age rating confirmed (17+)

## 7.2 Phased Rollout

### Stage 1: Internal TestFlight (Day 0–3)

- 50 internal testers (team + friends/family)
- Validate: auth, onboarding, calendar, journal, SOS
- Crash-free rate target: 99.5%+
- Fix any critical bugs before proceeding

### Stage 2: Closed Beta (Day 4–10)

- 500 invite-only testers via TestFlight + Google Play Closed Track
- Enable full feature set
- Collect: crash reports, analytics, NPS survey
- Metrics gate: crash-free ≥ 99%, NPS ≥ 30, SOS success rate ≥ 95%

### Stage 3: Public Launch (Day 11)

| Day | % Rollout | Actions |
|-----|-----------|---------|
| 11 | 10% | Launch, monitor for 24h |
| 12 | 25% | If crash-free ≥ 99% |
| 13 | 50% | If crash-free ≥ 99% |
| 14 | 100% | Full rollout |

**Kill switch**: if crash-free drops below 99% at any stage → halt rollout, revert to previous stage.

## 7.3 Production Monitoring

### Alerts (PagerDuty/Opsgenie)

| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| API error rate | 5xx responses / total | > 1% in 5 min | Page on-call |
| API p95 latency | Request duration | > 2 s | Email + Slack |
| SOS failure | FCM send failures | > 5% in 5 min | Page on-call |
| Celery queue depth | Pending tasks | > 1000 | Email |
| Database connections | Active connections | > 80% of max | Email |
| Disk usage | Model storage disk | > 85% | Email |
| Crash-free rate | Sentry crash-free | < 99% | Page on-call |

### Dashboards (Azure Monitor / Grafana)

**Backend Dashboard**:
- Request rate (rps) by endpoint
- p50/p95/p99 latency by endpoint
- Error rate by status code (4xx vs 5xx)
- Celery task queue depth + success/failure rate
- Database connection pool usage
- Redis memory usage
- Auth rate limit hits

**Mobile Dashboard**:
- DAU / MAU (Daily/Monthly Active Users)
- Screen views by name
- Crash-free rate by version
- SOS trigger count (total + unique users)
- Onboarding completion rate (started vs completed)
- Sync success rate
- Journal entries per user (daily/weekly)

## 7.4 Post-Launch Analytics

### Events to Track (Optional — user consent required)

```typescript
// Using posthog or mixpanel (with user opt-in)
enum AnalyticsEvent {
  REGISTERED = 'auth_registered',
  LOGGED_IN = 'auth_logged_in',
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  ONBOARDING_DROPPED = 'onboarding_dropped',
  CYCLE_ENTRY_CREATED = 'cycle_entry_created',
  PREDICTION_VIEWED = 'prediction_viewed',
  PREDICTION_CORRECTED = 'prediction_corrected',  // Feedback loop
  JOURNAL_CREATED = 'journal_created',
  SOS_TRIGGERED = 'sos_triggered',
  SOS_RESOLVED = 'sos_resolved',
  SYNC_COMPLETED = 'sync_completed',
  MODEL_DOWNLOADED = 'model_downloaded',
  DEEP_LINK_OPENED = 'deep_link_opened',
  NOTIFICATION_TAPPED = 'notification_tapped',
}
```

### Key Metrics (Weekly Review)

| Metric | Target (Week 4) |
|--------|-----------------|
| DAU | 500 |
| Onboarding completion rate | ≥ 70% |
| D7 retention | ≥ 40% |
| D30 retention | ≥ 25% |
| Cycle entries per active user (weekly) | ≥ 2 |
| Journal entries per active user (weekly) | ≥ 3 |
| SOS rate (unique users / DAU) | < 2% |
| Sync success rate | ≥ 95% |
| Crash-free rate | ≥ 99% |
| App Store rating | ≥ 4.0 |
| NPS | ≥ 30 |

## 7.5 Post-Launch Iterations (Phase 8+ Candidates)

### Short-term (Weeks 2–4)

- [ ] **Analytics dashboard** — web-based admin panel showing key metrics
- [ ] **Deep linking** — notification → specific screen (e.g., SOS alert → SOS screen)
- [ ] **iCloud/Google Drive backup** — encrypted backup of local data
- [ ] **Cycle PDF export** — generate PDF of cycle history
- [ ] **Localization** — Spanish + Hindi (top 2 requested languages)

### Medium-term (Weeks 4–12)

- [ ] **Pregnancy mode** — switch from cycle tracking to pregnancy milestone tracking
- [ ] **Community forums** (moderated) — with Stream Chat integration
- [ ] **Symptom insights** — "You tend to have cramps on day 1–2 of your cycle" (from local analysis)
- [ ] **Partner sharing** — share cycle or pregnancy info with partner
- [ ] **Wearable integration** — Apple Watch + Fitbit HRV/stress data

### Long-term (Quarter 2+)

- [ ] **Telehealth integration** — book appointment with women's health specialist
- [ ] **Premium tier** — advanced analytics, personalized nutrition/exercise plans
- [ ] **Blood work OCR** — scan lab results, chart biomarkers over time
- [ ] **PCOS / Endometriosis tracking** — specialized symptom + treatment logging
- [ ] **Medication tracker** — birth control pill reminders, fertility drug logging

## 7.6 Feature Flags (JSON-based)

### Server: `GET /api/v1/features`

```json
{
  "flags": {
    "pregnancy_mode": {
      "enabled": false,
      "rollout_percentage": 0
    },
    "community_forums": {
      "enabled": false,
      "rollout_percentage": 0
    },
    "partner_sharing": {
      "enabled": false,
      "rollout_percentage": 0
    },
    "analytics_export": {
      "enabled": true,
      "rollout_percentage": 100
    },
    "new_onboarding_flow": {
      "enabled": true,
      "rollout_percentage": 50
    }
  },
  "config": {
    "max_cycle_entries_per_sync": 100,
    "journal_max_chars": 5000,
    "sos_checkin_interval_minutes": 15,
    "model_download_timeout_seconds": 300
  }
}
```

### Mobile: Feature Flag Hook

```typescript
// src/services/features.ts
interface FeatureFlags {
  pregnancy_mode: boolean;
  community_forums: boolean;
  partner_sharing: boolean;
  analytics_export: boolean;
  new_onboarding_flow: boolean;
}

const defaultFlags: FeatureFlags = {
  pregnancy_mode: false,
  community_forums: false,
  partner_sharing: false,
  analytics_export: true,
  new_onboarding_flow: true,
};

function useFeatureFlags(): { flags: FeatureFlags; config: Record<string, any>; loading: boolean } {
  // On mount, fetch GET /api/v1/features
  // Return merged flags (server overrides defaults)
  // Cache in React Query, stale time 30 min
}
```

## Validation Criteria (Launch Gate)

- [ ] App store listings submitted (iOS + Android)
- [ ] All app review metadata prepared (screenshots, keywords, privacy URLs)
- [ ] Privacy policy + Terms of Service published online
- [ ] GDPR/CCPA compliance endpoints implemented (`/account/export`, `/account/data`)
- [ ] Phased rollout plan documented and ready
- [ ] Production monitoring dashboards created
- [ ] Alert rules configured in PagerDuty/Opsgenie
- [ ] Crash-free rate target (≥ 99%) met for 48h in beta
- [ ] Internal TestFlight build distributed and tested
- [ ] Feature flags system deployed (server endpoint + mobile hook)
- [ ] Key metrics tracked in analytics tool
- [ ] On-call rotation established for launch week
- [ ] Rollback plan documented (how to revert to previous app version)
