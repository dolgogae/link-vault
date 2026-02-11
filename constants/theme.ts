export const Colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#3B82F6',
  accent: '#F59E0B',
  accentDark: '#D97706',

  light: {
    text: '#111827',
    textSecondary: '#6B7280',
    background: '#FFFFFF',
    surface: '#F9FAFB',
    border: '#E5E7EB',
    tint: '#2563EB',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#2563EB',
  },
  dark: {
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    background: '#121212',
    surface: '#1E1E1E',
    border: '#374151',
    tint: '#3B82F6',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#3B82F6',
  },
} as const;

export type ThemeColors = typeof Colors.light;
