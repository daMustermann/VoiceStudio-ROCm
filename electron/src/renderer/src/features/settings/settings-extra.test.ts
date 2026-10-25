import { expect, it } from 'vitest';

import { extraSettingsFor } from './settings-page';

it('does not offer cloud accounts in the ROCm settings', () => {
  expect(extraSettingsFor().some((item) => String(item.to) === '/settings/account')).toBe(false);
});
