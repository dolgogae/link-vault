export const Colors = {
  primary: '#8000C8',
  primaryDark: '#6600A0',
  primaryLight: '#9B30D9',
  accent: '#F59E0B',
  accentDark: '#D97706',

  light: {
    text: '#111827',
    textSecondary: '#6B7280',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    border: '#E5E7EB',
    tint: '#8000C8',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#8000C8',
  },
  dark: {
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    background: '#121212',
    surface: '#1E1E1E',
    border: '#374151',
    tint: '#9B30D9',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#9B30D9',
  },
} as const;

export type ThemeColors = typeof Colors.light;
