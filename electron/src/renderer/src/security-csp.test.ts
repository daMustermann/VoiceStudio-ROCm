import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

describe('renderer content security policy', () => {
  it('does not allow telemetry collection endpoints', () => {
    expect(html).not.toMatch(/posthog\.com|sentry\.io/i);
  });
});
