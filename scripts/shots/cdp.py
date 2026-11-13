"""Shared by run.py and media.py: build the fixture, find Chrome, drive it over the DevTools protocol.

Standard library only. Chrome is found through $CHROME or the usual install locations.
"""
import base64, contextlib, json, os, pathlib, shutil, socket, struct, subprocess, tempfile, time, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent

CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome',
]


def find_chrome():
    """$CHROME wins; then the macOS app bundles, then Chrome or Chromium on PATH."""
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    for candidate in CHROME_CANDIDATES:
        found = candidate if os.path.isabs(candidate) and os.access(candidate, os.X_OK) else shutil.which(candidate)
        if found:
            return found
    raise SystemExit('Chrome not found: install Google Chrome or Chromium, or set CHROME to its executable.')


def build_fixture(out):
    """Writes the isolated fixture page (the real panel code with stubbed data) to `out`."""
    subprocess.run(['node', str(HERE / 'render.cjs'), str(out)], check=True, cwd=ROOT)
    return pathlib.Path(out).resolve()


class Chrome:
    """One headless Chrome with one page, spoken to over a bare WebSocket."""

    def __init__(self, extra_args=()):
        self.seq = 0
        self.profile = tempfile.mkdtemp(prefix='lobby-chrome-')
        self.proc = subprocess.Popen(
            [find_chrome(), '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
             '--force-color-profile=srgb', '--remote-debugging-port=0', f'--user-data-dir={self.profile}',
             *extra_args, 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        portfile = pathlib.Path(self.profile) / 'DevToolsActivePort'
        for _ in range(400):
            if portfile.exists():
                break
            if self.proc.poll() is not None:
                raise RuntimeError(f'Chrome exited before opening DevTools: {self.proc.returncode}')
            time.sleep(.05)
        port = int(portfile.read_text().splitlines()[0])
        tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list'))
        host, route = tabs[0]['webSocketDebuggerUrl'].removeprefix('ws://').split('/', 1)
        self.sock = socket.create_connection(('127.0.0.1', int(host.split(':')[1])))
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(f'GET /{route} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'.encode())
        response = self.sock.recv(4096)
        if b' 101 ' not in response:
            raise RuntimeError(response.decode(errors='replace'))
        self.command('Page.enable')
        self.command('Emulation.setFocusEmulationEnabled', {'enabled': True})

    def close(self):
        self.proc.terminate()
        with contextlib.suppress(subprocess.TimeoutExpired):
            self.proc.wait(timeout=10)
        shutil.rmtree(self.profile, ignore_errors=True)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def _read_exact(self, n):
        data = b''
        while len(data) < n:
            chunk = self.sock.recv(n - len(data))
            if not chunk:
                raise RuntimeError('DevTools connection closed')
            data += chunk
        return data

    def command(self, method, params=None):
        self.seq += 1
        payload = json.dumps({'id': self.seq, 'method': method, 'params': params or {}}).encode()
        mask = os.urandom(4)
        length = len(payload)
        header = bytes([0x81, 0x80 | (length if length < 126 else 126 if length < 65536 else 127)])
        if length >= 126:
            header += struct.pack('!H' if length < 65536 else '!Q', length)
        self.sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
        while True:
            a, b = self._read_exact(2)
            length = b & 127
            if length == 126:
                length = struct.unpack('!H', self._read_exact(2))[0]
            elif length == 127:
                length = struct.unpack('!Q', self._read_exact(8))[0]
            if b & 128:
                remote_mask = self._read_exact(4)
            data = self._read_exact(length)
            if b & 128:
                data = bytes(v ^ remote_mask[i % 4] for i, v in enumerate(data))
            if (a & 15) != 1:
                continue
            msg = json.loads(data)
            if msg.get('id') == self.seq:
                if 'error' in msg:
                    raise RuntimeError(str(msg['error']))
                return msg.get('result', {})

    def evaluate(self, expression, await_promise=False):
        """The value of a JavaScript expression in the page."""
        result = self.command('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': await_promise})
        if 'exceptionDetails' in result:
            raise RuntimeError('page error: ' + json.dumps(result['exceptionDetails'])[:400])
        return result['result'].get('value')

    def viewport(self, width, height, scale=1):
        self.command('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': scale, 'mobile': False})

    def media(self, reduced_motion=False):
        self.command('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if reduced_motion else 'no-preference'}]})

    def screenshot(self, clip=None, fmt='png'):
        """PNG bytes of the viewport, or of `clip` ({x, y, width, height} in CSS pixels)."""
        params = {'format': fmt}
        if clip:
            params['clip'] = {**clip, 'scale': 1}
        return base64.b64decode(self.command('Page.captureScreenshot', params)['data'])

    def open(self, url, timeout=8):
        """Loads a fixture URL and returns what the page reported once it settled."""
        self.command('Page.navigate', {'url': url})
        return self.evaluate(
            "new Promise(resolve=>{const n=setInterval(()=>{if(document.body?.dataset.fixture){clearInterval(n);resolve({result:document.body.dataset.fixture,width:innerWidth,errors:document.body.dataset.errors})}},25);"
            f"setTimeout(()=>{{clearInterval(n);resolve({{result:'TIMEOUT'}})}},{int(timeout * 1000)})}})",
            await_promise=True)
