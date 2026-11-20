# Screenshots, checks and media

This folder renders the plugin's **real panel code** (`panel/`) in headless Chrome, against stubbed
data, and uses that for two things:

- **Checks** (`run.py`): 101 scenarios that load the panel at exact widths, click, type, press
  keys and scroll, and fail on the first thing that is wrong. They double as an end-to-end test of the
  panel.
- **Media** (`media.py`): the images in `docs/images/` (README and website) and a short animation, drawn from
  a made-up DEMO dataset. The posters (Orca catalog, GitHub cover, icon) are made by `scripts/media/`, from the
  same fixture and dataset.

Nothing here talks to a running Orca, reads your agents, projects or paths, or writes outside the
folders named below. The panel runs in an isolated page with a fake `orca` object.

## Requirements

- Run everything **from the repository root**; no machine-specific paths are used.
- `node` (18 or newer), `python3` (3.9 or newer, standard library only) and Chrome or Chromium.
- TypeScript **5 or 6** to transpile the panel (TypeScript 7 is a native build without the JavaScript
  API). `render.cjs` looks for it at `$TYPESCRIPT_PATH` (the path of a `typescript.js`), then as a
  `typescript` package the repo can resolve, and otherwise fetches it with
  `npx --yes --package typescript@5`, so a plain checkout works with network access once.
- Chrome is found at `$CHROME` (a path to the executable), the macOS app bundles for Google Chrome or
  Chromium, or `google-chrome`, `chromium` and friends on `PATH`.
- Media only: `ffmpeg` (GIF) and optionally `gif2webp` (WebP) for the animation. Without them the
  still images are still written and the animation step says what is missing.

```sh
CHROME=/path/to/chrome TYPESCRIPT_PATH=/path/to/typescript/lib/typescript.js python3 scripts/shots/run.py
```

## Run the checks

```sh
python3 scripts/shots/run.py                      # all scenarios, about a minute and a half
python3 scripts/shots/run.py --only grid,drawer   # some of them
python3 scripts/shots/run.py --shots /tmp/shots   # also save a screenshot of each scenario
```

Each line is `<width> <scenario> {"result": "PASS", ...}`; the run ends with `N scenarios passed`
and exits non-zero at the first failure. A scenario is a name that `fixture.js` knows (its data and
its in-page `must(...)` assertions) plus a width in the list at the top of `run.py` (keyboard, wheel and
drag checks that need real input events live in `run.py`). To add one, extend `fixture.js` and add its
`(width, name)` to `scenarios`.

## Regenerate the media

```sh
python3 scripts/shots/media.py                       # everything into docs/images/ (a few minutes)
python3 scripts/shots/media.py --only office,drawer  # some of them
python3 scripts/shots/media.py --out /tmp/images     # somewhere else
python3 scripts/shots/sizes.py                       # list sizes, check the catalog and GitHub rules
```

How it works:

1. `render.cjs` bundles `panel/main.ts` and its imports into `panel/index.html`, with `fixture.js` (the
   stubbed `orca` API and the checks) and `demo.js` (the DEMO dataset). `?scenario=media` selects the DEMO.
2. `media.py` opens that page in Chrome at a fixed CSS width, **device scale factor 2** (so a 420px panel
   becomes an 840px PNG, and every pixel-art pixel is a whole number of device pixels), waits 8 seconds
   for people to walk to their seats and speech bubbles to settle, and takes the picture.
3. The page's clock is set (`?hour=`): the dark images show the room windows at 21:30, the light ones at
   11:00, so the pictures do not depend on when you run it.

The DEMO dataset (`demo.js`) has 12 invented agents across four invented projects (Atlas web app, Beacon API,
Compass docs, Drift mobile app): working, needs-you, quiet (**Stuck?**), waiting, done and failed agents; a
coordinator (Wren) with workers in other worktrees, linked by reported parent and by an exact child id;
tokens today and context fill (Codex agents show a percentage; Claude Code logs state no window, so they
show tokens only, like the real panel); bubbles; and task titles. All paths, names and links are made up
(`/demo/...`, `https://example.com/...`).

Some images leave parts of the real UI out so the picture ends on whole rows: `media.py` does that with a few lines of injected CSS, e.g. hiding the tab row or all but
the first two agents of a room. It never changes the panel code or the data it shows, and says so
where it does it.

### Images and sizes

CSS size is the panel's layout size; the PNG is that times the device scale factor. Heights vary with
the content, so only the widths are fixed. Run `python3 scripts/shots/sizes.py` for the current
numbers.

| File | CSS size × scale | What it shows |
| --- | --- | --- |
| `office.png` | 420 wide × 2 | Office, list, dark: Atlas web app and Beacon API with their agent rows |
| `office-light.png` | 420 wide × 2 | The same by day, light theme |
| `office-grid.png` | 900 wide × 2 | Office in Grid, two rooms side by side |
| `activity.png` | 900 wide × 2 | Activity: one connected org chart per project |
| `attention.png` | 900 wide × 2 | Activity with **Needs attention** on |
| `attention-inbox.png` | 420 wide × 2 | Attention queue: Needs input, Failed to review and Finished to review |
| `notification-controls.png` | 420 wide × 2 | Project mute and the three reminder snooze choices alongside visible agents |
| `drawer.png` | 420 × 950 × 2 | Agent drawer: Go to agent, instruction box, context and tokens |
| `bubbles.png` | 420 wide × 2 | Two rooms close up: **Need you!**, **Stuck?**, a reply and **Failed** bubbles |
| `settings.png` | 420 wide × 2 | The Settings tab |
| `office.webp` / `office.gif` | 420 wide × 1 | Looping animation: Kai finishes, walks to the coffee machine and says so, then starts a new task and walks back |

The animation is real-time: `media.py` takes screenshots in a loop while it pushes two state changes to
the panel (finished, then working again), keeps each frame for as long as it took to capture, and
encodes a GIF (ffmpeg palette) and a WebP (`gif2webp`).

### Limits `sizes.py` checks

- `cover.png`: exactly 1280 × 640, under 1 MB (GitHub's social preview).
- Orca catalog (`catalog/`): cover 1600 × 1000, 16:10, at most 1024 KB; at most six screenshots, 16:10
  between 1280 × 800 and 2560 × 1600, each at most 1536 KB; icon square, 128 to 256 px, at most 256 KB; all
  images together under 8 MB.

Current sizes (from `python3 scripts/shots/sizes.py`):

```
activity.png                  1800 x 1613       196 KB
attention-inbox.png            840 x 2314       203 KB
attention.png                 1800 x 1613       205 KB
bubbles.png                    840 x 932         45 KB
catalog/activity.png          1600 x 1000       211 KB
catalog/attention.png         1600 x 1000       175 KB
catalog/context.png           1600 x 1000       184 KB
catalog/cover.png             1600 x 1000       174 KB
catalog/drawer.png            1600 x 1000       177 KB
catalog/office.png            1600 x 1000       217 KB
catalog/palettes.png          1600 x 1000       197 KB
cover.png                     1280 x 640        135 KB
drawer.png                     840 x 1900       150 KB
icon.png                       256 x 256         34 KB
notification-controls.png      840 x 1877       166 KB
office-grid.png               1800 x 2523       350 KB
office-light.png               840 x 2672       252 KB
office.gif                     420 x 635         88 KB
office.png                     840 x 2672       250 KB
office.webp                    420 x 635         92 KB
settings.png                   840 x 1573       179 KB
total                                          3681 KB
```

## Files

| File | Role |
| --- | --- |
| `run.py` | The check scenarios (Chrome over the DevTools protocol) |
| `media.py` | The DEMO images and the animation |
| `sizes.py` | Prints and checks image sizes |
| `cdp.py` | Finds Chrome, builds the fixture, a small DevTools client (shared) |
| `../media/` | The posters (catalog, GitHub cover, icon), built on `cdp.py` and the same fixture |
| `render.cjs` | Bundles the panel and the fixture into one HTML file |
| `fixture.js` | The stubbed `orca` API, test data and the in-page checks |
| `demo.js` | The DEMO dataset for the media |
