# Gap Plan 3: E2E Tests (Detox/Maestro — 3 Critical Flows)

> **Target:** 3 E2E flows passing on a native simulator
> **Current:** 0 — no E2E setup/tests exist
> **Priority:** MEDIUM — blocked by native simulator availability

---

## 3.1 Tool Choice

| Tool | Pros | Cons | Decision |
|------|------|------|----------|
| **Detox** | Wix-maintained, RN-native, built-in device handling | iOS only without Mac, complex setup | ✅ **Chosen** — best RN integration |
| **Maestro** | Cross-platform, simpler YAML config | Less RN-native, fewer matchers | Fallback if Detox fails |

**Decision:** Detox primary, Maestro as backup.

---

## 3.2 Setup Steps

### Step 1: Install Detox CLI + Dependencies

```bash
cd mobile/
npm install --save-dev detox @testing-library/jest-native
npm install --save-dev @types/detox  # TypeScript types

# Install Detox CLI globally (or via npx)
npm install -g detox-cli

# For Android (Windows):
# Install Android SDK, set ANDROID_HOME
# Create an AVD (e.g., Pixel_4_API_33)
```

### Step 2: Configure `detox.config.js`

```javascript
// mobile/detox.config.js
module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  configurations: {
    'android.emu.debug': {
      device: {
        avdName: 'Pixel_4_API_33',
      },
      app: {
        binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
        build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      },
    },
    'ios.sim.debug': {
      device: {
        type: 'iPhone 14',
      },
      app: {
        binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/SheCare.app',
        build: 'xcodebuild -workspace ios/SheCare.xcworkspace -scheme SheCare -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
      },
    },
  },
};
```

### Step 3: Create `mobile/e2e/jest.config.js`

```javascript
// mobile/e2e/jest.config.js
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
```

### Step 4: Create `mobile/e2e/init.js`

```javascript
// mobile/e2e/init.js
const detox = require('detox');
const config = require('../detox.config');

beforeAll(async () => {
  await detox.init(config);
  await device.launchApp({ permissions: { notifications: 'YES', location: 'always' } });
});

afterAll(async () => {
  await detox.cleanup();
});
```

---

## 3.3 Test Flows

### Flow 1: Register → Onboard → See Calendar (`e2e/flows/01-register-onboard-calendar.test.js`)

```javascript
describe('Flow 1: Register → Onboard → Calendar', () => {
  beforeAll(async () => {
    await device.relaunchApp({ delete: true });  // Fresh install
  });

  it('shows auth screen on first launch', async () => {
    await expect(element(by.id('auth-screen'))).toBeVisible();
  });

  it('registers with email and password', async () => {
    await element(by.id('register-button')).tap();
    await element(by.id('email-input')).typeText('e2e_test@example.com');
    await element(by.id('password-input')).typeText('TestPass123!');
    await element(by.id('submit-button')).tap();
    await expect(element(by.id('onboarding-screen'))).toBeVisible();
  });

  it('completes 6-step onboarding', async () => {
    // Step 1: Name
    await element(by.id('name-input')).typeText('E2E User');
    await element(by.id('next-button')).tap();

    // Step 2: Birth year
    await element(by.id('birth-year-picker')).setColumnToValue(0, '1995');
    await element(by.id('next-button')).tap();

    // Step 3: Cycle length
    await element(by.id('cycle-length-picker')).setColumnToValue(0, '28');
    await element(by.id('next-button')).tap();

    // Step 4: Period length
    await element(by.id('period-length-picker')).setColumnToValue(0, '5');
    await element(by.id('next-button')).tap();

    // Step 5: Last period start
    await element(by.id('last-period-date-picker')).tap();
    await element(by.id('date-picker-confirm')).tap();
    await element(by.id('next-button')).tap();

    // Step 6: Consent
    await element(by.id('consent-checkbox')).tap();
    await element(by.id('complete-button')).tap();

    await expect(element(by.id('calendar-screen'))).toBeVisible();
  });

  it('shows backfilled cycle data on calendar', async () => {
    await expect(element(by.id('calendar-screen'))).toBeVisible();
    // Verify a period day marker exists
    await expect(element(by.id('period-day-marker'))).toExist();
  });
});
```

### Flow 2: Log Period → See Prediction → Correct It (`e2e/flows/02-period-prediction-correction.test.js`)

```javascript
describe('Flow 2: Log Period → Prediction → Correction', () => {
  beforeAll(async () => {
    // Login or register
    await device.relaunchApp({ delete: true });
    // ... register flow ...
  });

  it('logs a period entry', async () => {
    await element(by.id('cycle-tab')).tap();
    await element(by.id('log-period-button')).tap();
    await element(by.id('date-picker')).tap();
    await element(by.id('date-picker-confirm')).tap();
    await element(by.id('flow-select')).tap();
    await element(by.id('flow-heavy')).tap();
    await element(by.id('save-entry-button')).tap();

    await expect(element(by.id('period-entry-saved-toast'))).toBeVisible();
  });

  it('shows next period prediction after logging', async () => {
    await element(by.id('predictions-tab')).tap();
    // Wait for prediction to load
    await waitFor(element(by.id('next-period-prediction')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('prediction-date'))).toBeVisible();
  });

  it('logs a correction to the prediction', async () => {
    await element(by.id('prediction-card')).tap();
    await element(by.id('correct-button')).tap();
    await element(by.id('actual-date-picker')).tap();
    await element(by.id('date-picker-confirm')).tap();
    await element(by.id('submit-correction-button')).tap();

    await expect(element(by.id('correction-saved-toast'))).toBeVisible();
  });
});
```

### Flow 3: SOS Trigger → Resolve (`e2e/flows/03-sos-trigger-resolve.test.js`)

```javascript
describe('Flow 3: SOS → Resolve', () => {
  beforeAll(async () => {
    await device.relaunchApp({ delete: true });
    // ... login ...
  });

  it('navigates to Safety screen', async () => {
    await element(by.id('safety-tab')).tap();
    await expect(element(by.id('safety-screen'))).toBeVisible();
  });

  it('triggers SOS with countdown', async () => {
    await element(by.id('sos-button')).tap();
    // Countdown appears
    await expect(element(by.id('sos-countdown'))).toBeVisible();
    // Wait for countdown to complete
    await waitFor(element(by.id('sos-active-banner')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('sos-active-banner'))).toBeVisible();
  });

  it('resolves SOS', async () => {
    await element(by.id('resolve-sos-button')).tap();
    await expect(element(by.id('sos-resolved-toast'))).toBeVisible();
    // SOS button should be re-enabled
    await expect(element(by.id('sos-button'))).toBeVisible();
  });
});
```

---

## 3.4 Mocking External Services in E2E

Add mock endpoints to the backend for E2E flows:

```python
# backend/app/modules/e2e/ (NEW) — only registered when ENVIRONMENT == "e2e"
@router.post("/e2e/mock/fcm/send")
async def mock_fcm_send():
    return {"status": "ok", "mock": True}

@router.post("/e2e/mock/twilio/sms")
async def mock_twilio_sms():
    return {"status": "ok", "mock": True}
```

Or use Detox's built-in mock server to intercept HTTP calls from the mobile app.

---

## 3.5 CI Integration

Add to `.github/workflows/mobile-ci.yml`:

```yaml
  e2e-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: mobile/
      - name: Run Detox E2E on Android emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 33
          target: google_apis
          avd-name: Pixel_4_API_33
          script: |
            cd mobile/
            npx detox build --configuration android.emu.debug
            npx detox test --configuration android.emu.debug
```

---

## 3.6 Validation

```bash
# Build and test locally
cd mobile/
npx detox build --configuration android.emu.debug
npx detox test --configuration android.emu.debug --take-screenshots all

# All 3 flows pass
# Screenshots saved for visual inspection
```

---

## 3.7 Pre-requisites

- [ ] Android SDK + emulator (or iOS simulator on Mac)
- [ ] Detox CLI installed
- [ ] App builds successfully in debug mode
- [ ] Backend running at `http://10.0.2.2:8000` (Android emulator → host)
- [ ] OR mock server intercepting API calls
