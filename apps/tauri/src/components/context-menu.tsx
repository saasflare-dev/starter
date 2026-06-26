import { type CSSProperties, useState } from 'react';
import { ui } from '../lib/ui';

export interface ContextItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextItem[];
}

/** Tracks an open right-click menu (position + items). */
export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const open = (e: React.MouseEvent, items: ContextItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  };
  const close = () => setMenu(null);
  return { menu, open, close };
}

/** Floating right-click menu, clamped into the viewport. */
export function ContextMenu({
  menu,
  onClose,
}: {
  menu: MenuState | null;
  onClose: () => void;
}) {
  if (!menu) return null;
  // Rough clamp so the menu doesn't overflow the window edges.
  const width = 184;
  const left = Math.min(menu.x, window.innerWidth - width - 8);
  const top = Math.min(menu.y, window.innerHeight - menu.items.length * 36 - 8);
  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'transparent',
          border: 'none',
          cursor: 'default',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left,
          top,
          zIndex: 1001,
          minWidth: width,
          background: ui.surface,
          border: `1px solid ${ui.borderSoft}`,
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
          padding: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {menu.items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              borderRadius: 7,
              padding: '8px 10px',
              fontSize: 13.5,
              fontFamily: ui.font,
              color: item.danger ? ui.fail : ui.ink,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = item.danger
                ? 'rgba(220,38,38,0.08)'
                : ui.surfaceAlt;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

export interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  background: 'rgba(15,15,18,0.32)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

/** Modal confirmation. Destructive sidebar actions chain two of these. */
export function ConfirmDialog({
  confirm,
  onClose,
}: {
  confirm: ConfirmState | null;
  onClose: () => void;
}) {
  if (!confirm) return null;
  return (
    <div style={overlayStyle}>
      <div
        style={{
          width: '100%',
          maxWidth: 340,
          background: ui.surface,
          borderRadius: 16,
          padding: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.24)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: ui.ink }}>
          {confirm.title}
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: ui.textSecondary,
          }}
        >
          {confirm.body}
        </p>
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: `1px solid ${ui.borderStrong}`,
              borderRadius: 9,
              background: ui.surface,
              padding: '8px 14px',
              fontSize: 13.5,
              fontWeight: 500,
              color: ui.ink,
              cursor: 'pointer',
              fontFamily: ui.font,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              confirm.onConfirm();
            }}
            style={{
              border: 'none',
              borderRadius: 9,
              background: confirm.danger ? ui.fail : ui.accent,
              padding: '8px 14px',
              fontSize: 13.5,
              fontWeight: 500,
              color: '#fff',
              cursor: 'pointer',
              fontFamily: ui.font,
            }}
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
