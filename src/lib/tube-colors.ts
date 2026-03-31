/** London Underground line color palette */
export const TUBE_LINES = [
  { name: 'Central', hex: '#E32017', css: '4 85% 49%' },
  { name: 'Victoria', hex: '#0098D4', css: '197 100% 42%' },
  { name: 'District', hex: '#00782A', css: '147 100% 24%' },
  { name: 'Piccadilly', hex: '#003688', css: '218 100% 27%' },
  { name: 'Northern', hex: '#1A1A1A', css: '0 0% 10%' },
  { name: 'Metropolitan', hex: '#9B0056', css: '327 100% 30%' },
  { name: 'Circle', hex: '#FFD300', css: '48 100% 50%' },
  { name: 'Bakerloo', hex: '#B36305', css: '30 90% 36%' },
  { name: 'Jubilee', hex: '#A0A5A9', css: '210 4% 65%' },
  { name: 'Hammersmith', hex: '#F3A9BB', css: '345 76% 81%' },
  { name: 'Elizabeth', hex: '#6950A1', css: '259 30% 47%' },
  { name: 'Overground', hex: '#EE7C0E', css: '27 89% 49%' },
  { name: 'Waterloo', hex: '#95CDBA', css: '155 35% 69%' },
] as const;

export type TubeLineName = typeof TUBE_LINES[number]['name'];

/** Pick the next available tube color not yet used by existing projects */
export function getNextAvailableColor(existingColors: (string | null)[]): string {
  const used = new Set(existingColors.filter(Boolean));
  for (const line of TUBE_LINES) {
    if (!used.has(line.hex)) return line.hex;
  }
  // All used — loop back
  return TUBE_LINES[existingColors.length % TUBE_LINES.length].hex;
}

/** Get tube line info by hex color */
export function getTubeLineByHex(hex: string | null | undefined) {
  if (!hex) return TUBE_LINES[0];
  return TUBE_LINES.find(l => l.hex === hex) ?? TUBE_LINES[0];
}
