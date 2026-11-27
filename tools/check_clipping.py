#!/usr/bin/env python3
# Draws every card and button with overflow visible and reports ink outside its frame (would be cut off).
# Needs Playwright and Chrome:  python3 tools/check_clipping.py
# The grace-note buttons show a piece of the staff on purpose, so their staff lines run past the frame.
import asyncio, io, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
from PIL import Image
COLLECT = r"""
() => {
  const S = { instrument: 'both', clefMode: 'alternate', cadenceKeys: Content.KEYS.map(k=>k.id), spellKeys: ['C:major','F#:major','Eb:minor'],
    degreeKeys: Content.KEYS.map(k=>k.id), intervalKeys: ['C:major','F#:major','Gb:major','D#:minor','Ab:minor'],
    chordLabels: 'roman', expressiveSays: 'term', noteAnswer: 'names', pitchMode: 'chromatic', rangePreset: 'custom', rangeLow: 'C3', rangeHigh: 'B7',
    scaleKey: 'C', scaleType: 'major', pitchClasses: ['C'] };
  const out = [];
  Content.SUBCATS.forEach((sc) => {
    sc.chips.forEach((c) => { if (c.html && /<svg/.test(c.html)) out.push(['chip ' + sc.id + ' ' + c.id, c.html]); });
    if (!sc.pool) return;
    sc.pool(sc.chips.map((c) => c.id), S).forEach((it) => ['treble', 'alto'].forEach((clef) => {
      const r = Content.resolve(it, clef); if (r.svg && (clef === 'treble' || it.draw)) out.push(['card ' + sc.id + ' ' + it.id + ' ' + clef, r.svg]); }));
  });
  ['2/4','3/4','4/4','C','cut','3/8','6/8','2/2','3/2','5/4','7/8','9/8','12/8'].forEach((m) => {
    for (let i = 0; i < 12; i++) out.push(['rhythm ' + m + ' ' + i, Content.rhythmItem(m, ['16','8','q','h','w','d8','dq','dh','trip','dup','rest'], Math.random).svg]);
  });
  return out;
}
"""
CW, CH, PAD = 200, 130, 24
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'))
        pg = await b.new_page(viewport={'width': CW * 8, 'height': 800})
        await pg.goto('file://' + os.path.join(ROOT, 'index.html'))
        await pg.wait_for_timeout(500)
        items = await pg.evaluate(COLLECT)
        print('items', len(items))
        problems = []
        BATCH = 400
        for start in range(0, len(items), BATCH):
            batch = items[start:start + BATCH]
            html = ''.join('<div class="cell"><div class="frame">%s</div></div>' % svg for _, svg in batch)
            await pg.evaluate("""(h) => { document.body.innerHTML = '<style>body{margin:0;background:#fff;overflow:visible}#w{display:flex;flex-wrap:wrap;width:%dpx}.cell{width:%dpx;height:%dpx;display:flex;align-items:center;justify-content:center}.frame{width:%dpx;height:%dpx;display:flex}.frame svg{width:100%%;height:100%%;overflow:visible;fill:#111;color:#111}.frame svg *{}</style><div id=w>' + h + '</div>'; }""" % (CW * 8, CW, CH, CW - 2 * PAD, CH - 2 * PAD), html)
            await pg.evaluate("document.fonts.ready")
            await pg.wait_for_timeout(200)
            rects = await pg.evaluate("Array.from(document.querySelectorAll('.frame svg')).map(s => { const r = s.getBoundingClientRect(); const vb = s.viewBox.baseVal; const sc = Math.min(r.width / vb.width, r.height / vb.height); const w = vb.width * sc, h = vb.height * sc; return [r.left + (r.width - w) / 2, r.top + window.scrollY + (r.height - h) / 2, w, h]; })")
            h = await pg.evaluate("document.body.scrollHeight")
            await pg.set_viewport_size({'width': CW * 8, 'height': h})
            png = await pg.screenshot(full_page=True)
            im = Image.open(io.BytesIO(png)).convert('L')
            px = im.load()
            for (label, _), (x, y, w, hh) in zip(batch, rects):
                x0, y0, x1, y1 = int(x) - 1, int(y) - 1, int(x + w) + 1, int(y + hh) + 1
                cnt = 0; sides = set()
                for yy in range(max(0, y0 - PAD + 2), min(im.size[1], y1 + PAD - 2)):
                    for xx in range(max(0, x0 - PAD + 2), min(im.size[0], x1 + PAD - 2)):
                        if x0 <= xx <= x1 and y0 <= yy <= y1: continue
                        if px[xx, yy] < 120:
                            cnt += 1
                            sides.add('L' if xx < x0 else 'R' if xx > x1 else 'T' if yy < y0 else 'B')
                if cnt > 4: problems.append((label, cnt, ''.join(sorted(sides))))
            await pg.set_viewport_size({'width': CW * 8, 'height': 800})
        c = collections.Counter(' '.join(l.split(' ')[:2]) for l, _, _ in problems)
        print('problems', len(problems))
        for k, v in c.most_common(): print(v, k)
        for l, n, sides in problems: print('  %s: %d dark pixels outside (%s)' % (l, n, sides))
        await b.close()
asyncio.run(main())
