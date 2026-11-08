// v60 再現の確認。隔離プロファイル。外部へは送らない。印は立てない。
import { spawn } from 'node:child_process';
const root = new URL('..', import.meta.url).pathname;
const port = 8791;
const http = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9351', `--user-data-dir=/tmp/chrome-v61-${Date.now()}`, '--window-size=390,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ready() { for (let i = 0; i < 40; i++) { try { if ((await fetch('http://127.0.0.1:9351/json/version')).ok) return; } catch (e) {} await sleep(250); } throw new Error('chrome'); }
function rpc(ws) { let n = 0; const w = new Map(); ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && w.has(m.id)) { w.get(m.id)(m); w.delete(m.id); } }); return (method, params = {}) => new Promise((res, rej) => { const id = ++n; w.set(id, res); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (w.has(id)) { w.delete(id); rej(new Error('timeout ' + method)); } }, 20000); }); }
async function tab() {
  const t = await (await fetch('http://127.0.0.1:9351/json/new?' + encodeURIComponent(`http://127.0.0.1:${port}/index.html#list`), { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = rpc(ws);
  await send('Page.enable'); await send('Runtime.enable');
  for (let i = 0; i < 40; i++) { const ev = await send('Runtime.evaluate', { expression: 'typeof togMany==="function" && document.readyState', returnByValue: true }); if (ev.result && ev.result.result && ev.result.result.value === 'complete') break; await sleep(200); }
  await sleep(500);
  return { send, close: () => ws.close() };
}
async function ev(send, expression) { const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (!out.result || out.result.exceptionDetails) throw new Error(JSON.stringify(out.result && out.result.exceptionDetails || out).slice(0, 900)); return out.result.result.value; }
try {
  await ready();
  const page = await tab();
  const amount = await ev(page.send, `(() => {
    window.__xss = 0;
    S.list = [{ name: '牛乳', store: '店', done: false, price: 100, cat: '食材', uses: [{ d: 1, dish: '朝' }, { d: 4, dish: '夜' }] }];
    S.spend = []; LV = 'day'; location.hash = '#list'; render();
    const note = document.body.innerText.includes('品は1つ') && document.body.innerText.includes('すべて買った');
    const mon = document.querySelector('#day1 input[data-yen]');
    const thu = document.querySelector('#day4 input[data-yen]');
    const thuBox = document.querySelector('#day4 input[data-tm]');
    mon.value = '120'; thu.value = '';
    thuBox.checked = true; thuBox.dispatchEvent(new Event('change', { bubbles: true }));
    const blank = { done: S.list[0].done, spend: S.spend.length, thuChecked: !!(document.querySelector('#day4 input[data-tm]') && document.querySelector('#day4 input[data-tm]').checked), said: (document.getElementById('toast') && document.getElementById('toast').textContent || '').includes('金額を入れて') };
    const thu2 = document.querySelector('#day4 input[data-yen]');
    const thuBox2 = document.querySelector('#day4 input[data-tm]');
    thu2.value = '0'; thuBox2.checked = true; thuBox2.dispatchEvent(new Event('change', { bubbles: true }));
    const zero = { done: S.list[0].done, spend: S.spend.length, said: (document.getElementById('toast') && document.getElementById('toast').textContent || '').includes('1円以上') };
    const thu3 = document.querySelector('#day4 input[data-yen]');
    const cat = document.querySelector('#day4 select[data-cat]');
    const thuBox3 = document.querySelector('#day4 input[data-tm]');
    thu3.value = '480'; if (cat) cat.value = '日用品';
    thuBox3.checked = true; thuBox3.dispatchEvent(new Event('change', { bubbles: true }));
    const bought = { done: !!S.list[0].done, n: S.spend.length, amount: S.spend[0] && S.spend[0].amount, cat: S.spend[0] && S.spend[0].cat, monDone: document.querySelector('#day1 li').classList.contains('done') };
    const boxBack = document.querySelector('#day1 input[data-tm]');
    boxBack.checked = false; boxBack.dispatchEvent(new Event('change', { bubbles: true }));
    const undone = { done: !!S.list[0].done, n: S.spend.length };
    return JSON.stringify({ note, blank, zero, bought, undone, xss: window.__xss });
  })()`);
  const recipes = await ev(page.send, `(() => {
    window.__xss = 0;
    const bad = 'id"onclick';
    const nasty = '<img src=x onerror="window.__xss=1">';
    localStorage.setItem('okaimono_recipes', JSON.stringify([
      { id: bad, name: '残る名前', ingredients: ['塩'], steps: [{ t: '切る', d: 'そのまま' }], at: '2026-11-01', src: 't' },
      { id: 'safe_recipe-1', name: nasty, ingredients: ['卵'], steps: [{ t: '焼く', d: '200℃' }], at: '2026-11-01', src: 't' }
    ]));
    localStorage.setItem('okaimono_links', JSON.stringify({ '残る名前': 'box:' + bad + '|残る名前' }));
    location.hash = '#fridge'; render();
    const html = document.getElementById('rbox').innerHTML;
    const before = { text: document.body.innerText.includes('残る名前'), count: (document.getElementById('rbox') || {}).innerText || '' };
    const stored = JSON.parse(localStorage.getItem('okaimono_recipes'));
    const idsOk = stored.every(r => /^[A-Za-z0-9_-]{1,60}$/.test(r.id));
    const names = stored.map(r => r.name);
    const link = JSON.parse(localStorage.getItem('okaimono_links') || '{}')['残る名前'] || '';
    let backupHasBad = false, backupHasName = false;
    const old = URL.createObjectURL;
    let blob = null;
    URL.createObjectURL = function (b) { blob = b; return old.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () {};
    backup();
    URL.createObjectURL = old;
    return blob.text().then(t => {
      backupHasBad = t.includes(bad);
      backupHasName = t.includes('残る名前') && t.includes('塩') && t.includes('切る');
      const dt = new DataTransfer();
      dt.items.add(new File([JSON.stringify({ app: 'okaimono', version: 2, data: { version: 2, settings: S.settings, list: [], spend: [], fridge: [], menu: ['','','','','','',''], prep: '', userStores: [] }, links: {}, hist: [], extra: { recipes: [{ id: bad, name: '復元の名前', ingredients: ['砂糖'], steps: [{ t: '混ぜる', d: '' }] }] } })], 'b.json', { type: 'application/json' }));
      const inp = document.createElement('input'); inp.type = 'file'; inp.files = dt.files;
      window.confirm = () => true; window.alert = () => {};
      restore({ target: inp });
      return new Promise(res => setTimeout(res, 400)).then(() => {
        const again = JSON.parse(localStorage.getItem('okaimono_recipes') || '[]');
        return JSON.stringify({
          hash: location.hash,
          before, nStored: stored.length,
          namesNow: rbox().map(r => r.name),
          inHtml: document.body.innerHTML.includes('残る名前'),
          shown: document.body.innerText.includes('残る名前'),
          safeShown: html.includes('safe_recipe-1') || document.body.innerText.includes('残る名前'),
          xss: window.__xss, noOnclick: !html.includes('onclick="'), idsOk, keptName: names.includes('残る名前'), keptIng: stored.some(r => (r.ingredients || []).includes('塩')),
          quoteGone: !stored.some(r => String(r.id).includes('"')),
          linkMoved: link.startsWith('box:r') && !link.includes('"'),
          backupHasBad, backupHasName,
          restored: again.some(r => r.name === '復元の名前' && (r.ingredients || []).includes('砂糖') && /^[A-Za-z0-9_-]{1,60}$/.test(r.id) && !String(r.id).includes('"')),
          dupKept: again.filter(r => r.name === '残る名前' || r.name === '復元の名前').length >= 1
        });
      });
    });
  })()`);
  const out = { amount: JSON.parse(amount), recipes: JSON.parse(recipes) };
  const a = out.amount, r = out.recipes;
  const ok = a.note && a.blank.done === false && a.blank.spend === 0 && a.blank.thuChecked === false && a.blank.said
    && a.zero.done === false && a.zero.spend === 0 && a.zero.said
    && a.bought.done === true && a.bought.n === 1 && a.bought.amount === 480 && a.bought.cat === '日用品' && a.bought.monDone
    && a.undone.done === false && a.undone.n === 0 && a.xss === 0
    && r.xss === 0 && r.before && r.before.text && r.before.count.includes('2件') && r.idsOk && r.keptName && r.keptIng && r.quoteGone && r.linkMoved && r.backupHasBad === false && r.backupHasName && r.restored && r.noOnclick;
  console.log(JSON.stringify(out, null, 2));
  if (!ok) process.exitCode = 2; else console.log('REPRO_OK');
  page.close();
} catch (e) { console.error('FAIL', e); process.exitCode = 1; }
finally { chrome.kill('SIGKILL'); http.kill('SIGKILL'); }
