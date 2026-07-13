export const FOOD_CATEGORIES = [
  'Chinese',
  'Japanese',
  'Indian',
  'Western',
  'Malay',
  'Korean',
  'Thai',
  'Fast Food',
  'Cafe',
] as const

export type FoodCategory = (typeof FOOD_CATEGORIES)[number]

/*
	- Solid accent colors (map popups, focus card)
*/
export const categoryColors: Record<string, string> = {
  Chinese: '#C2410C',
  Japanese: '#BE185D',
  Indian: '#B45309',
  Western: '#1D4ED8',
  Malay: '#047857',
  Korean: '#6D28D9',
  Thai: '#0F766E',
  'Fast Food': '#DC2626',
  Cafe: '#57534E',
}

/*
	- Soft chip styles (sidebar badges)
*/
export const categoryStyles: Record<string, { bg: string; color: string }> = {
  Indian: { bg: '#FEF3C7', color: '#B45309' },
  Chinese: { bg: '#FFEDD5', color: '#C2410C' },
  Japanese: { bg: '#FCE7F3', color: '#BE185D' },
  Western: { bg: '#DBEAFE', color: '#1D4ED8' },
  Malay: { bg: '#D1FAE5', color: '#047857' },
  Korean: { bg: '#EDE9FE', color: '#6D28D9' },
  Thai: { bg: '#CCFBF1', color: '#0F766E' },
  Cafe: { bg: '#F5F5F4', color: '#57534E' },
  'Fast Food': { bg: '#FEE2E2', color: '#DC2626' },
}

export function categoryChipStyle(category: string) {
  return categoryStyles[category] ?? { bg: '#F3F4F6', color: '#4B5563' }
}

export function categoryAccent(category: string) {
  return categoryColors[category] ?? '#4B5563'
}
