export const colors = {
  // Backgrounds
  background: '#0E0F14',
  backgroundSecondary: '#161820',
  surface: '#1C1E2A',
  surfaceSecondary: '#232536',
  surfaceBorder: '#2A2D3E',

  // Brand
  primary: '#00C896',
  primaryDark: '#00A87E',
  primaryLight: '#00C89620',

  // Gradient colors (used in balance card)
  gradientStart: '#00C896',
  gradientEnd: '#0066FF',

  // Accent
  accent: '#7C3AED',
  accentLight: '#7C3AED20',

  // Text
  textPrimary: '#F0F2F5',
  textSecondary: '#8B90A7',
  textTertiary: '#555870',

  // Borders
  border: '#2A2D3E',

  // Status
  success: '#00C896',
  successLight: '#00C89615',
  danger: '#FF4D6A',
  dangerLight: '#FF4D6A15',
  warning: '#FFB547',
  warningLight: '#FFB54715',

  // Transaction
  debit: '#FF4D6A',
  credit: '#00C896',
  self: '#7C3AED',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
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
  xl: 24,
  xxl: 32,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  captionMedium: { fontSize: 13, fontWeight: '600' as const },
  amount: { fontSize: 36, fontWeight: '700' as const, letterSpacing: -1 },
  amountLarge: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -2 },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
};