import { expect, it, vi } from 'vitest';

it('never imports the telemetry SDK, including after a saved opt-in', async () => {
  vi.resetModules();
  const sdk = {
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    captureException: vi.fn(),
  };
  const imported = vi.fn(() => Promise.resolve({ default: sdk }));
  vi.doMock('posthog-js/dist/module.slim.no-external', imported);
  vi.doMock('posthog-js/dist/extension-bundles', () => ({ ErrorTrackingExtensions: {} }));
  const analytics = await import('../utils/analytics');
  await analytics.enableAnalytics();
  analytics.disableAnalytics();
  await analytics.enableAnalytics();
  expect(analytics.analyticsAvailable()).toBe(false);
  expect(imported).not.toHaveBeenCalled();
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.opt_in_capturing).not.toHaveBeenCalled();
  vi.doUnmock('posthog-js/dist/module.slim.no-external');
  vi.doUnmock('posthog-js/dist/extension-bundles');
});
