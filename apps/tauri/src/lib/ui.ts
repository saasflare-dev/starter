/**
 * Design tokens for the desktop app chrome (header, sidebar, panes, dialogs).
 * A neutral starting palette — Geist type, a blue accent, white/paper surfaces,
 * translucent-ink hairlines. Swap `accent*` and the type stack for your brand.
 *
 * Scope: the app shell only. Inline styles read from here so the template has
 * no CSS build step; move to your styling system of choice if you prefer.
 */
export const ui = {
  font: "'Geist', 'Inter', system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",

  // accent
  accent: '#3B82F6',
  accentDark: '#1D4ED8', // labels on light surfaces
  accentTint: '#EAF1FE', // active sidebar item
  rowSelected: '#F2F7FF', // selected list row

  // ink / text
  ink: '#0F0F12',
  textSecondary: '#535359',
  muted: '#86868D',
  faint: '#B8B8BE',

  // surfaces
  surface: '#FFFFFF',
  surfaceAlt: '#FAFAFA',

  // hairline borders (always translucent ink, never solid gray)
  border: 'rgba(15,15,18,0.07)',
  borderHair: 'rgba(15,15,18,0.06)',
  borderStrong: 'rgba(15,15,18,0.16)',
  borderSoft: 'rgba(15,15,18,0.08)',

  // status (connection dot, etc.)
  ok: '#16A34A',
  warn: '#F59E0B',
  fail: '#DC2626',
} as const;
