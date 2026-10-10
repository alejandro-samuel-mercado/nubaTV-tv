/**
 * Nuba TV – Color System (TV version)
 * Matches the web design: dark warm bg + amber/orange accent palette.
 */

export const C = {
  // ── Backgrounds ─────────────────────────────────────────────
  bgBase:        '#080808',   // same as web --bg-base
  bgPanel:       '#0a0502',   // same as web --bg-panel (warm dark)
  bgCard:        '#0f0a06',   // warm card background
  bgCardHover:   '#1a0f05',   // warm hover

  // ── Text ────────────────────────────────────────────────────
  textPrimary:   '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.5)',
  textMuted:     'rgba(255, 255, 255, 0.3)',

  // ── Accent palette — Amber/Orange/Fire (matches web) ────────
  accent:        '#ffb703',   // --tv-cyan: ámbar brillante
  accentOrange:  '#ff9100',   // --tv-lime: naranja medio
  accentFire:    '#ff5500',   // --tv-orange: naranja intenso
  accentLight:   '#ffedd8',   // --tv-pink: crema/blanco
  accentWhite:   '#ffffff',   // --tv-blue: blanco puro

  // Glow / border variants
  accentGlow:    'rgba(255, 183, 3, 0.18)',
  accentBorder:  'rgba(255, 183, 3, 0.35)',

  // ── Semantic ─────────────────────────────────────────────────
  live:          '#ff4d80',
  liveDot:       '#ffedd8',

  // ── Borders ──────────────────────────────────────────────────
  borderSubtle:  'rgba(255, 255, 255, 0.06)',
  borderMedium:  'rgba(255, 183, 3, 0.2)',

  // ── Row accent colors (matches web COLORS array) ─────────────
  rowColors: [
    '#ff9100',  // naranja
    '#ffb703',  // ámbar
    '#fb8500',  // naranja fuerte
    '#ffba08',  // amarillo dorado
    '#fca311',  // naranja claro
  ],
} as const;

/** Pick a deterministic accent color for a category row by name */
export function rowColor(title: string): string {
  const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return C.rowColors[hash % C.rowColors.length];
}
