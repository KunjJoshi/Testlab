import type { CSSProperties } from 'react'

export interface SuitePalette {
  name: string
  /** Strong colour: buttons, rules, the blob itself. */
  base: string
  /** Pastel used for card grounds and highlights. */
  soft: string
  /** Faint wash for page backgrounds. */
  tint: string
  /** Readable text colour on `soft`. */
  ink: string
}

const PALETTES: SuitePalette[] = [
  { name: 'terracotta', base: '#c4532f', soft: '#f3cdb9', tint: '#faeee6', ink: '#5e2310' },
  { name: 'lagoon', base: '#1e7a70', soft: '#bfe3db', tint: '#e9f5f1', ink: '#0d3b35' },
  { name: 'ochre', base: '#b7811a', soft: '#f2deaa', tint: '#fbf3df', ink: '#4f3606' },
  { name: 'plum', base: '#7d3c6c', soft: '#e6c7dc', tint: '#f6ebf2', ink: '#3b1532' },
  { name: 'moss', base: '#5a7a2c', soft: '#d6e3b8', tint: '#f1f5e6', ink: '#2a3a10' },
  { name: 'cobalt', base: '#2f55a4', soft: '#c6d4f0', tint: '#ebf0fa', ink: '#13244d' },
  { name: 'rosewood', base: '#b0435b', soft: '#f1c8d0', tint: '#fbecef', ink: '#521726' },
  { name: 'indigo', base: '#4c4a8f', soft: '#d3d1ee', tint: '#efeef9', ink: '#211f4a' },
]

/** Deterministic: the same suite is always the same colour, everywhere. */
export function suitePalette(suiteId: number): SuitePalette {
  return PALETTES[Math.abs(suiteId) % PALETTES.length] ?? PALETTES[0]!
}

export function suiteStyle(suiteId: number): CSSProperties {
  const p = suitePalette(suiteId)
  return {
    '--suite': p.base,
    '--suite-soft': p.soft,
    '--suite-tint': p.tint,
    '--suite-ink': p.ink,
  } as CSSProperties
}
