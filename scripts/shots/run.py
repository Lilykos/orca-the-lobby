"""Runs the panel fixture's check scenarios in headless Chrome: an end-to-end test of the real panel code.

    python3 scripts/shots/run.py [--only linked,grid] [--shots DIR]

Every scenario loads the fixture at an exact CSS width, waits for its in-page checks to report PASS and,
for some, presses keys and wheels over the DevTools protocol. Screenshots (the inspector, the map and the
office at each width) are only written with --shots. Exits non-zero at the first failure.
"""
import argparse, json, pathlib, sys, tempfile, time

from cdp import Chrome, build_fixture

parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
parser.add_argument('--only', help='comma-separated scenario names to run (default: all)')
parser.add_argument('--shots', type=pathlib.Path, help='write the per-scenario screenshots to this folder')
parser.add_argument('--fixture', type=pathlib.Path, help='use this prebuilt fixture page instead of building one')
args = parser.parse_args()
out = args.shots
if out:
    out.mkdir(parents=True, exist_ok=True)

scenarios = [(280, 'linked'), (320, 'linked'), (420, 'linked'), (900, 'linked'), (280, 'peers'), (420, 'peers'), (900, 'peers'), (420, 'cycle'), (420, 'unknown'), (420, 'noid'), (420, 'storagefail'), (420, 'clearfail'), (420, 'light'), (420, 'reduced'), (280, 'many'), (420, 'many'), (900, 'many'), (420, 'stale'), (420, 'multiple'), (420, 'states'), (420, 'projects'), (420, 'departure'), (420, 'clearsuccess'), (280, 'attention'), (420, 'attention'), (900, 'attention'), (420, 'attentionempty'), (280, 'attentionempty'), (280, 'big'), (420, 'big'), (900, 'big'), (280, 'parentlink'), (420, 'parentlink'), (900, 'parentlink'), (280, 'parentnote'), (420, 'parentnote'), (340, 'grid'), (420, 'grid'), (900, 'grid'), (280, 'drawer'), (420, 'drawer'), (900, 'drawer'), (420, 'drawerkeyboard'), (420, 'drawer-reduced'), (420, 'drawertab'), (420, 'drawerfocus')]
# Each feature adds its own runs on its own line below.
scenarios += [(280, 'actions'), (420, 'actions'), (900, 'actions'), (420, 'actionslive')]  # terminal actions
scenarios += [(280, 'context'), (420, 'context'), (900, 'context')]  # context
scenarios += [(280, 'bubbles'), (420, 'bubbles'), (420, 'bubblesgrid'), (900, 'bubblesgrid'), (420, 'bubblesmotion'), (280, 'emojibubble'), (420, 'emojibubble')]  # bubbles
scenarios += [(280, 'attentionview'), (420, 'attentionview'), (900, 'attentionview'), (280, 'attentioncapture'), (420, 'attentioncapture'), (900, 'attentioncapture'), (420, 'attentionkeyboard'), (420, 'attentionlast'), (420, 'attentionarrival'), (420, 'attentionpending'), (420, 'attentionfail'), (420, 'attentionaction'), (420, 'attentionstale'), (420, 'attentionreappear'), (420, 'attentionemptyview'), (900, 'attentionlive'), (420, 'searchviews'), (420, 'projectgone'), (280, 'preferences'), (420, 'preferences'), (900, 'preferences'), (420, 'newinstall'), (420, 'delayedfresh'), (420, 'legacynoprefs'), (420, 'prefsreadfail'), (420, 'installationunknown'), (420, 'prefshydration'), (420, 'prefsrace'), (420, 'prefsreadrecover'), (420, 'prefsackrace'), (420, 'installationrecover'), (420, 'installationrecoverchoice')]  # inbox, shared filters and startup preference
scenarios += [(420, 'sharedbanner')]
scenarios += [(280, 'settingsconsolidation'), (420, 'settingsconsolidation'), (900, 'settingsconsolidation')]
scenarios += [(280, 'notificationcontrols'), (420, 'notificationcontrols'), (900, 'notificationcontrols'), (420, 'notificationerrors'), (420, 'notificationstale'), (420, 'notificationreadstale'), (420, 'notificationexpiry'), (420, 'notificationkeys'), (420, 'notificationfocus')]  # local notification controls

if args.only:
    wanted = set(args.only.split(','))
    unknown = wanted - {name for _, name in scenarios}
    if unknown: sys.exit('unknown scenario: ' + ', '.join(sorted(unknown)))
    scenarios = [s for s in scenarios if s[1] in wanted]

with tempfile.TemporaryDirectory(prefix='lobby-fixture-') as scratch, Chrome() as chrome:
    command = chrome.command
    html = args.fixture.resolve() if args.fixture else build_fixture(pathlib.Path(scratch) / 'fixture.html')
    for width, scenario in scenarios:
        command('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
        command('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if scenario in ('reduced', 'drawer-reduced', 'notificationkeys') else 'no-preference'}]})
        command('Page.navigate', {'url': html.as_uri() + '?scenario=' + scenario + ('&theme=light' if scenario == 'light' else '')})
        if scenario == 'notificationfocus':
            def wait_for_stage(stage):
                for _ in range(200):
                    value = command('Runtime.evaluate', {'expression': 'window.notificationFocusStage', 'returnByValue': True})['result'].get('value')
                    if value == stage: return
                    time.sleep(.025)
                raise RuntimeError(f'fixture did not reach {stage}')
            def key(name, code, vk, modifiers=0, text=''):
                command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': name, 'code': code, 'windowsVirtualKeyCode': vk, **({'modifiers': modifiers} if modifiers else {}), **({'text': text, 'unmodifiedText': text} if text else {})})
                command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': name, 'code': code, 'windowsVirtualKeyCode': vk, **({'modifiers': modifiers} if modifiers else {})})
            wait_for_stage('mutePending')
            command('Runtime.evaluate', {'expression': "document.querySelector('.notification-controls input').focus()"})
            key('Tab', 'Tab', 9)
            if command('Runtime.evaluate', {'expression': "document.activeElement===document.querySelectorAll('.notification-controls input')[1]", 'returnByValue': True})['result'].get('value') is not True:
                raise RuntimeError('Tab did not move focus elsewhere while mute was pending')
            command('Runtime.evaluate', {'expression': 'window.continueNotificationFocusMute()'})
            wait_for_stage('snoozePending')
            command('Runtime.evaluate', {'expression': "document.querySelector('#office-tab').focus()"})
            key('Enter', 'Enter', 13, text='\r')
            if command('Runtime.evaluate', {'expression': "document.activeElement.id==='office-tab'&&!document.querySelector('#office-page').hidden", 'returnByValue': True})['result'].get('value') is not True:
                raise RuntimeError('Enter did not navigate away while snooze was pending')
            command('Runtime.evaluate', {'expression': 'window.continueNotificationFocusSnooze()'})
        wait_for_fixture = {'expression': "new Promise(resolve=>{const n=setInterval(()=>{if(document.body?.dataset.fixture){clearInterval(n);resolve({result:document.body.dataset.fixture,width:innerWidth,errors:document.body.dataset.errors})}},25);setTimeout(()=>{clearInterval(n);resolve({result:'TIMEOUT'})},5000)})", 'awaitPromise': True, 'returnByValue': True}
        try:
            result = command('Runtime.evaluate', wait_for_fixture)['result']['value']
        except RuntimeError as error:
            if scenario != 'prefsreadrecover' or 'navigated or closed' not in str(error): raise
            time.sleep(.2)
            result = command('Runtime.evaluate', wait_for_fixture)['result']['value']
        print(width, scenario, json.dumps(result))
        if result.get('result') != 'PASS' or result.get('width') != width or result.get('errors'): raise RuntimeError('fixture failed')
        if scenario == 'sharedbanner':
            for hidden in (True, False):
                command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r', 'unmodifiedText': '\r'})
                command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
                state = chrome.evaluate("({hidden:document.querySelector('#banner').hidden,focus:document.activeElement.id})")
                if state != {'hidden': hidden, 'focus': 'brand-toggle'}: raise RuntimeError('banner keyboard toggle lost focus or did not update: ' + str(state))
        if scenario == 'notificationkeys':
            command('Runtime.evaluate', {'expression': "document.querySelector('[data-focus-key=notification\\\\:project\\\\:p\\\\:mute]')?.focus()"})
            command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r', 'unmodifiedText': '\r'})
            command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
            time.sleep(.15)
            state = command('Runtime.evaluate', {'expression': "({status:document.querySelector('.notification-project-status')?.textContent,focus:document.activeElement?.dataset.focusKey})", 'returnByValue': True})['result']['value']
            if not state['status'] or 'muted' not in state['status'] or state['focus'] != 'notification:project:p:mute': raise RuntimeError('keyboard mute lost focus or did not acknowledge: ' + str(state))
        if scenario == 'attentionkeyboard':
            command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r', 'unmodifiedText': '\r'})
            command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
            time.sleep(.15)
            state = command('Runtime.evaluate', {'expression': "({removed:!document.querySelector('[data-focus-key=\\\"finished:done:review\\\"]'),focus:document.activeElement?.dataset.focusKey})", 'returnByValue': True})['result']['value']
            if not state['removed'] or state['focus'] != 'failed:fail:review': raise RuntimeError('keyboard review did not advance to the next actionable item: ' + str(state))
        if scenario == 'attentionlast':
            command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r', 'unmodifiedText': '\r'})
            command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
            time.sleep(.15)
            focused = command('Runtime.evaluate', {'expression': "document.activeElement?.classList.contains('attention-heading')", 'returnByValue': True})['result']['value']
            if not focused: raise RuntimeError('reviewing the last result did not focus the queue heading')
        if scenario == 'drawerkeyboard':
            command('Runtime.evaluate', {'expression': "document.querySelector('.drawer-extra > summary').focus()"})
            command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r', 'unmodifiedText': '\r'})
            command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
            opened = command('Runtime.evaluate', {'expression': "({open:document.querySelector('.drawer-extra').open,focus:document.activeElement?.dataset.focusKey})", 'returnByValue': True})['result']['value']
            if not opened['open'] or opened['focus'] != 'b:drawer-details': raise RuntimeError('keyboard did not open supplementary details and retain focus: ' + str(opened))
            command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
            command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
            returned = command('Runtime.evaluate', {'expression': "({closed:!document.querySelector('.sheet'),focus:document.activeElement?.dataset.focusKey})", 'returnByValue': True})['result']['value']
            if not returned['closed'] or returned['focus'] != 'chart-node:b': raise RuntimeError('Escape did not close the drawer and return focus: ' + str(returned))
        if scenario == 'drawertab':
            def key_tab(shift=False):
                command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Tab', 'code': 'Tab', 'windowsVirtualKeyCode': 9, **({'modifiers': 8} if shift else {})})
                command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Tab', 'code': 'Tab', 'windowsVirtualKeyCode': 9, **({'modifiers': 8} if shift else {})})
                time.sleep(.05)
            command('Runtime.evaluate', {'expression': "document.querySelector('[data-focus-key=drawer-close]').focus()"})
            key_tab(True)
            closed_last = command('Runtime.evaluate', {'expression': "({focus:document.activeElement?.dataset.focusKey,last:[...document.querySelector('.sheet').querySelectorAll('button,a[href],input,textarea,summary,[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.checkVisibility()).at(-1)?.dataset.focusKey})", 'returnByValue': True})['result']['value']
            if not closed_last['last'] or closed_last['focus'] != closed_last['last']: raise RuntimeError('Shift+Tab from Close did not reach a visible enabled stop with details closed: ' + str(closed_last))
            key_tab()
            if command('Runtime.evaluate', {'expression': "document.activeElement?.dataset.focusKey==='drawer-close'", 'returnByValue': True})['result']['value'] is not True: raise RuntimeError('Tab from the last closed-details stop did not wrap to Close')
            command('Runtime.evaluate', {'expression': "document.querySelector('.drawer-extra > summary').focus()"})
            key_tab()
            stayed = command('Runtime.evaluate', {'expression': "({inside:document.querySelector('.sheet').contains(document.activeElement),visible:document.activeElement?.checkVisibility()})", 'returnByValue': True})['result']['value']
            if not stayed['inside'] or not stayed['visible']: raise RuntimeError('Tab from More details escaped the modal with details closed: ' + str(stayed))
            command('Runtime.evaluate', {'expression': "document.querySelector('.drawer-extra > summary').click();document.querySelector('[data-focus-key=drawer-close]').focus()"})
            key_tab(True)
            open_last = command('Runtime.evaluate', {'expression': "({focus:document.activeElement?.dataset.focusKey,last:[...document.querySelector('.sheet').querySelectorAll('button,a[href],input,textarea,summary,[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.checkVisibility()).at(-1)?.dataset.focusKey})", 'returnByValue': True})['result']['value']
            if not open_last['last'] or open_last['focus'] != open_last['last']: raise RuntimeError('Shift+Tab from Close did not reach a visible enabled stop with details open: ' + str(open_last))
            key_tab()
            if command('Runtime.evaluate', {'expression': "document.activeElement?.dataset.focusKey==='drawer-close'", 'returnByValue': True})['result']['value'] is not True: raise RuntimeError('Tab from the last open-details stop did not wrap to Close')
        if scenario == 'attentionarrival':
            command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r', 'unmodifiedText': '\r'})
            command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
            time.sleep(.15)
            state = command('Runtime.evaluate', {'expression': "({empty:!document.querySelector('.attention-card'),focus:document.activeElement?.classList.contains('attention-heading')})", 'returnByValue': True})['result']['value']
            if not state['empty'] or not state['focus']: raise RuntimeError('keyboard review did not focus the empty queue: ' + str(state))
            command('Runtime.evaluate', {'expression': 'window.arrive()'})
            time.sleep(.15)
            state = command('Runtime.evaluate', {'expression': "({arrived:!!document.querySelector('[data-focus-key=\\\"needs-input:arrival:go\\\"]'),focus:document.activeElement?.classList.contains('attention-heading')})", 'returnByValue': True})['result']['value']
            if not state['arrived'] or not state['focus']: raise RuntimeError('a new queue row stole focus from the empty queue heading: ' + str(state))
        if scenario in ('linked', 'unknown', 'noid'):
            selector = 'button.chart-helper' if scenario in ('unknown', 'noid') else 'button.chart-node-button:not(.chart-helper)'
            command('Runtime.evaluate', {'expression': "document.querySelector('[data-focus-key=drawer-close]')?.click();document.querySelector(" + json.dumps(selector) + ").focus({preventScroll:true})"})
            command('Runtime.evaluate', {'expression': "window.fixtureKeys=[];document.addEventListener('keydown',e=>window.fixtureKeys.push(e.key),{once:true})"})
            command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r', 'unmodifiedText': '\r'})
            command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
            time.sleep(.1)
            selected = command('Runtime.evaluate', {'expression': "!!document.querySelector('.sheet')", 'returnByValue': True})['result']['value']
            if selected and scenario in ('unknown', 'noid'):
                helper_ok = command('Runtime.evaluate', {'expression': "document.querySelector('.sheet').textContent.includes('Review keyboard access') && !document.querySelector('.sheet').textContent.includes('Open workspace')", 'returnByValue': True})['result']['value']
                if not helper_ok: raise RuntimeError('keyboard-selected helper details incorrect')
            if not selected:
                debug = command('Runtime.evaluate', {'expression': "({focus:document.activeElement?.outerHTML, page:document.querySelector('#activity-page').hidden, keys:window.fixtureKeys})", 'returnByValue': True})['result']['value']
                raise RuntimeError('keyboard selection failed: ' + str(debug))
        if scenario in ('big', 'attention'):
            def key(name, code, vk, text=''):
                command('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': name, 'code': code, 'windowsVirtualKeyCode': vk, **({'text': text, 'unmodifiedText': text} if text else {})})
                command('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': name, 'code': code, 'windowsVirtualKeyCode': vk})
                time.sleep(.12)
            def ev(expression):
                return command('Runtime.evaluate', {'expression': expression, 'returnByValue': True})['result'].get('value')
            ev("document.querySelector('[data-focus-key=\"filter:all\"]').focus()")
            key('Tab', 'Tab', 9)
            if ev("document.activeElement.dataset.focusKey") != 'filter:attention': raise RuntimeError('Tab did not reach the Needs attention toggle')
            key('Enter', 'Enter', 13, '\r')
            if ev("document.querySelector('[data-focus-key=\"filter:attention\"]').getAttribute('aria-pressed')+'|'+document.activeElement.dataset.focusKey") != 'true|filter:attention': raise RuntimeError('keyboard toggle did not apply or lost focus')
            ev("document.querySelector('[data-focus-key=\"filter:all\"]').focus()")
            key('Enter', 'Enter', 13, '\r')
            if ev("document.querySelector('[data-focus-key=\"filter:all\"]').getAttribute('aria-pressed')+'|'+document.activeElement.dataset.focusKey") != 'true|filter:all': raise RuntimeError('keyboard return to All failed')
            # A chart scrolls sideways only: Down belongs to the page, Right to the chart.
            # The page must be taller than the window for Down to have anywhere to go.
            command('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 300, 'deviceScaleFactor': 1, 'mobile': False})
            time.sleep(.15)
            before = ev("(()=>{window.scrollTo(0,0);const v=document.querySelector('.chart-viewport');v.scrollTop=0;v.scrollLeft=0;v.focus({preventScroll:true});return 0})()")
            for _ in range(3): key('ArrowDown', 'ArrowDown', 40)
            for _ in range(3): key('ArrowRight', 'ArrowRight', 39)
            moved = ev("[document.querySelector('.chart-viewport').scrollTop,document.querySelector('.chart-viewport').scrollLeft,document.scrollingElement.scrollTop]")
            if moved[0] != 0: raise RuntimeError('arrow keys scrolled the chart vertically: ' + str(moved))
            if scenario == 'big' and not (moved[1] > 0 and moved[2] > 0): raise RuntimeError('arrow keys did not pan the chart sideways and scroll the page: ' + str(moved))
            print('  keyboard ok; arrow scroll [chart top, chart left, page top]', moved)
            command('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
            ev("window.scrollTo(0,0)")
            time.sleep(.15)
            if scenario == 'big':
                bars = ev("(()=>{const v=document.querySelector('.chart-viewport');return [v.offsetWidth-v.clientWidth,v.offsetHeight-v.clientHeight]})()")
                if bars != [0, 0]: raise RuntimeError('chart still shows scrollbars: ' + str(bars))
                box = ev("(()=>{window.scrollTo(0,0);const v=document.querySelector('.chart-viewport');v.scrollLeft=0;v.scrollTop=0;const r=v.getBoundingClientRect();return [r.left+4,r.top+4]})()")
                command('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': box[0], 'y': box[1], 'button': 'left', 'buttons': 1, 'clickCount': 1})
                for step in range(1, 6):
                    command('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': box[0] - step * 30, 'y': box[1] - step * 15, 'button': 'left', 'buttons': 1})
                command('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': box[0] - 150, 'y': box[1] - 75, 'button': 'left', 'buttons': 0, 'clickCount': 1})
                panned = ev("[document.querySelector('.chart-viewport').scrollLeft,document.querySelector('.chart-viewport').scrollTop,document.querySelector('.chart-viewport').classList.contains('panning')]")
                if not (panned[0] > 100 and panned[1] == 0 and not panned[2]): raise RuntimeError('dragging the chart did not pan it sideways only: ' + str(panned))
                print('  hidden scrollbars; drag pans sideways only', panned[:2])
            branch = ev("(()=>{const b=document.querySelector('.chart-branch');if(!b)return null;b.focus();return b.dataset.focusKey})()")
            if branch:
                before_nodes = ev("document.querySelectorAll('.chart-node').length")
                key('Enter', 'Enter', 13, '\r')
                after = ev("[document.querySelectorAll('.chart-node').length, document.activeElement.dataset.focusKey]")
                if after[0] == before_nodes or after[1] != branch: raise RuntimeError('branch toggle by keyboard failed ' + str(after))
                key('Enter', 'Enter', 13, '\r')
                if ev("document.querySelectorAll('.chart-node').length") != before_nodes: raise RuntimeError('branch re-expand by keyboard failed')
                print('  branch toggle by keyboard ok')
        if scenario in ('big', 'grid'):
            # A real wheel over a chart scrolls the page, never the chart; sideways still pans it.
            def page(expression):
                return command('Runtime.evaluate', {'expression': expression, 'returnByValue': True})['result'].get('value')
            page("document.querySelector('#activity-tab').click()")
            command('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 300, 'deviceScaleFactor': 1, 'mobile': False})
            time.sleep(.2)
            point = page("(()=>{const se=document.scrollingElement;se.scrollTop=0;const v=document.querySelector('.chart-viewport');se.scrollTop=Math.max(0,v.getBoundingClientRect().top-60);const r=v.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(Math.min(Math.max(r.top+20,20),innerHeight-20)),se.scrollHeight>innerHeight+40]})()")
            if not point[2]: raise RuntimeError('page cannot scroll at 300px high, so the wheel check proves nothing')
            before = page("[document.scrollingElement.scrollTop,document.querySelector('.chart-viewport').scrollTop,document.querySelector('.chart-viewport').scrollLeft]")
            for _ in range(3):
                command('Input.dispatchMouseEvent', {'type': 'mouseWheel', 'x': point[0], 'y': point[1], 'deltaX': 0, 'deltaY': 120})
                time.sleep(.1)
            time.sleep(.2)
            after = page("[document.scrollingElement.scrollTop,document.querySelector('.chart-viewport').scrollTop,document.querySelector('.chart-viewport').scrollLeft]")
            if not (after[0] > before[0] and after[1] == before[1] == 0): raise RuntimeError(f'wheel over a chart did not scroll the page and only the page: {before} -> {after}')
            wide = page("(()=>{const v=document.querySelector('.chart-viewport');return v.scrollWidth>v.clientWidth+40})()")
            if wide:
                point = page("(()=>{const se=document.scrollingElement,v=document.querySelector('.chart-viewport');se.scrollTop=Math.max(0,se.scrollTop+v.getBoundingClientRect().top-60);const r=v.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(Math.min(Math.max(r.top+20,20),innerHeight-20))]})()")
                command('Input.dispatchMouseEvent', {'type': 'mouseWheel', 'x': point[0], 'y': point[1], 'deltaX': 80, 'deltaY': 0})
                time.sleep(.2)
                sideways = page("document.querySelector('.chart-viewport').scrollLeft")
                if not sideways > before[2]: raise RuntimeError(f'a sideways wheel did not pan the chart: {before[2]} -> {sideways}')
            print('  wheel scrolls the page, not the chart', before, '->', after, 'sideways ok' if wide else 'chart fits sideways')
            command('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
            page("window.scrollTo(0,0)")
            time.sleep(.2)
        def shot(name):
            if out: (out / f'{name}-{width}-{scenario}.png').write_bytes(chrome.screenshot())
        if scenario == 'attentioncapture':
            shot('attention-inbox')
        if scenario in ('attention', 'big', 'parentlink', 'parentnote', 'attentionempty'):
            command('Runtime.evaluate', {'expression': "document.querySelector('[data-focus-key=\"filter:attention\"]').click(); window.scrollTo(0,0)"})
            time.sleep(.1)
            shot('attention')
            command('Runtime.evaluate', {'expression': "document.querySelector('[data-focus-key=\"filter:all\"]')?.click()"})
            time.sleep(.1)
        shot('inspector')
        command('Runtime.evaluate', {'expression': "document.querySelector('[data-focus-key=drawer-close]')?.click(); document.querySelector('[data-focus-key^=chart-reset]')?.click(); window.scrollTo(0,0)"})
        shot('map')
        command('Runtime.evaluate', {'expression': "document.querySelector('#office-tab').click(); window.scrollTo(0,0)"})
        time.sleep(.1)
        shot('office')

print(f'{len(scenarios)} scenarios passed')
