// BetterMate Design Tokens — single source of truth
// Every component must import from here, never hardcode colors

export const colors = {
  // Backgrounds
  bgDeep:        '#06030f',
  bgBase:        '#0e0720',
  bgCard:        'rgba(124,58,237,0.06)',
  bgCardHover:   'rgba(124,58,237,0.10)',

  // Borders
  borderCard:    'rgba(124,58,237,0.12)',
  borderActive:  '#7c3aed',
  borderSubtle:  '#2a1645',
  borderVisible: '#6d4fa0',   // use instead of borderSubtle for checkboxes/inputs

  // Brand
  purple:        '#7c3aed',
  pink:          '#db2777',
  gradient:      'linear-gradient(135deg,#7c3aed,#db2777)',

  // Text — ALWAYS use these, never hardcode
  textPrimary:   '#ffffff',          // headings, key labels
  textSecondary: '#c4b5fd',          // body, descriptions
  textMuted:     '#9d84d0',          // counters, hints, placeholders
  textDisabled:  '#3a2a65',          // truly disabled only
  textLink:      '#a78bfa',          // links, numbered badges

  // Chips / tags
  chipActive:    '#c4b5fd',
  chipInactive:  '#a08cc0',          // was #6a5a8a — now readable
  chipDisabled:  '#3a2a65',

  // Status
  success:       '#4ade80',
  warning:       '#fbbf24',
  error:         '#f87171',
} as const;

export const fonts = {
  serif:  "'Georgia',serif",
  sans:   'system-ui,sans-serif',
} as const;

export const radii = {
  card:   16,
  sub:    14,
  chip:   50,
  input:  12,
} as const;

export type Colors = typeof colors;
