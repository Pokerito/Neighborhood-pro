export const theme = {
  color: {
    surface: '#FAFAF9',
    onSurface: '#1C1917',
    surfaceSecondary: '#FFFFFF',
    onSurfaceSecondary: '#292524',
    surfaceTertiary: '#F5F5F4',
    onSurfaceTertiary: '#44403C',
    surfaceInverse: '#292524',
    onSurfaceInverse: '#FAFAF9',
    brand: '#C65D47',
    brandSecondary: '#E68D79',
    brandTertiary: '#FCEBE6',
    onBrandTertiary: '#8F3D2B',
    success: '#4D7C5D',
    warning: '#D99530',
    error: '#B94A48',
    info: '#526D82',
    border: '#E7E5E4',
    borderStrong: '#D6D3D1',
    muted: '#78716C',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    xs: 11, sm: 12, base: 14, md: 15, lg: 16, xl: 20, xxl: 24, xxxl: 30,
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    lifted: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
    },
  },
};

export type Theme = typeof theme;
