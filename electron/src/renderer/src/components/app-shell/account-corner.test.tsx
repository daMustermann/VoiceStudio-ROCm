import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ mac: false }));
vi.mock('@/components/bridge', () => ({ isMac: () => mock.mac }));
vi.mock('./system-notifications', () => ({
  SystemNotifications: ({ enabled, titlebar }: { enabled: boolean; titlebar?: boolean }) => (
    <button type="button" data-enabled={String(enabled)} data-titlebar={String(Boolean(titlebar))}>
      bell
    </button>
  ),
}));

import { AccountCorner } from './account-corner';

afterEach(() => {
  cleanup();
  mock.mac = false;
  document.documentElement.style.removeProperty('--corner-space');
});

it('shows the notifications bell without an account control', () => {
  render(<AccountCorner notificationsEnabled />);
  const [bell] = screen.getAllByRole('button');
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(bell).toHaveTextContent('bell');
  expect(bell).toHaveAttribute('data-enabled', 'true');
  expect(bell).toHaveAttribute('data-titlebar', 'true');
});

it('sits left of the Windows/Linux window buttons, and at the corner on macOS', () => {
  const { unmount } = render(<AccountCorner notificationsEnabled={false} />);
  const corner = () => document.querySelector('[data-slot="account-corner"]')!;
  expect(corner().className).toMatch(/fixed/);
  expect(corner().className).toMatch(/app-no-drag/);
  expect(corner().className).toMatch(/right-\[148px\]/);
  unmount();
  mock.mac = true;
  render(<AccountCorner notificationsEnabled={false} />);
  expect(corner().className).toMatch(/right-3\.5/);
});

it('reserves title-bar space while it shows and frees it when it goes', () => {
  const { unmount } = render(<AccountCorner notificationsEnabled />);
  expect(document.documentElement.style.getPropertyValue('--corner-space')).toMatch(/px$/);
  unmount();
  expect(document.documentElement.style.getPropertyValue('--corner-space')).toBe('');
});
