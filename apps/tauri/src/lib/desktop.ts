/**
 * Thin wrappers over the common desktop plugins, so UI code doesn't import the
 * plugin packages directly and error handling lives in one place.
 *
 * - autostart    → launch at login
 * - notification → native OS notifications
 * - updater      → check/download/install updates (release builds only)
 * - tray badge   → the `set_badge` Rust command (see src-tauri/src/main.rs)
 */
import { invoke } from '@tauri-apps/api/core';
import {
  disable as autostartDisable,
  enable as autostartEnable,
  isEnabled as autostartIsEnabled,
} from '@tauri-apps/plugin-autostart';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { check } from '@tauri-apps/plugin-updater';

// --- Autostart -------------------------------------------------------------

export const autostart = {
  isEnabled: () => autostartIsEnabled(),
  enable: () => autostartEnable(),
  disable: () => autostartDisable(),
};

// --- Native notifications --------------------------------------------------

/** Send a native notification, requesting permission on first use. */
export async function notify(title: string, body?: string): Promise<void> {
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === 'granted';
  }
  if (granted) sendNotification({ title, body });
}

// --- Tray badge ------------------------------------------------------------

/** Set the tray badge/title (macOS shows the count next to the menu-bar icon). */
export function setBadge(count: number): Promise<void> {
  return invoke('set_badge', { count });
}

// --- Auto-update -----------------------------------------------------------

export interface UpdateResult {
  status: 'updated' | 'up-to-date' | 'not-configured' | 'error';
  version?: string;
  message?: string;
}

/**
 * Check for an update and install it if found. Returns a status instead of
 * throwing so the UI can show a friendly message — notably `not-configured`
 * when the updater plugin isn't registered (dev builds) or has no config.
 */
export async function checkForUpdate(): Promise<UpdateResult> {
  try {
    const update = await check();
    if (!update) return { status: 'up-to-date' };
    await update.downloadAndInstall();
    return { status: 'updated', version: update.version };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The updater throws when no endpoints/pubkey are configured.
    if (/not configured|no endpoints|updater/i.test(message)) {
      return { status: 'not-configured', message };
    }
    return { status: 'error', message };
  }
}
