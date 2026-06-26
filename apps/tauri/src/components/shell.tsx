import { Link, Outlet } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
import { ui } from '../lib/ui';

/**
 * App shell: top bar + nav sidebar + routed pane.
 */

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 400,
  color: ui.textSecondary,
  textDecoration: 'none',
};

const activeRowStyle: CSSProperties = {
  ...rowStyle,
  background: ui.accentTint,
  color: ui.accentDark,
  fontWeight: 500,
};

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Playground',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <title>Playground</title>
        <path
          d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <title>Settings</title>
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M8 1.8v1.4M8 12.8v1.4M14.2 8h-1.4M3.2 8H1.8M12.4 3.6l-1 1M4.6 11.4l-1 1M12.4 12.4l-1-1M4.6 4.6l-1-1"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function Shell() {
  return (
    <div
      style={{
        fontFamily: ui.font,
        color: ui.ink,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: ui.surface,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          flex: 'none',
          height: 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: `1px solid ${ui.border}`,
          background: ui.surface,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              background: ui.accent,
              display: 'inline-block',
            }}
          />
          <span
            style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}
          >
            Saasflare Desktop
          </span>
        </div>
      </header>

      <div
        style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}
      >
        <nav
          style={{
            flex: 'none',
            width: 196,
            borderRight: `1px solid ${ui.border}`,
            background: ui.surfaceAlt,
            display: 'flex',
            flexDirection: 'column',
            padding: '14px 12px',
            gap: 2,
          }}
        >
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{ ...rowStyle, justifyContent: 'flex-start' }}
              activeProps={{
                style: { ...activeRowStyle, justifyContent: 'flex-start' },
              }}
              activeOptions={{ exact: item.to === '/' }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
