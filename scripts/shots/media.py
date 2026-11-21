"""Regenerates the README / website images from the DEMO dataset in the isolated fixture.

    python3 scripts/shots/media.py [--only office,cover] [--out docs/images]

Every image is rendered in headless Chrome at a fixed CSS width and device scale factor 2, so a 420px
panel becomes an 840px-wide PNG. The sizes are listed in scripts/shots/README.md. Nothing here reads
a real Orca, a real project or the current time of day: demo.js is the only data.
"""
import argparse, json, pathlib, shutil, subprocess, sys, tempfile, time

from cdp import ROOT, Chrome, build_fixture

SCALE = 2
# Seconds for people to walk in and sit down before a picture is taken.
WALK = 8
parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
parser.add_argument('--only', help='comma-separated image names (default: all)')
parser.add_argument('--out', type=pathlib.Path, default=ROOT / 'docs' / 'images')
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)


class Page:
    """One fixture URL at one width, with the helpers the images share."""

    def __init__(self, chrome, html, width, height=1600, scale=SCALE, **params):
        self.chrome = chrome
        chrome.viewport(width, height, scale)
        chrome.media(False)
        query = '&'.join(f'{k}={v}' for k, v in {'scenario': 'media', **params}.items())
        result = chrome.open(html.as_uri() + '?' + query)
        if result.get('result') != 'PASS' or result.get('errors'):
            raise RuntimeError(f'fixture failed: {result}')
        self.width = width
        self.settle(WALK)

    def js(self, expression):
        return self.chrome.evaluate(expression, await_promise='await' in expression or 'Promise' in expression)

    def settle(self, seconds=.4):
        time.sleep(seconds)

    def click(self, key):
        self.js(f'document.querySelector(\'[data-focus-key="{key}"]\').click()')
        self.settle()

    def tab(self, name):
        self.js(f"document.querySelector('#{name}-tab').click(); window.scrollTo(0, 0)")
        self.settle(.8)

    def box(self, selector, nth=0):
        """The CSS-pixel rectangle of the nth element matching `selector`, relative to the page."""
        return self.js(f"(()=>{{const r=document.querySelectorAll({json.dumps(selector)})[{nth}].getBoundingClientRect();return {{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height}}}})()")

    def style(self, css):
        """Adds a stylesheet to the page; only used to leave parts of the real UI out of a composed picture."""
        self.js(f"document.head.append(Object.assign(document.createElement('style'), {{textContent: {json.dumps(css)}}}))")
        self.settle(.5)

    def shot(self, name, through=None, viewport=False, only_scene=False, start=None):
        """Writes <name>.png: the page from the top down to the bottom of the `through` element (plus a margin),
        or the whole page, or just the viewport."""
        full = self.js('Math.ceil(document.documentElement.scrollHeight)')
        top = 0
        if viewport:
            height = self.js('innerHeight')
        elif through:
            box = self.box(*through)
            height = box['y'] + box['height'] + 12
            if only_scene:
                top, height = (self.box(*start) if start else box)['y'] - 8, box['y'] + box['height'] + 8
        else:
            height = full
        clip = {'x': 0, 'y': top, 'width': self.width, 'height': min(height, full) - top}
        path = args.out / f'{name}.png'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(self.chrome.screenshot(clip))
        print(f'{name}.png  {self.width}x{round(clip["height"])} CSS px')
        return clip


def office(chrome, html):
    page = Page(chrome, html, 420, hour=21.5)
    page.shot('office', through=('.office', 1))


def office_grid(chrome, html):
    page = Page(chrome, html, 900, hour=21.5, layout='grid')
    page.shot('office-grid', through=('.office', 1))


def office_light(chrome, html):
    page = Page(chrome, html, 420, hour=11, theme='light')
    page.shot('office-light', through=('.office', 1))


def activity(chrome, html):
    page = Page(chrome, html, 900, hour=21.5)
    page.tab('activity')
    page.shot('activity', through=('.chart-block', 1))


def attention(chrome, html):
    page = Page(chrome, html, 900, hour=21.5)
    page.tab('activity')
    page.click('filter:attention')
    page.settle(1)
    page.shot('attention', through=('.chart-block', 1))


def attention_inbox(chrome, html):
    page = Page(chrome, html, 420, hour=21.5, scenario='attentionmedia')
    page.shot('attention-inbox', through=('#attention-list', 0))


def notification_controls(chrome, html):
    page = Page(chrome, html, 420, hour=21.5, scenario='notificationmedia')
    page.tab('settings')
    page.click('notification:agent:need:snooze:manual')
    page.shot('notification-controls', through=('.notification-controls', 0))


def drawer(chrome, html):
    page = Page(chrome, html, 420, height=950, hour=21.5)
    page.click('office-row:a1-quinn')
    page.settle(1)
    page.shot('drawer', viewport=True)


def bubbles(chrome, html):
    page = Page(chrome, html, 420, hour=21.5, fresh=1, only='atlas-web,beacon-api')
    page.style('.roster, .room-usage { display: none }')
    page.shot('bubbles', through=('.office', 1), start=('.office', 0), only_scene=True)


# The banner is as wide as the tab bar, so the tabs are only hidden, not removed.
NO_TABS = '#primary-tabs { visibility: hidden; height: 0; margin: 0; border: 0 }'


def settings(chrome, html):
    page = Page(chrome, html, 420, hour=21.5, only='atlas-web')
    page.tab('settings')
    page.shot('settings', through=('#settings', 0))


# One loop of the animated office: Kai finishes (walks to the coffee machine, says so), then starts a new task
# and walks back to their desk, so the end matches the start. Times are seconds from the start of recording.
LOOP = 9.0
FPS = 10


def office_animation(chrome, html):
    """office.webp / office.gif: a few seconds of the office with people walking and speech bubbles."""
    if not shutil.which('ffmpeg'):
        print('office animation skipped: ffmpeg is not installed')
        return
    page = Page(chrome, html, 420, scale=1, hour=21.5, only='atlas-web,beacon-api')
    page.style('.roster, .room-usage, .page-bar { display: none } body { padding-top: 12px } ' + NO_TABS)
    page.js("""(() => {
      window.demoBase = JSON.parse(JSON.stringify(window.fixture))
      window.setKai = (state) => {
        const snapshot = JSON.parse(JSON.stringify(window.demoBase))
        const kai = snapshot.agents.find((agent) => agent.id === 's3-kai')
        const now = Date.now()
        if (state === 'done') Object.assign(kai, { state: 'done', outcome: 'success', unread: true, finishedAt: now, stateStartedAt: now, reply: 'Validation is in, tests pass.', active: [] })
        window.pushSnapshot(snapshot)
      }
    })()""")
    box = page.box('.office', 1)
    clip = {'x': 0, 'y': 0, 'width': 420, 'height': round(box['y'] + box['height'] + 12)}
    frames = pathlib.Path(tempfile.mkdtemp(prefix='lobby-frames-'))
    events = [(.5, "setKai('done')"), (4.8, "setKai('working')")]
    stamps = []
    start = time.perf_counter()
    index = 0
    while (elapsed := time.perf_counter() - start) < LOOP:
        while events and elapsed >= events[0][0]:
            page.js(events.pop(0)[1])
        (frames / f'{index:04d}.png').write_bytes(chrome.screenshot(clip))
        stamps.append(time.perf_counter() - start)
        index += 1
        time.sleep(max(0, 1 / FPS - (time.perf_counter() - start - stamps[-1])))
    # Frames are shown for as long as they really took to capture.
    durations = [b - a for a, b in zip(stamps, stamps[1:])] + [1 / FPS]
    listing = frames / 'frames.txt'
    listing.write_text(''.join(f"file '{f.name}'\nduration {d:.4f}\n" for f, d in zip(sorted(frames.glob('*.png')), durations)))
    gif = args.out / 'office.gif'
    palette = frames / 'palette.png'
    ffmpeg = ['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing)]
    subprocess.run(ffmpeg + ['-vf', 'palettegen=max_colors=96:stats_mode=full', str(palette)], check=True)
    subprocess.run(ffmpeg + ['-i', str(palette), '-lavfi', 'paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', str(gif)], check=True)
    size = gif.stat().st_size
    print(f'office.gif  {clip["width"]}x{clip["height"]} CSS px, {index} frames, {size / 1e6:.2f} MB')
    if shutil.which('gif2webp'):
        webp = args.out / 'office.webp'
        subprocess.run(['gif2webp', '-m', '6', '-mixed', '-q', '90', str(gif), '-o', str(webp)], check=True, capture_output=True)
        print(f'office.webp {webp.stat().st_size / 1e6:.2f} MB')
    shutil.rmtree(frames, ignore_errors=True)


IMAGES = {fn.__name__.replace('_', '-'): fn for fn in (office, office_grid, office_light, activity, attention, attention_inbox, notification_controls, drawer, bubbles, settings, office_animation)}

wanted = args.only.split(',') if args.only else list(IMAGES)
unknown = [name for name in wanted if name not in IMAGES]
if unknown:
    sys.exit('unknown image: ' + ', '.join(unknown))
with tempfile.TemporaryDirectory(prefix='lobby-fixture-') as scratch, Chrome() as chrome:
    html = build_fixture(pathlib.Path(scratch) / 'fixture.html')
    for name in wanted:
        IMAGES[name](chrome, html)
