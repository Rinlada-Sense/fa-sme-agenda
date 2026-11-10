// Runs the REAL page in jsdom with a canvas backend and captures the image the "Download" button produces.
//   node render-download.js <1|2|both> <en|th> <out.png>
// Setup (once):  npm i jsdom @napi-rs/canvas @fontsource/prompt
//                pip install fonttools ; convert node_modules/@fontsource/prompt/files/prompt-latin-{400,500,600,700,800}-normal.woff
//                (and prompt-thai-*) to .ttf into $FONT_DIR  (fontTools: TTFont(f); t.flavor=None; t.save(out))
// Limits: jsdom has no layout engine (cannot check CSS), and Thai glyphs render as boxes unless a Thai-capable font is registered.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const { GlobalFonts } = require('@napi-rs/canvas');

const FONT_DIR = process.env.FONT_DIR || '/tmp/fonts';
[400, 500, 600, 700, 800].forEach(w => {
  GlobalFonts.registerFromPath(`${FONT_DIR}/prompt-latin-${w}-normal.ttf`, 'Prompt');
  try { GlobalFonts.registerFromPath(`${FONT_DIR}/prompt-thai-${w}-normal.ttf`, 'Prompt'); } catch (e) {}
});

const [mode = '1', lang = 'en', out = `/tmp/render_${mode}_${lang}.png`] = process.argv.slice(2);
const PAGE = process.env.PAGE || 'source/agenda-day1.html';
const html = fs.readFileSync(PAGE, 'utf8');

const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented|navigation|fonts\.googleapis/i.test(String(e.message))) errs.push(String(e.message)); });
vc.on('error', e => errs.push('console.error: ' + e));

// session ids -> start slot, per day (ids come from the S array in the page)
const plan = { 1: { a1: 0, b2: 1, c3: 2, d4: 4 }, 2: { x1: 0, x7: 1, x13: 2, x19: 4 } };

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  url: 'https://example.test/', virtualConsole: vc,
  beforeParse(w) {
    w.localStorage.setItem('sme-expo-agenda-v2', JSON.stringify(plan));
    w.localStorage.setItem('sme-expo-lang', lang);
    // capture the canvas the page draws instead of triggering a real download
    w.HTMLCanvasElement.prototype.toBlob = function (cb) { w.__cv = this; cb(new w.Blob(['x'])); };
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  },
});
const w = dom.window;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => (w.document.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await sleep(1200); // let embedded images decode
  const d = w.document;
  if (mode === 'both') d.querySelector('[data-dl="both"]').click();
  else {
    if (mode === '2') d.querySelector('.daytabs button[data-day="2"]').click();
    await sleep(200);
    d.getElementById('png').click();
  }
  await sleep(1500);
  if (!w.__cv) { console.log('NO CANVAS PRODUCED (drawImage threw - it is wrapped in try/catch inside saveDays)'); console.log(errs.join('\n')); process.exit(1); }
  fs.writeFileSync(out, Buffer.from(w.__cv.toDataURL('image/png').split(',')[1], 'base64'));
  console.log('rendered', out, w.__cv.width + 'x' + w.__cv.height);
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no script errors');
  process.exit(0);
})();
