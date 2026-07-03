# Settings Screen — Apple Cupertino Inspired

> Route: `MainTabs` → `Profile` → `Settings`

## Layout

iOS-style grouped table with rounded card sections, minimal icons, elegant spacing.

```
┌─────────────────────────────────────┐
│  Settings                           │
├─────────────────────────────────────┤
│  ┌─ Account ─────────────────────┐  │
│  │  👤 [Name]                    │  │  <- Profile summary card (tappable)
│  │    you@email.com              │  │
│  │  ──────────────────────────── │  │
│  │  > Personal Information       │  │  <- Disclosure indicators (>)
│  │  > Change Password            │  │
│  │  > Linked Family Members      │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Notifications ───────────────┐  │
│  │  Push Notifications     [toggle]│  │
│  │  Email Notifications    [toggle]│  │
│  │  SMS Alerts            [toggle]│  │
│  │  ──────────────────────────── │  │
│  │  > Notification Preferences   │  │  <- Detail: log type, time, quiet hours
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Privacy & Security ──────────┐  │
│  │  Biometric Lock        [toggle]│  │
│  │  Share Analytics       [toggle]│  │
│  │  ──────────────────────────── │  │
│  │  > Data Export                │  │
│  │  > Delete Account             │  │  <- Red text, confirmation modal
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ AI & Models ─────────────────┐  │
│  │  Offline AI Models     [toggle]│  │  <- Local model for predictions
│  │  Auto-download updates [toggle]│  │
│  │  > Manage Downloaded Models   │  │  <- Shows model size, version
│  │  > Clear Model Cache          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Appearance ──────────────────┐  │
│  │  Dark Mode             [toggle]│  │
│  │  Language              > English│  │  <- Opens language picker
│  │  Text Size              > Medium│  │  <- Opens text size picker (S/M/L/XL)
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Support ─────────────────────┐  │
│  │  > Help Center                │  │
│  │  > Report a Problem           │  │
│  │  > Contact Us                 │  │
│  │  > Rate the App               │  │  <- Links to App Store / Play Store
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ About ───────────────────────┐  │
│  │  Version              2.1.0   │  │
│  │  Build                42      │  │
│  │  Licenses                     │  │  <- Open source licenses
│  │  Privacy Policy               │  │  <- Web view
│  │  Terms of Service             │  │  <- Web view
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Section Card Spec

| Property | Value |
|----------|-------|
| Background | White (`bg.surface`) |
| Border radius | 16px (xl) |
| Shadow | Soft (sm) |
| Margin bottom | 16px |
| Inner padding | 16px (lg) |
| Section title | `h3`, bold, with leading icon |

## Setting Row Spec

- **Label**: `body` text, left aligned
- **Description**: `caption` text, muted color, below label (optional)
- **Interaction**: `Switch` (iOS toggle) for boolean, `>` disclosure for navigation
- **Divider**: `StyleSheet.hairlineWidth` between rows
- **Min height**: 44px (touch target)
- **Last row**: no divider

## Features

### Account Section
- **Profile card**: avatar (large circle, 64px), name, email. Tap → Edit Profile
- **Personal Information**: name, DOB, phone, emergency contact
- **Change Password**: current + new password form
- **Linked Family Members**: list of linked accounts, invite new

### Notifications Section
- **Push/Email/SMS**: simple toggles
- **Notification Preferences**: detail screen with granular control
  - Period reminders (X days before)
  - Wellness tips (daily/weekly)
  - SOS alerts (always on)
  - Quiet hours (start/end time)

### Privacy & Security Section
- **Biometric Lock**: FaceID / Fingerprint toggle
- **Share Analytics**: Anonymized data sharing toggle
- **Data Export**: generates and emails user data (GDPR compliant)
- **Delete Account**: red styled, confirmation modal with "Are you sure?" + password re-auth
  - "This action cannot be undone. All your data will be permanently deleted."

### AI & Models Section
- **Offline AI Models**: toggle to enable/disable on-device ML model
- **Auto-download Updates**: toggle for automatic model updates
- **Manage Downloaded Models**: shows model name, version, size (MB), "Update available" badge
- **Clear Model Cache**: removes downloaded models, confirmation modal

### Appearance Section
- **Dark Mode**: toggle, matches system by default
- **Language**: opens bottom sheet with language list (English, Hindi, Spanish, French, etc.)
- **Text Size**: opens bottom sheet with 4 options (Small, Medium, Large, Extra Large)

### Support Section
- **Help Center**: opens FAQ web view
- **Report a Problem**: opens feedback form (email or in-app)
- **Contact Us**: opens email compose or chat
- **Rate the App**: links to App Store / Play Store

### About Section
- **Version / Build**: auto-detected from app config
- **Licenses**: open source software licenses (scrollable web view)
- **Privacy Policy**: web view
- **Terms of Service**: web view

## Logout

- Red styled button at the bottom, outside any card
- Confirmation dialog: "Are you sure you want to log out?"
- Clears auth state, navigates to Auth stack
- Option to "Keep local data" vs "Clear all data"

## States

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton rows for each section |
| **Error saving** | Toast with error, revert toggle |
| **Biometric unavailable** | Toggle hidden or disabled with tooltip |
| **Offline** | Toggles saved locally, synced when online |
