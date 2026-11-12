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
async function waitApp(send) { for (let i = 0; i < 40; i++) { try { const v = await ev(send, 'typeof APP_VER==="string" && document.readyState==="complete" ? APP_VER : ""'); if (v === 'okaimono-v66') return; } catch (e) {} await sleep(200); } throw new Error('reload'); }
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
  const links = await ev(page.send, `(() => {
    const bad = 'id"mark';
    const pack = (recipes, links) => ({ app:'okaimono', version:2, data:{ version:2, settings:S.settings, list:[], spend:[], fridge:[], menu:['','','','','','',''], prep:'', userStores:[] }, links, hist:[], extra:{ recipes } });
    const step = (name, ing, t) => ({ t, d:'' });
    const rec = (id, name, ing, t) => ({ id, name, ingredients:[ing], steps:[step(name, ing, t)], at:'2026-11-08', src:'t' });
    const restoreFile = obj => new Promise(res => { const dt = new DataTransfer(); dt.items.add(new File([JSON.stringify(obj)], 'b.json', { type:'application/json' })); const inp = document.createElement('input'); inp.type = 'file'; inp.files = dt.files; window.confirm = () => true; window.alert = () => {}; restore({ target: inp }); setTimeout(res, 400); });
    return restoreFile(pack([
      rec(bad, '戻すカレー', '塩', '切る'),
      rec('ok_one', '普通', '卵', '焼く')
    ], { '戻すカレー': 'box:' + bad + '|戻すカレー' })).then(() => {
      const all = JSON.parse(localStorage.getItem('okaimono_recipes') || '[]');
      const curry = all.find(r => r.name === '戻すカレー');
      const link = (JSON.parse(localStorage.getItem('okaimono_links') || '{}'))['戻すカレー'];
      const imported = !!(curry && /^[A-Za-z0-9_-]{1,60}$/.test(curry.id) && link === 'box:' + curry.id + '|戻すカレー' && curry.ingredients[0] === '塩' && curry.steps[0].t === '切る' && all.some(r => r.id === 'ok_one' && r.name === '普通'));
      localStorage.setItem('okaimono_recipes', JSON.stringify([rec(bad, 'カレー', '肉', '煮る'), rec(bad, 'シチュー', '乳', '煮込む')]));
      localStorage.setItem('okaimono_links', JSON.stringify({ 'カレー': 'box:' + bad + '|カレー' }));
      rbTold = false; location.hash = '#fridge'; render();
      const open = rbox();
      const c = open.find(r => r.name === 'カレー'), s = open.find(r => r.name === 'シチュー');
      const lk = getLinks()['カレー'];
      const opened = !!(c && s && c.id !== s.id && lk === 'box:' + c.id + '|カレー' && lk.indexOf(s.id) < 0 && document.body.innerText.includes('カレー') && document.body.innerText.includes('シチュー'));
      const id1 = open.map(r => r.id).join(',');
      const id2 = rbox().map(r => r.id).join(',');
      localStorage.setItem('okaimono_recipes', JSON.stringify([rec(bad, 'カレー', '肉', '煮る'), rec(bad, 'カレー', '豆', '焼く')]));
      localStorage.setItem('okaimono_links', JSON.stringify({ 'カレー': 'box:' + bad + '|カレー' }));
      rbTold = false; render();
      const both = rbox();
      const amb = getLinks()['カレー'];
      const ambiguous = both.filter(r => r.name === 'カレー').length === 2 && both[0].ingredients[0] !== both[1].ingredients[0] && amb === 'box:' + bad + '|カレー' && both.every(r => amb.indexOf(r.id) < 0) && !!document.getElementById('rbdang');
      localStorage.setItem('okaimono_recipes', JSON.stringify([rec('same_id_ok', 'カレー', '肉', '煮る'), rec('same_id_ok', 'シチュー', '乳', '煮込む')]));
      localStorage.setItem('okaimono_links', JSON.stringify({ 'カレー': 'box:same_id_ok|カレー' }));
      rbTold = false; render();
      const col = rbox();
      const keep = col.find(r => r.name === 'カレー'), other = col.find(r => r.name === 'シチュー');
      const collision = !!(keep && keep.id === 'same_id_ok' && other && other.id !== 'same_id_ok' && getLinks()['カレー'] === 'box:same_id_ok|カレー');
      return JSON.stringify({ imported, opened, stable: id1 === id2 && id1.length > 0, ambiguous, collision, xss: window.__xss });
    });
  })()`);
  const life = await ev(page.send, `(() => {
    const bad = 'id"mark';
    const rec = (id, name, ing, t) => ({ id, name, ingredients:[ing], steps:[{ t, d:'' }], at:'2026-11-08', src:'t' });
    S.menu = ['カレー','','','','','','']; save();
    localStorage.setItem('okaimono_recipes', JSON.stringify([rec(bad,'カレー','塩','切る'), rec(bad,'カレー','牛乳','煮ない')]));
    localStorage.setItem('okaimono_links', JSON.stringify({ 'カレー': 'box:' + bad + '|カレー' }));
    rbTold = false; DO = null; location.hash = '#fridge'; render();
    const read = () => ({ L: getLinks()['カレー'] || '', dang: !!document.getElementById('rbdang'), ings: rbox().map(r => r.ingredients[0] + '/' + r.steps[0].t).sort() });
    const immediate = read();
    linkMenu();
    const afterLink = read();
    togDish('0|0');
    const panel = (document.querySelector('.dpanel') || {}).innerText || '';
    const opened = read();
    const openOk = opened.L === 'box:' + bad + '|カレー' && panel.includes('塩') && panel.includes('牛乳') && panel.includes('切る') && panel.includes('煮ない') && panel.includes('自動ではつなぎません') && document.querySelectorAll('[data-act=linkdish]').length === 2;
    const milkBtn = [...document.querySelectorAll('[data-act=linkdish]')].find(b => (b.closest('.ambig') || b).innerText.includes('牛乳'));
    if (milkBtn) milkBtn.click();
    const milk = rbox().find(r => r.ingredients[0] === '牛乳');
    const salt = rbox().find(r => r.ingredients[0] === '塩');
    linkMenu();
    const afterManual = getLinks()['カレー'] || '';
    const panel2 = (document.querySelector('.dpanel') || {}).innerText || '';
    const manualOk = !!(milk && salt && afterManual === 'box:' + milk.id + '|カレー' && afterManual.indexOf(salt.id) < 0 && panel2.includes('牛乳') && panel2.includes('煮ない') && !panel2.includes('自動ではつなぎません'));
    return JSON.stringify({ immediate, afterLink, openOk, manualOk, milkId: milk && milk.id, saltId: salt && salt.id, afterManual, xss: window.__xss });
  })()`);
  await sleep(1000);
  const waited = await ev(page.send, `(() => { linkMenu(); const L = getLinks()['カレー'] || ''; const milk = rbox().find(r => r.ingredients[0] === '牛乳'); return JSON.stringify({ L, still: !!(milk && L === 'box:' + milk.id + '|カレー') }); })()`);
  const lifeJ = JSON.parse(life);
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html#fridge` });
  await waitApp(page.send);
  await sleep(1200);
  const manualReload = await ev(page.send, `(() => { const L = getLinks()['カレー'] || ''; linkMenu(); const L2 = getLinks()['カレー'] || ''; return JSON.stringify({ L, L2, milk: ${JSON.stringify(lifeJ.milkId || '')} }); })()`);
  const imported = await ev(page.send, `(() => {
    const bad = 'id"mark';
    const rec = (id, name, ing, t) => ({ id, name, ingredients:[ing], steps:[{ t, d:'' }], at:'2026-11-08', src:'t' });
    localStorage.setItem('okaimono_recipes', '[]');
    localStorage.setItem('okaimono_links', '{}');
    const obj = { app:'okaimono', version:2, data:{ version:2, settings:S.settings, list:[], spend:[], fridge:[], menu:['カレー','','','','','',''], prep:'', userStores:[] }, links:{ 'カレー':'box:' + bad + '|カレー' }, hist:[], extra:{ recipes:[rec(bad,'カレー','塩','切る'), rec(bad,'カレー','牛乳','煮ない')] } };
    const dt = new DataTransfer(); dt.items.add(new File([JSON.stringify(obj)], 'b.json', { type:'application/json' }));
    const inp = document.createElement('input'); inp.type = 'file'; inp.files = dt.files;
    window.confirm = () => true; window.alert = () => {}; rbTold = false; restore({ target: inp });
    return 'started';
  })()`);
  let importSoon = null;
  for (let i = 0; i < 30; i++) {
    await sleep(50);
    const snap = JSON.parse(await ev(page.send, `(() => { const all = JSON.parse(localStorage.getItem('okaimono_recipes') || '[]'); const L = (JSON.parse(localStorage.getItem('okaimono_links') || '{}'))['カレー'] || ''; return JSON.stringify({ n: all.filter(r => r.name === 'カレー').length, L, ings: all.map(r => r.ingredients && r.ingredients[0]).sort().join(',') }); })()`));
    if (snap.n === 2 && snap.ings === '塩,牛乳') { importSoon = JSON.parse(await ev(page.send, `(() => { linkMenu(); location.hash='#fridge'; render(); return JSON.stringify({ L: getLinks()['カレー'] || '', dang: !!document.getElementById('rbdang'), both: rbox().map(r => r.ingredients[0]).sort().join(',') }); })()`)); break; }
  }
  await sleep(800);
  const importLate = await ev(page.send, `(() => { linkMenu(); return JSON.stringify({ L: getLinks()['カレー'] || '', dang: !!document.getElementById('rbdang'), kept: (getLinks()['カレー'] || '') === 'box:id"mark|カレー', both: rbox().filter(r => r.name === 'カレー').map(r => r.ingredients[0]).sort().join(',') }); })()`);
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html#fridge` });
  await waitApp(page.send);
  await sleep(1200);
  const reloaded = await ev(page.send, `(() => { const L = getLinks()['カレー'] || ''; const dang = !!document.getElementById('rbdang'); linkMenu(); return JSON.stringify({ ver: APP_VER, L, L2: getLinks()['カレー'] || '', dang, dang2: !!document.getElementById('rbdang'), both: rbox().filter(r => r.name === 'カレー').map(r => r.ingredients[0]).sort().join(',') }); })()`);
  const unique = await ev(page.send, `(() => {
    const bad = 'id"mark';
    const rec = (id, name, ing, t) => ({ id, name, ingredients:[ing], steps:[{ t, d:'' }], at:'2026-11-08', src:'t' });
    S.menu = ['カレー','','','','','','']; save();
    localStorage.setItem('okaimono_recipes', JSON.stringify([rec(bad,'カレー','肉','煮る'), rec(bad,'シチュー','乳','煮込む')]));
    localStorage.setItem('okaimono_links', JSON.stringify({ 'カレー': 'box:' + bad + '|カレー' }));
    rbTold = false; location.hash = '#fridge'; render();
    linkMenu();
    const c = rbox().find(r => r.name === 'カレー'), s = rbox().find(r => r.name === 'シチュー');
    return JSON.stringify({ lk: getLinks()['カレー'] || '', cid: c && c.id, sid: s && s.id });
  })()`);
  await sleep(800);
  const uniqueLate = await ev(page.send, `(() => { linkMenu(); const u = ${unique}; const lk = getLinks()['カレー'] || ''; return JSON.stringify({ lk, ok: lk === 'box:' + u.cid + '|カレー' && lk.indexOf(u.sid) < 0 }); })()`);
  const detail = await ev(page.send, `(() => {
    window.__xss = 0;
    const bad = 'id"mark';
    const evil = '<img src=x onerror="window.__xss=1">';
    const rec = (ings, steps) => ({ id: bad, name: 'カレー', ingredients: ings, steps, at: '2026-11-08', src: 't' });
    S.menu = ['カレー','','','','','','']; save();
    localStorage.setItem('okaimono_recipes', JSON.stringify([
      rec(['塩 小さじ1', '胡椒 少々'], [{ t: '切る', d: '細かく' }, { t: '炒める', d: '弱火' + evil }]),
      rec(['塩 小さじ1', '牛乳 200ml'], [{ t: '切る', d: '粗く' }, { t: '煮ない', d: 'そのまま' }])
    ]));
    localStorage.setItem('okaimono_links', JSON.stringify({ 'カレー': 'box:' + bad + '|カレー' }));
    rbTold = false; DO = null; location.hash = '#fridge'; render();
    linkMenu();
    togDish('0|0');
    const panel = document.querySelector('.dpanel');
    const text = panel ? panel.innerText : '';
    const html = panel ? panel.innerHTML : '';
    const before = getLinks()['カレー'] || '';
    const cards = [...document.querySelectorAll('.dpanel .ambig')].map(el => el.innerText);
    const marks = ['胡椒', '牛乳', '細かく', '粗く', '炒める', '煮ない', '弱火', 'そのまま', '小さじ1', '200ml'];
    const see = marks.every(s => text.includes(s));
    const distinct = cards.length === 2 && cards[0] !== cards[1] && cards.some(t => t.includes('胡椒') && t.includes('細かく') && t.includes('炒める')) && cards.some(t => t.includes('牛乳') && t.includes('粗く') && t.includes('煮ない') && t.includes('そのまま'));
    const buttons = [...document.querySelectorAll('.dpanel [data-act=linkdish]')];
    const safe = window.__xss === 0 && !panel.querySelector('img') && html.includes('&lt;img') && buttons.every(b => /^[A-Za-z0-9_-]{1,60}$/.test(b.dataset.id));
    const btn = buttons.find(b => { const t = b.closest('.ambig').innerText; return t.includes('牛乳') && t.includes('粗く') && t.includes('そのまま'); });
    const second = rbox().find(r => (r.ingredients || []).some(x => String(x).includes('牛乳')));
    const first = rbox().find(r => (r.ingredients || []).some(x => String(x).includes('胡椒')));
    if (btn) btn.click();
    linkMenu();
    const after = getLinks()['カレー'] || '';
    const pickedText = (document.querySelector('.dpanel') || {}).innerText || '';
    const stored = JSON.parse(localStorage.getItem('okaimono_recipes') || '[]');
    const blob = JSON.stringify(stored);
    const kept = stored.length === 2 && blob.includes('胡椒') && blob.includes('細かく') && blob.includes('牛乳') && blob.includes('そのまま') && blob.includes('弱火');
    return JSON.stringify({ before, see, distinct, safe, xss: window.__xss, nbtn: buttons.length, picked: !!(second && first && btn && after === 'box:' + second.id + '|カレー' && after.indexOf(first.id) < 0), shows: pickedText.includes('牛乳') && pickedText.includes('粗く') && pickedText.includes('そのまま') && !pickedText.includes('胡椒'), kept });
  })()`);
  const out = { amount: JSON.parse(amount), recipes: JSON.parse(recipes), links: JSON.parse(links), life: lifeJ, waited: JSON.parse(waited), imported, importSoon, importLate: JSON.parse(importLate), reloaded: JSON.parse(reloaded), manualReload: JSON.parse(manualReload), unique: JSON.parse(unique), uniqueLate: JSON.parse(uniqueLate), detail: JSON.parse(detail) };
  const a = out.amount, r = out.recipes, L = out.links, F = out.life, W = out.waited, S0 = out.importSoon || {}, S1 = out.importLate, R = out.reloaded, M = out.manualReload, U = out.uniqueLate, D = out.detail;
  const ok = a.note && a.blank.done === false && a.blank.spend === 0 && a.blank.thuChecked === false && a.blank.said
    && a.zero.done === false && a.zero.spend === 0 && a.zero.said
    && a.bought.done === true && a.bought.n === 1 && a.bought.amount === 480 && a.bought.cat === '日用品' && a.bought.monDone
    && a.undone.done === false && a.undone.n === 0 && a.xss === 0
    && r.xss === 0 && r.before && r.before.text && r.before.count.includes('2件') && r.idsOk && r.keptName && r.keptIng && r.quoteGone && r.linkMoved && r.backupHasBad === false && r.backupHasName && r.restored && r.noOnclick
    && L.imported && L.opened && L.stable && L.ambiguous && L.collision && L.xss === 0
    && F.immediate.L === 'box:id"mark|カレー' && F.immediate.dang && F.afterLink.L === 'box:id"mark|カレー' && F.openOk && F.manualOk && W.still
    && M.L === 'box:' + F.milkId + '|カレー' && M.L2 === M.L
    && S0.L === 'box:id"mark|カレー' && S0.both === '塩,牛乳' && S0.dang && S1.kept && S1.both === '塩,牛乳' && S1.dang
    && R.L === 'box:id"mark|カレー' && R.L2 === R.L && R.dang && R.both === '塩,牛乳' && R.ver === 'okaimono-v66'
    && U.ok
    && D.before === 'box:id"mark|カレー' && D.see && D.distinct && D.safe && D.xss === 0 && D.nbtn === 2 && D.picked && D.shows && D.kept;
  console.log(JSON.stringify(out, null, 2));
  if (!ok) process.exitCode = 2; else console.log('REPRO_OK');
  page.close();
} catch (e) { console.error('FAIL', e); process.exitCode = 1; }
finally { chrome.kill('SIGKILL'); http.kill('SIGKILL'); }
