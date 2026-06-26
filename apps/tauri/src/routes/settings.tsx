import { type CSSProperties, useEffect, useState } from 'react';
import { autostart, checkForUpdate, notify, setBadge } from '../lib/desktop';
import { ui } from '../lib/ui';

/**
 * Settings: demonstrates the common desktop capabilities wired in this
 * template — launch at login, native notifications, the tray badge, and the
 * auto-updater (inert until `plugins.updater` is configured).
 */

const eyebrowStyle: CSSProperties = {
  fontFamily: ui.mono,
  fontSize: 10.5,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: ui.faint,
};

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 0',
        borderTop: `1px solid ${ui.borderHair}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: ui.ink }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: ui.muted,
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
      <div style={{ flex: 'none' }}>{children}</div>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  border: `1px solid ${ui.borderStrong}`,
  borderRadius: 10,
  background: ui.surface,
  padding: '9px 16px',
  fontSize: 13.5,
  fontWeight: 500,
  color: ui.ink,
  cursor: 'pointer',
  fontFamily: ui.font,
  whiteSpace: 'nowrap',
};

export function Settings() {
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean | null>(null);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [badge, setBadgeCount] = useState(0);

  useEffect(() => {
    autostart
      .isEnabled()
      .then(setLaunchAtLogin)
      .catch(() => setLaunchAtLogin(false));
  }, []);

  const toggleAutostart = async () => {
    try {
      if (launchAtLogin) {
        await autostart.disable();
        setLaunchAtLogin(false);
      } else {
        await autostart.enable();
        setLaunchAtLogin(true);
      }
    } catch {
      // Re-read the real state if the toggle failed.
      autostart
        .isEnabled()
        .then(setLaunchAtLogin)
        .catch(() => {});
    }
  };

  const runUpdateCheck = async () => {
    setChecking(true);
    setUpdateMsg(null);
    const result = await checkForUpdate();
    const messages: Record<typeof result.status, string> = {
      updated: `Updated to ${result.version ?? 'a new version'} — restart to apply.`,
      'up-to-date': "You're on the latest version.",
      'not-configured':
        'Updater not configured. Add plugins.updater (endpoints + pubkey) to tauri.conf.json.',
      error: `Update check failed: ${result.message ?? 'unknown error'}`,
    };
    setUpdateMsg(messages[result.status]);
    setChecking(false);
  };

  const bumpBadge = () => {
    const next = badge + 1;
    setBadgeCount(next);
    void setBadge(next);
  };

  const clearBadge = () => {
    setBadgeCount(0);
    void setBadge(0);
  };

  return (
    <section
      className="hide-scroll"
      style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        background: ui.surface,
        padding: '20px 40px 48px',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span style={eyebrowStyle}>Settings</span>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.025em',
            }}
          >
            Desktop
          </h1>
        </header>

        <Row
          title="Launch at login"
          desc="Start automatically when you sign in to your computer."
        >
          <button
            type="button"
            onClick={() => void toggleAutostart()}
            disabled={launchAtLogin === null}
            style={{
              ...buttonStyle,
              background: launchAtLogin ? ui.accent : ui.surface,
              color: launchAtLogin ? '#fff' : ui.ink,
              border: launchAtLogin ? 'none' : `1px solid ${ui.borderStrong}`,
            }}
          >
            {launchAtLogin === null ? '…' : launchAtLogin ? 'On' : 'Off'}
          </button>
        </Row>

        <Row
          title="Native notification"
          desc="Send a test notification through the OS notification center."
        >
          <button
            type="button"
            style={buttonStyle}
            onClick={() =>
              void notify('Saasflare Desktop', 'This is a test notification.')
            }
          >
            Send test
          </button>
        </Row>

        <Row
          title="Tray badge"
          desc="Drive the tray icon's badge/title from app state (macOS shows the count)."
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={buttonStyle} onClick={bumpBadge}>
              +1 ({badge})
            </button>
            <button type="button" style={buttonStyle} onClick={clearBadge}>
              Clear
            </button>
          </div>
        </Row>

        <Row
          title="Check for updates"
          desc="Uses the Tauri updater. Inert until you configure an endpoint + signing key."
        >
          <button
            type="button"
            style={buttonStyle}
            disabled={checking}
            onClick={() => void runUpdateCheck()}
          >
            {checking ? 'Checking…' : 'Check now'}
          </button>
        </Row>

        {updateMsg ? (
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              lineHeight: 1.55,
              color: ui.textSecondary,
              background: ui.surfaceAlt,
              border: `1px solid ${ui.borderHair}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            {updateMsg}
          </p>
        ) : null}
      </div>
    </section>
  );
}
