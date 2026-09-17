/**
 * Minimal design tokens for Phase 3's auth screens. This gets expanded
 * significantly in Phase 16 (UI polish) — kept small and deliberate for now
 * so early screens are visually consistent without over-investing in a
 * design system before the rest of the app's screens exist.
 */
export const colors = {
  primary: '#0B5FFF',
  primaryDark: '#0A4FD6',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  danger: '#DC2626',
  success: '#16A34A',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
