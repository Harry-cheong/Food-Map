/*
	- Escape a string for safe insertion into HTML (e.g. Leaflet popup content).
	- Prevents user-supplied names/descriptions from being interpreted as markup.
*/
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
