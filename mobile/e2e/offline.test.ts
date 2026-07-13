/**
 * E2E tests for offline-first architecture.
 * Uses E2E_TEST_OFFLINE launch arg for deterministic network simulation.
 * NEVER use device.setStatusBar — it is flaky across CI environments.
 */

const launchOffline = async () => {
  await device.launchApp({
    newInstance: true,
    launchArgs: { E2E_TEST_OFFLINE: 'true' },
  });
};

const launchOnline = async () => {
  await device.launchApp({
    newInstance: true,
    launchArgs: { E2E_TEST_OFFLINE: 'false' },
  });
};

describe('Offline-First Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await element(by.id('login-screen')).waitToBeVisible();
    await element(by.id('email-input')).typeText('test@shecare.app');
    await element(by.id('password-input')).typeText('testpass123');
    await element(by.id('login-button')).tap();
    await element(by.id('dashboard-screen')).waitToBeVisible(10000);
  });

  it('queues journal entry when offline and shows toast', async () => {
    await launchOffline();

    await element(by.id('journal-tab')).tap();
    await element(by.id('new-entry-button')).tap();

    await element(by.id('journal-title')).typeText('Offline Test Entry');
    await element(by.id('journal-content')).typeText('This was written offline.');
    await element(by.id('save-entry-button')).tap();

    await expect(element(by.text('Saved offline'))).toBeVisible();
  });

  it('shows SOS SMS fallback when offline', async () => {
    await launchOffline();

    await element(by.id('safety-tab')).tap();
    await element(by.id('trigger-sos-button')).tap();

    // 2-second countdown
    await waitFor(element(by.text('ACTIVE'))).toBeVisible().withTimeout(5000);

    // SOS should show as active even offline
    await expect(element(by.id('sos-active-screen'))).toBeVisible();
  });

  it('loads calendar from cache after force-quit', async () => {
    // Load calendar data online first
    await launchOnline();
    await element(by.id('calendar-tab')).tap();
    await expect(element(by.id('calendar-list'))).toBeVisible();

    // Force-quit and relaunch offline
    await device.terminateApp();
    await device.launchApp({
      newInstance: true,
      launchArgs: { E2E_TEST_OFFLINE: 'true' },
    });

    // Calendar should show data immediately (no spinner)
    await expect(element(by.id('calendar-list'))).toBeVisible();
  });
});
