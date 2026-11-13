"""Writes docs/images/title.svg and docs/images/orca.svg from the pixel art in panel/banner.ts.

Run from the repo root: python3 scripts/site/pixel-art.py
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parents[2]
source = (root / 'panel/banner.ts').read_text()


def rows(name):
    block = re.search(rf"const {name} = \[(.*?)\n\]", source, re.S).group(1)
    return re.findall(r"'([^']*)'", block)


COLORS = {'B': '#0e1017', 'W': '#ffffff', 'K': '#0e1017', 'R': '#d6323a', 'C': '#f4f1e8',
          'O': '#6b4226', 'S': '#9aa3b5', 'L': '#7b88b0'}


def outlined(grid):
    width = len(grid[0]) + 2
    padded = ['', *grid, '']
    padded = [('.' + r).ljust(width, '.') for r in padded]
    filled = lambda x, y: 0 <= y < len(padded) and 0 <= x < width and padded[y][x] != '.'
    return [''.join('L' if p == '.' and (filled(x - 1, y) or filled(x + 1, y) or filled(x, y - 1) or filled(x, y + 1)) else p
                    for x, p in enumerate(r)) for y, r in enumerate(padded)]


def svg(grid, color_of, label):
    width, height = max(len(r) for r in grid), len(grid)
    paths = {}
    for y, r in enumerate(grid):
        for m in re.finditer(r'(.)\1*', r):
            if m.group(1) == '.':
                continue
            color = color_of(m.group(1))
            paths.setdefault(color, []).append(f'M{m.start()} {y}h{len(m.group(0))}v1h-{len(m.group(0))}z')
    body = ''.join(f'<path fill="{c}" d="{"".join(d)}"/>' for c, d in paths.items())
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
            f'shape-rendering="crispEdges" role="img" aria-label="{label}">{body}</svg>\n')


out = root / 'docs/images'
out.mkdir(parents=True, exist_ok=True)
(out / 'title.svg').write_text(svg(rows('SIGN'), lambda c: '#ffffff', 'the lobby'))
(out / 'orca.svg').write_text(svg(outlined(rows('ORCA')), lambda c: COLORS[c], 'The Lobby mascot: a pixel orca in a red tie holding a coffee'))
