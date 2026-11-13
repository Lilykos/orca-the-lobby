import type { PaletteChoice } from '../src/protocol'

export type PaletteTokens = {
  label: string
  mode: 'dark' | 'light' | 'orca'
  background: string
  foreground: string
  muted: string
  card: string
  border: string
  accent: string
}

export const PALETTES: Record<PaletteChoice, PaletteTokens> = {
  orca: {
    label: 'Orca default', mode: 'orca',
    background: '#f5f5f7', foreground: '#1c1d22', muted: '#686b75',
    card: '#ffffff', border: '#e2e2e8', accent: '#4f8fe6'
  },
  'catppuccin-mocha': {
    label: 'Catppuccin Mocha', mode: 'dark',
    background: '#1e1e2e', foreground: '#cdd6f4', muted: '#a6adc8',
    card: '#181825', border: '#45475a', accent: '#cba6f7'
  },
  'catppuccin-latte': {
    label: 'Catppuccin Latte', mode: 'light',
    background: '#eff1f5', foreground: '#4c4f69', muted: '#5c5f77',
    card: '#e6e9ef', border: '#bcc0cc', accent: '#8839ef'
  },
  dracula: {
    label: 'Dracula', mode: 'dark',
    background: '#282a36', foreground: '#f8f8f2', muted: '#a0a8ca',
    card: '#21222c', border: '#44475a', accent: '#bd93f9'
  },
  'github-dark': {
    label: 'GitHub Dark', mode: 'dark',
    background: '#0d1117', foreground: '#e6edf3', muted: '#9198a1',
    card: '#161b22', border: '#30363d', accent: '#4493f8'
  },
  'github-light': {
    label: 'GitHub Light', mode: 'light',
    background: '#ffffff', foreground: '#1f2328', muted: '#656d76',
    card: '#f6f8fa', border: '#d1d9e0', accent: '#0969da'
  }
}

export const PALETTE_OPTIONS = Object.entries(PALETTES).map(([value, tokens]) => ({
  value: value as PaletteChoice,
  label: tokens.label
}))

export function paletteVariables(choice: PaletteChoice): Record<string, string> | null {
  if (choice === 'orca') return null
  const { background, foreground, muted, card, border, accent } = PALETTES[choice]
  return {
    '--lobby-background': background,
    '--lobby-foreground': foreground,
    '--lobby-muted': muted,
    '--lobby-card': card,
    '--lobby-border': border,
    '--lobby-accent': accent
  }
}

function linear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function contrastRatio(first: string, second: string): number {
  const luminance = (color: string): number => {
    const channels = [1, 3, 5].map((offset) => linear(parseInt(color.slice(offset, offset + 2), 16)))
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
