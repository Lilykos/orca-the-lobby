import { assert, test } from 'orca/testing'
import { BANNER_ROWS, BANNER_TITLE, drawBanner } from './banner'

test('draws The Lobby without clipping title or mascot at narrow and wide widths', () => {
  const fills: { columns: number; color: string; x: number; y: number; width: number; height: number }[] = []
  let fillStyle = ''
  let columns = 0
  const context = {
    set fillStyle(color: string) { fillStyle = color },
    get fillStyle() { return fillStyle },
    fillRect: (x: number, y: number, width: number, height: number) =>
      fills.push({ columns, color: fillStyle, x, y, width, height })
  } as unknown as CanvasRenderingContext2D
  for (const width of [40, 72, 116, 316, 800]) {
    columns = width
    drawBanner(context, width, 0)
  }
  assert.equal(BANNER_TITLE, 'the lobby')
  assert.ok(fills.some((fill) => fill.color === '#ffffff'))
  assert.ok(fills.some((fill) => fill.color === '#0e1017'))
  assert.ok(fills.some((fill) => fill.color === '#7b88b0'))
  assert.ok(fills.every((fill) => fill.x >= 0 && fill.x + fill.width <= fill.columns &&
    fill.y >= 0 && fill.y + fill.height <= BANNER_ROWS))
  const finePixelRows = new Set(fills.filter((fill) => fill.columns === 116 && fill.color === '#ffffff' && fill.x < 70 && fill.width > 1).map((fill) => fill.y))
  assert.ok(finePixelRows.size >= 8)
})

test('sets the two words on separate left-aligned lines', () => {
  const title: { x: number; y: number; width: number }[] = []
  let color = ''
  let mascotStarted = false
  const context = {
    set fillStyle(value: string) {
      color = value
      if (value === '#7b88b0') mascotStarted = true
    },
    fillRect: (x: number, y: number, width: number) => {
      if (color === '#ffffff' && !mascotStarted) title.push({ x, y, width })
    }
  } as unknown as CanvasRenderingContext2D
  drawBanner(context, 116, 0)
  const rows = [...new Set(title.map((fill) => fill.y))].sort((a, b) => a - b)
  const breakIndex = rows.findIndex((row, index) => index > 0 && row - rows[index - 1] > 2)
  assert.ok(breakIndex > 0)
  const first = title.filter((fill) => fill.y < rows[breakIndex])
  const second = title.filter((fill) => fill.y >= rows[breakIndex])
  assert.equal(Math.min(...first.map((fill) => fill.x)), Math.min(...second.map((fill) => fill.x)))
  assert.ok(Math.max(...second.map((fill) => fill.x + fill.width)) > Math.max(...first.map((fill) => fill.x + fill.width)))
})

test('keeps title and mascot pixels on the grid at readable widths', () => {
  const pixels: number[][] = []
  const context = {
    fillStyle: '',
    fillRect: (...rectangle: number[]) => pixels.push(rectangle)
  } as unknown as CanvasRenderingContext2D
  for (const columns of [40, 71, 116, 317]) drawBanner(context, columns, 0)
  assert.ok(pixels.every((rectangle) => rectangle.every(Number.isInteger)))
})
