export const BANNER_TITLE = 'the lobby'
// Fixed serif pixels keep the typewriter lettering crisp without a runtime font.
// prettier-ignore
const SIGN = [
  '.#....##.........',
  '.#.....#.........',
  '####...###...###.',
  '.#.....#..#.#...#',
  '.#.....#..#.#####',
  '.#..#..#..#.#....',
  '..##..##..#..###.',
  '',
  '',
  '###.........##....##.........',
  '..#..........#.....#.........',
  '..#....###...###...###..##.##',
  '..#...#...#..#..#..#..#..#.#.',
  '..#...#...#..#..#..#..#..#.#.',
  '..#...#...#..#..#..#..#...#..',
  '#####..###..####..####....#..',
  '.........................#...',
  '........................##...'
]

/** The office's orca, standing on its tail in a tie with a cup of coffee. `B` is its black, `W`
 *  its white, `K` its smile, `R` the tie, `C` the cup, `O` the coffee and `S` the steam. */
// prettier-ignore
const ORCA = [
  '.............BB.............',
  '............BBB.............',
  '...........BBBB.............',
  '...........BBBBB............',
  '.........BBBBBBBBB..........',
  '.......BBBBBBBBBBBBB........',
  '......BBBBBBBBBBBBBBB.......',
  '.....BBBBBBBBBBBBBBBBB......',
  '.....BBWWWWBBBBBWWWWBB......',
  '.....BBBWWWBBBBBWWWBBB......',
  '.....BBBBBBBBBBBBBBBBB......',
  '.....BBBBWWWWWWWWWBBBB......',
  '......BBWWWWWWWWWWWBB.......',
  '......BWWWKWWWWWKWWWB.......',
  '......BWWWWKKKKKWWWWB.......',
  '....BBBWWWWWRRRWWWWWBBB.....',
  '...BBBBWWWWWWRWWWWWWBBBB.SS.',
  '..BBBBBWWWWWRRRWWWWWBBBBB.S.',
  '..BBB.BWWWWWRRRWWWWWB.BBBOOO',
  '..BB..BWWWWRRRRRWWWWB..BCCCC',
  '......BWWWWRRRRRWWWWB...CCCC',
  '......BWWWWWRRRWWWWWB...CCC.',
  '......BBWWWWWRWWWWWBB.......',
  '.......BBWWWWWWWWWBB........',
  '.......BBBWWWWWWWBBB........',
  '........BBBBBBBBBBB.........',
  '.........BBBBBBBBB..........',
  '...BB.....BBBBBBB.....BB....',
  '..BBBBB....BBBBB....BBBBB...',
  '..BBBBBBBBBBBBBBBBBBBBBBB...',
  '...BBBBBBBB.....BBBBBBBB....'
]
const ORCA_COLORS: Record<string, string> = {
  B: '#0e1017',
  W: '#ffffff',
  K: '#0e1017',
  R: '#d6323a',
  C: '#f4f1e8',
  O: '#6b4226',
  S: '#9aa3b5',
  // The line round it: black on a black sign would vanish.
  L: '#7b88b0'
}

/** The orca with a one-pixel line (`L`) round it. */
function outlined(rows: string[]): string[] {
  const width = rows[0].length + 2
  const grid = ['', ...rows, ''].map((row) => `.${row}`.padEnd(width, '.'))
  const filled = (x: number, y: number): boolean => (grid[y]?.[x] ?? '.') !== '.'
  return grid.map((row, y) =>
    [...row]
      .map((pixel, x) =>
        pixel === '.' &&
        (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))
          ? 'L'
          : pixel
      )
      .join('')
  )
}
const MASCOT = outlined(ORCA)

const GAP = 6
export const BANNER_ROWS = MASCOT.length + 7

/** Draws the sign, white on black, with the orca beside it, centred across `columns` banner
 *  pixels; `beat` moves the steam off its coffee. A panel too narrow for both gets the words. */
export function drawBanner(ctx: CanvasRenderingContext2D, columns: number, beat: number): void {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, columns, BANNER_ROWS)
  const textWidth = Math.max(...SIGN.map((row) => row.length))
  const maxScale = Math.floor(BANNER_ROWS / SIGN.length)
  const pairedScale = Math.min(
    maxScale,
    Math.floor((columns - GAP - MASCOT[0].length) / textWidth)
  )
  const mascot = pairedScale >= 1
  const scale = mascot ? pairedScale : Math.min(maxScale, Math.floor(columns / textWidth) || columns / textWidth)
  const titleWidth = textWidth * scale
  const groupWidth = titleWidth + (mascot ? GAP + MASCOT[0].length : 0)
  const left = Math.max(0, Math.floor((columns - groupWidth) / 2))
  const top = Math.max(0, Math.floor((BANNER_ROWS - SIGN.length * scale) / 2))
  ctx.fillStyle = '#ffffff'
  SIGN.forEach((row, y) => {
    // One rectangle per run of lit pixels.
    for (const run of row.matchAll(/#+/g))
      ctx.fillRect(left + run.index * scale, top + y * scale, run[0].length * scale, scale)
  })
  if (!mascot) return
  MASCOT.forEach((row, y) => {
    ;[...row].forEach((pixel, x) => {
      // The steam is the one thing that moves: every other pixel of it, turn about.
      if (pixel === '.' || (pixel === 'S' && (x + y + Math.floor(beat / 2)) % 2)) return
      ctx.fillStyle = ORCA_COLORS[pixel]
      ctx.fillRect(left + titleWidth + GAP + x, Math.floor((BANNER_ROWS - MASCOT.length) / 2) + y, 1, 1)
    })
  })
}
