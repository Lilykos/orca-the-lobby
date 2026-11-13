"""Lists docs/images with pixel sizes and file sizes, and fails if one breaks a rule.

    python3 scripts/shots/sizes.py [docs/images]

Rules: the GitHub social preview (cover.png) is 1280x640 and under 1 MB; the Orca catalog set in catalog/ is
cover 1600x1000 (16:10, <= 1024 KB) and screenshots 16:10 between 1280x800 and 2560x1600 (<= 1536 KB each, at
most six); the icon is square, 128..256 px and <= 256 KB; everything together stays under 8 MB.
"""
import pathlib, struct, sys

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2] / 'docs' / 'images'


def dimensions(path):
    head = path.read_bytes()[:64]
    if head[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', head[16:24])
    if head[:6] in (b'GIF87a', b'GIF89a'):
        return struct.unpack('<HH', head[6:10])
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        if head[12:16] == b'VP8X':
            return 1 + int.from_bytes(head[24:27], 'little'), 1 + int.from_bytes(head[27:30], 'little')
    raise ValueError(f'unknown image format: {path}')


problems = []
total = 0
catalog_shots = 0
for path in sorted(p for p in root.rglob('*') if p.is_file() and p.suffix != '.svg'):
    width, height = dimensions(path)
    kib = path.stat().st_size / 1024
    total += path.stat().st_size
    name = path.relative_to(root).as_posix()
    print(f'{name:28} {width:5} x {height:<5} {kib:8.0f} KB')

    def need(ok, message):
        if not ok:
            problems.append(f'{name}: {message}')

    if name == 'cover.png':
        need((width, height) == (1280, 640) and kib < 1024, 'the GitHub social preview must be 1280x640 and under 1 MB')
    elif name == 'icon.png':
        need(width == height and 128 <= width <= 256 and kib <= 256, 'the icon must be square, 128..256 px and <= 256 KB')
    elif name == 'catalog/cover.png':
        need((width, height) == (1600, 1000) and kib <= 1024, 'the catalog cover must be 1600x1000 and <= 1024 KB')
    elif name.startswith('catalog/'):
        catalog_shots += 1
        need(width * 10 == height * 16 and 1280 <= width <= 2560 and kib <= 1536, 'a catalog screenshot must be 16:10, 1280..2560 wide and <= 1536 KB')
    elif name == 'office.webp' or name == 'office.gif':
        need(kib <= 3072, 'the animation should stay under about 3 MB')
need(catalog_shots <= 6, 'the catalog takes at most six screenshots')
need(total <= 8 * 1024 * 1024, 'all images together must stay under 8 MB')
print(f'{"total":28} {"":13} {total / 1024:8.0f} KB')
if problems:
    sys.exit('\n'.join(problems))
