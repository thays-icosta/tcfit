// TcFit visual identity: the official logo is black and white, so the whole
// interface is built from black + graphite + white + gray. White is the only
// accent. There is no orange and no blue anywhere.
//
// Semantic status colors (success / danger / warning) are the one exception:
// they carry meaning (done, error, attention), not brand, and stay.
//
// Most screens still declare their colors inline (the values below were
// applied across them in one pass); new code should import from here.

export const COLORS = {
  background: '#08090B', // app background
  card: '#121419', // cards, sheets, modals
  cardAlt: '#181B21', // nested / secondary surfaces
  border: '#292D34',
  text: '#FFFFFF',
  textSecondary: '#A7AAB0',
  textMuted: '#737373',
  accent: '#FFFFFF', // the only accent
  onAccent: '#08090B', // text/icons on a white (accent) surface
  accentSoft: '#D1D5DB', // secondary emphasis (formerly blue/purple/pink info tints)

  // Meaning, not brand:
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

export const ACCENT = COLORS.accent;
