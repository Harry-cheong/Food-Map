/*
- Build a Google web search URL for a restaurant.
- Prefers name + address so results match the listed place.
*/
export function googleSearchUrl(name: string, address?: string | null): string {
  const query = [name.trim(), address?.trim()].filter(Boolean).join(' ')
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}
