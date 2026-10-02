// Export dist/B2W-API-Help-Guide.html to dist/B2W-API-Help-Guide.pdf (US Letter)
// using headless Chrome or Edge over the DevTools Protocol.
// Requires Node 22+ (global WebSocket). No npm packages.
//
//   node tools/export-pdf.js
//
// Set CHROME_PATH if Chrome/Edge is installed somewhere unusual.
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'dist', 'B2W-API-Help-Guide.html');
const PDF = path.join(ROOT, 'dist', 'B2W-API-Help-Guide.pdf');
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('Chrome or Edge not found. Set CHROME_PATH to the browser executable.');
  return found;
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(HTML)) throw new Error('dist/B2W-API-Help-Guide.html is missing. Run "python build.py" first.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'b2w-pdf-'));
  const browser = spawn(findBrowser(), [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) {
      try { target = (await getJSON(`http://127.0.0.1:${PORT}/json/list`)).find((t) => t.type === 'page'); } catch (_) {}
      if (!target) await sleep(150);
    }
    if (!target) throw new Error('The browser did not start.');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let seq = 0;
    const pending = new Map();
    let onLoad = null;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method === 'Page.loadEventFired' && onLoad) {
        onLoad();
      }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Emulation.setEmulatedMedia', { media: 'print', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    const loaded = new Promise((r) => { onLoad = r; });
    await send('Page.navigate', { url: pathToFileURL(HTML).href });
    await Promise.race([loaded, sleep(15000)]);
    await sleep(1500); // web fonts and images
    await send('Runtime.evaluate', { expression: "document.querySelectorAll('details').forEach(d => d.open = true)" });

    const { data } = await send('Page.printToPDF', {
      paperWidth: 8.5, paperHeight: 11, printBackground: true, preferCSSPageSize: true,
    });
    fs.writeFileSync(PDF, Buffer.from(data, 'base64'));
    console.log(`Wrote ${path.relative(ROOT, PDF)} (${Math.round(fs.statSync(PDF).size / 1024).toLocaleString()} KB)`);
    ws.close();
  } finally {
    browser.kill();
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
