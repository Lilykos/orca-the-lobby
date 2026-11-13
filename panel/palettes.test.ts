import { assert, test } from 'orca/testing'
import { DEFAULT_PREFS } from '../src/protocol'
import { contrastRatio, PALETTES, PALETTE_OPTIONS, paletteVariables } from './palettes'
import { paletteFor } from './scene'

test('offers Orca default and the five requested named palettes', () => {
  assert.deepEqual(PALETTE_OPTIONS.map((option) => option.label), [
    'Orca default', 'Catppuccin Mocha', 'Catppuccin Latte', 'Dracula', 'GitHub Dark', 'GitHub Light'
  ])
  assert.equal(DEFAULT_PREFS.palette, 'orca')
})

test('palette variables apply locally and Orca default clears them to follow the host', () => {
  assert.deepEqual(paletteVariables('catppuccin-mocha'), {
    '--lobby-background': PALETTES['catppuccin-mocha'].background,
    '--lobby-foreground': PALETTES['catppuccin-mocha'].foreground,
    '--lobby-muted': PALETTES['catppuccin-mocha'].muted,
    '--lobby-card': PALETTES['catppuccin-mocha'].card,
    '--lobby-border': PALETTES['catppuccin-mocha'].border,
    '--lobby-accent': PALETTES['catppuccin-mocha'].accent
  })
  assert.equal(paletteVariables('orca'), null)
})

test('each palette has valid hex colors and readable text contrast', () => {
  for (const [name, colors] of Object.entries(PALETTES)) {
    if (name === 'orca') continue
    for (const color of [colors.background, colors.foreground, colors.muted, colors.card, colors.border, colors.accent])
      assert.match(color, /^#[\da-f]{6}$/i, `${name} color ${color}`)
    assert.ok(contrastRatio(colors.foreground, colors.background) >= 4.5, `${name} foreground on background`)
    assert.ok(contrastRatio(colors.foreground, colors.card) >= 4.5, `${name} foreground on card`)
    assert.ok(contrastRatio(colors.muted, colors.card) >= 4.5, `${name} muted text on card`)
  }
})

test('scene palette uses explicit light and dark choices independent of the app theme', () => {
  assert.equal(paletteFor('catppuccin-mocha', false).night, true)
  assert.equal(paletteFor('catppuccin-latte', true).night, false)
  assert.equal(paletteFor('github-dark', false).wall, PALETTES['github-dark'].background)
  assert.equal(paletteFor('github-light', true).wall, '#ededed')
})
