# Posters

The Orca catalog images, the GitHub social preview and the icon: a headline, one plain sentence and the
**real panel** in a device frame, on a navy-to-dusk backdrop with amber accents. The panel pictures come
from the same isolated fixture and DEMO dataset as `scripts/shots` (made-up projects and people, nothing
from a real machine), so every poster shows what the panel really draws.

```sh
python3 scripts/media/render.py                          # everything into docs/images/ (about 3 minutes)
python3 scripts/media/render.py --only cover,office      # some of them
python3 scripts/media/render.py --out /tmp/images        # somewhere else
python3 scripts/shots/sizes.py                           # check sizes against the catalog and GitHub rules
```

Run it from the repository root. It needs `node`, `python3` (standard library only) and Chrome or Chromium, found
the way `scripts/shots/README.md` describes (`$CHROME`, the macOS app bundles, or `PATH`). The first run may fetch
TypeScript with `npx`, as the shots do. The headlines use the system sans-serif (`system-ui`), so the letter shapes
follow the machine that renders them.

## What it makes

| Name | File | Size | Shows |
| --- | --- | --- | --- |
| `cover` | `docs/images/catalog/cover.png` | 1600 × 1000 | Kicker, the pixel title with the orca, a tagline, four feature pills and two real rooms with speech bubbles |
| `social` | `docs/images/cover.png` | 1280 × 640 | The same cover, laid out for the GitHub social preview |
| `office` | `docs/images/catalog/office.png` | 1600 × 1000 | Every agent, every worktree, one glance: the Office in Grid, two rooms |
| `attention` | `docs/images/catalog/attention.png` | 1600 × 1000 | Know who needs you: two rooms with Need you!, Stuck?, Failed and a finished reply |
| `activity` | `docs/images/catalog/activity.png` | 1600 × 1000 | See who started whom: an org chart with a coordinator and its workers |
| `drawer` | `docs/images/catalog/drawer.png` | 1600 × 1000 | Jump in without hunting tabs: the drawer with Go to agent and the instruction box |
| `context` | `docs/images/catalog/context.png` | 1600 × 1000 | Context and tokens, per agent: a closer crop of the drawer's context line |
| `palettes` | `docs/images/catalog/palettes.png` | 1600 × 1000 | Make it yours: the light theme, with the daytime window |
| `icon` | `docs/images/icon.png` | 256 × 256 | The orca on the dusk backdrop, enlarged 6× without smoothing |

The catalog takes the cover and up to six screenshots (`orca-plugin.json` lists them with their captions and alt
text). `scripts/shots/media.py` still makes the README and website images.

## How it works

1. `render.py` builds the fixture (`scripts/shots/render.cjs`), opens it in headless Chrome at a layout width
   chosen so the panel lands on the poster **pixel for pixel** (the device scale is the frame width divided by the
   layout width), lets the people walk to their desks, and takes a PNG of the panel. A few lines of injected CSS
   leave parts of the real UI out (the banner, the tab row, all but the first two agents of a room) so a frame ends
   on whole rows; the panel code and its data are never changed.
2. `poster.html` (and `cover.html` for the two covers, `icon.html` for the icon) lays that picture out in a frame
   next to the text, driven by query parameters, and Chrome takes the final PNG. The pixel title and the orca are
   `docs/images/title.svg` and `docs/images/orca.svg` at a whole number of pixels per art pixel with
   `image-rendering: pixelated`.
3. The backdrop is drawn by `render.py` as a small plain PNG that the page scales up, not as a CSS gradient:
   Chrome dithers CSS gradients and the noise adds about half a megabyte to each poster.

To change a poster, edit its entry in `POSTERS` at the top of `render.py` (headline, sentence, which side the
text is on, where the frame sits and how wide the panel is laid out) and run it again with `--only <name>`.
The sentences and captions must stay true to the code; the limits that belong to the panel (chat agents cannot be
typed into, Claude's logs state no context window) are documented in the README and are not hidden by anything
here other than the cropping described above.

## Limits

`scripts/shots/sizes.py` checks them: the catalog cover is 1600 × 1000 and at most 1 MB, each catalog screenshot
is 16:10 and at most 1.5 MB, the icon is square, 128 to 256 px and at most 256 KB, the GitHub cover is 1280 × 640
and under 1 MB, and all images together stay under 8 MB.
