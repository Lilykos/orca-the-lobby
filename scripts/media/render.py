"""Renders the catalog posters, the GitHub social preview and the icon.

    python3 scripts/media/render.py [--only cover,office,...] [--out docs/images]

Each poster is two steps. First the REAL panel (panel/ with the DEMO dataset from scripts/shots/demo.js, the
same isolated fixture media.py uses) is rendered in headless Chrome at the exact pixel size the poster shows it
at, so nothing is resampled. Then poster.html / cover.html lay that picture out in a device frame beside the
headline, and Chrome takes the 1600x1000 (or 1280x640) PNG. Run from the repository root; needs Chrome.
"""
import argparse, json, math, pathlib, struct, sys, tempfile, time, urllib.parse, zlib

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'shots'))
from cdp import ROOT, Chrome, build_fixture  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
parser.add_argument('--only', help='comma-separated names (default: all)')
parser.add_argument('--out', type=pathlib.Path, default=ROOT / 'docs' / 'images')
args = parser.parse_args()

WALK = 10  # seconds for people to walk to their desks and bubbles to settle
NO_TABS = '#primary-tabs { visibility: hidden; height: 0; margin: 0; border: 0 }'


def backdrop(path, glow, shrink=4, size=(1600, 1000)):
    """The navy-to-dusk gradient with a coral horizon glow and an amber glow at `glow` (x, y as fractions), as a small PNG
    that the page scales up. Chrome dithers CSS gradients, and the noise makes a 1600x1000 PNG about 0.5 MB bigger;
    scaled up from a plain picture the gradient stays smooth and the posters stay small."""
    w, h = size[0] // shrink, size[1] // shrink
    stops = [(0, (13, 18, 32)), (.38, (20, 26, 42)), (.74, (43, 39, 72)), (1, (74, 53, 88))]
    length = (size[0] + size[1]) * math.sqrt(.5)
    rows = []
    for j in range(h):
        y = (j + .5) * shrink
        row = bytearray([0])
        for i in range(w):
            x = (i + .5) * shrink
            t = min(1, max(0, ((x - size[0] / 2) + (y - size[1] / 2)) * math.sqrt(.5) / length + .5))
            k = next(k for k in range(1, len(stops)) if t <= stops[k][0] or k == len(stops) - 1)
            (t0, c0), (t1, c1) = stops[k - 1], stops[k]
            f = (t - t0) / (t1 - t0)
            color = [c0[n] + (c1[n] - c0[n]) * f for n in range(3)]
            # Glows, listed bottom to top: coral along the lower edge, then amber behind the panel.
            for (cx, cy, rx, ry), rgb, alpha in (((.5, 1.08, .7, .45), (214, 104, 112), .34), ((glow[0], glow[1], .46, .38), (242, 193, 78), .26)):
                d = math.hypot((x / size[0] - cx) / rx, (y / size[1] - cy) / ry)
                a = alpha * max(0, 1 - d)
                color = [color[n] * (1 - a) + rgb[n] * a for n in range(3)]
            row.extend(round(v) for v in color)
        rows.append(bytes(row))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))
    return path


class Panel:
    """The fixture page at one layout width and device scale, so a CSS pixel shows as `scale` picture pixels."""

    def __init__(self, chrome, fixture, width, height, scale, **params):
        self.chrome, self.width, self.height, self.scale = chrome, width, height, scale
        chrome.viewport(width, height, scale)
        chrome.media(False)
        query = '&'.join(f'{k}={v}' for k, v in {'scenario': 'media', 'hour': 21.5, **params}.items())
        result = chrome.open(fixture.as_uri() + '?' + query)
        if result.get('result') != 'PASS' or result.get('errors'):
            raise RuntimeError(f'fixture failed: {result}')
        time.sleep(WALK)

    def js(self, expression):
        return self.chrome.evaluate(expression, await_promise='await' in expression or 'Promise' in expression)

    def click(self, key):
        self.js(f'document.querySelector(\'[data-focus-key="{key}"]\').click()')
        time.sleep(.5)

    def tab(self, name):
        self.js(f"document.querySelector('#{name}-tab').click(); window.scrollTo(0, 0)")
        time.sleep(.8)

    def style(self, css):
        """Leaves parts of the real UI out of the picture (hidden, never changed); the panel code and data stay as they are."""
        self.js(f"document.head.append(Object.assign(document.createElement('style'), {{textContent: {json.dumps(css)}}}))")
        # The scene lays out people from the height of what is above it, so let it measure again.
        self.js("window.dispatchEvent(new Event('resize'))")
        time.sleep(5)  # and for people to walk to where they now belong

    def box(self, selector, nth=0):
        return self.js(f"(()=>{{const r=document.querySelectorAll({json.dumps(selector)})[{nth}].getBoundingClientRect();return {{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height}}}})()")

    def shot(self, path, clip=None):
        """The viewport (or `clip`, in CSS px) as a PNG: width x height CSS px times the scale."""
        clip = clip or {'x': 0, 'y': 0, 'width': self.width, 'height': self.height}
        path.write_bytes(self.chrome.screenshot(clip))
        return path


# name -> how the panel is shown. `frame` is the panel's rectangle on the poster (x, y, w, h in px); the panel
# is laid out `layout` CSS px wide and rendered at frame width / layout, so it lands pixel for pixel.
FIT = '.roster li:nth-child(n+3) { display: none } '
POSTERS = {
    'office': dict(
        kicker='The Lobby', headline='Every agent, every worktree, one glance.',
        text='One room per project and one pixel person per agent, across all your worktrees.',
        side='r', frame=(690, 90, 880, 820), layout=640, cw=550, fit=('.office', 1),
        panel=dict(layout='grid', only='atlas-web,beacon-api', css=FIT + 'body { padding-top: 14px } ' + NO_TABS)),
    'attention': dict(
        kicker='The Lobby', headline='Know what needs a look.',
        text='One live queue for agents who need input and results to review.',
        side='l', frame=(110, 70, 560, 860), layout=440, fit=('#attention-list', 0),
        panel=dict(scenario='attentionmedia', css='#banner, #primary-tabs, #view-filters, #prefs-status, .notification-controls { display: none } body { padding-top: 12px }')),
    'activity': dict(
        kicker='The Lobby', headline='See who started whom.',
        text='An org chart per project, with the exact parent and worker links Orca reports. Never guessed.',
        side='l', frame=(110, 120, 800, 760), layout=530, tab='activity', cw=520, fit=('.chart-block', 0),
        panel=dict(only='atlas-web', css='#banner { display: none } body { padding-top: 8px }')),
    'drawer': dict(
        kicker='The Lobby', headline='Jump in without hunting tabs.',
        text='Open any agent to go straight to it, or send it an instruction, right from the drawer.',
        side='r', frame=(1010, 60, 500, 880), layout=370, click='office-row:a1-quinn',
        panel=dict(css='#banner, .details, .drawer-fine { display: none } body { padding-top: 10px }')),
    'context': dict(
        kicker='The Lobby', headline='Context and tokens, per agent.',
        text='How full each context window is and how many tokens each agent and project used today.',
        side='l', frame=(110, 200, 560, 600), layout=340, click='office-row:a1-quinn',
        panel=dict(css='#banner, .details, .drawer-fine, .drawer-actions, .sheet-body > .drawer-part + .drawer-part { display: none } body { padding-top: 10px }')),
    'palettes': dict(
        kicker='The Lobby', headline='Make it yours.',
        text='Day or night at the window, Orca\u2019s own theme or one of five palettes.',
        side='r', frame=(690, 90, 880, 820), layout=640, cw=550, fit=('.office', 1),
        panel=dict(layout='grid', theme='light', hour=11, only='atlas-web,beacon-api', css=FIT + 'body { padding-top: 14px } ' + NO_TABS)),
}


def poster(chrome, fixture, name, scratch):
    cfg = POSTERS[name]
    fx, fy, fw, fh = cfg['frame']
    scale = fw / cfg['layout']
    params = dict(cfg['panel'])
    css = params.pop('css', '')
    # With `fit`, the frame ends on the bottom of that element (a whole room or row) and is centred on the poster.
    page = Panel(chrome, fixture, cfg['layout'], 1600 if cfg.get('fit') else round(fh / scale), scale, **params)
    if cfg.get('tab'):
        page.tab(cfg['tab'])
    if cfg.get('click'):
        page.click(cfg['click'])
        time.sleep(1)
    page.style(css)
    clip = None
    if cfg.get('fit'):
        selector, nth = cfg['fit']
        box = page.box(selector, nth)
        fh = round((box['y'] + box['height'] + 10) * scale)
        fy = (1000 - fh) // 2
        clip = {'x': 0, 'y': 0, 'width': page.width, 'height': fh / scale}
    image = page.shot(scratch / f'{name}-panel.png', clip)
    bg = backdrop(scratch / f'{name}-bg.png', ((fx + fw / 2) / 1600, (fy + fh / 2) / 1000))
    query = dict(k=cfg['kicker'], t=cfg['headline'], c=cfg['text'], img=image.as_uri(), bg=bg.as_uri(), side=cfg['side'], fx=fx, fy=fy, fw=fw, fh=fh, cw=cfg.get('cw', 600))
    return compose(chrome, 'poster.html', query, 1600, 1000, args.out / 'catalog' / f'{name}.png')


def compose(chrome, html, query, width, height, out):
    chrome.viewport(width, height, 1)
    chrome.command('Page.navigate', {'url': (HERE / html).as_uri() + '?' + urllib.parse.urlencode(query)})
    for _ in range(200):
        time.sleep(.1)
        if chrome.evaluate("document.body && document.body.dataset.ready === '1'"):
            break
    else:
        raise RuntimeError(f'{html} did not finish loading')
    time.sleep(.3)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(chrome.screenshot())
    print(f'{out.relative_to(args.out.parent) if out.is_relative_to(args.out.parent) else out}  {out.stat().st_size / 1024:.0f} KB')


def cover(chrome, fixture, scratch, fmt=None):
    """The catalog cover (1600x1000) or the GitHub social preview (1280x640): the copy, and two real rooms of the Office
    with their speech bubbles. Panel width is chosen so one art pixel is a whole number of picture pixels."""
    social = fmt == 'social'
    fw, layout, right = (420, 330, 72) if social else (640, 380, 110)
    scale = fw / layout
    page = Panel(chrome, fixture, layout, 1600, scale, fresh=1, only='atlas-web,beacon-api')
    page.style('#banner, .room-usage, .roster { display: none } .page-bar, #primary-tabs { display: none } body { padding: 0 }')
    box = page.box('.office', 1)
    fh = round((box['y'] + box['height']) * scale)
    image = page.shot(scratch / f'cover-{fmt or "catalog"}.png', {'x': 0, 'y': 0, 'width': layout, 'height': fh / scale})
    width, height = (1280, 640) if social else (1600, 1000)
    bg = backdrop(scratch / f'cover-bg-{fmt or "catalog"}.png', ((width - right - fw / 2) / width, .5), size=(width, height))
    query = dict(img=image.as_uri(), bg=bg.as_uri(), fw=fw, fh=fh, right=right, **({'fmt': 'social'} if social else {}))
    out = args.out / 'cover.png' if social else args.out / 'catalog' / 'cover.png'
    compose(chrome, 'cover.html', query, 1280 if social else 1600, 640 if social else 1000, out)


IMAGES = {name: (lambda chrome, fixture, scratch, name=name: poster(chrome, fixture, name, scratch)) for name in POSTERS}

IMAGES['icon'] = lambda chrome, fixture, scratch: compose(chrome, 'icon.html', {}, 256, 256, args.out / 'icon.png')
IMAGES['cover'] = cover
IMAGES['social'] = lambda chrome, fixture, scratch: cover(chrome, fixture, scratch, 'social')

wanted = args.only.split(',') if args.only else list(IMAGES)
unknown = [name for name in wanted if name not in IMAGES]
if unknown:
    sys.exit('unknown image: ' + ', '.join(unknown))
with tempfile.TemporaryDirectory(prefix='lobby-media-') as scratch, Chrome() as chrome:
    scratch = pathlib.Path(scratch)
    fixture = build_fixture(scratch / 'fixture.html')
    for name in wanted:
        IMAGES[name](chrome, fixture, scratch)
