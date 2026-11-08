// メイミー総点検の再現。前回テストの合否は見ない。隔離プロファイル。外部へは送らない。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const port = 8771;
const dbg = 9333;
const shot = '/tmp/v57-audit';
mkdirSync(shot, { recursive: true });
const http = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${dbg}`, `--user-data-dir=/tmp/chrome-audit-${Date.now()}`,
  '--window-size=390,900', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ready() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://127.0.0.1:${dbg}/json/version`)).ok) return; } catch (e) {}
    await sleep(250);
  }
  throw new Error('chrome が起動しませんでした');
}
function rpc(ws) {
  let n = 0; const wait = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
  return (method, params = {}) => new Promise((res, rej) => {
    const id = ++n; wait.set(id, res); ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (wait.has(id)) { wait.delete(id); rej(new Error('timeout ' + method)); } }, 25000);
  });
}
async function tab(url) {
  const t = await (await fetch(`http://127.0.0.1:${dbg}/json/new?` + encodeURIComponent(url), { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = rpc(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  for (let i = 0; i < 40; i++) {
    const ev = await send('Runtime.evaluate', { expression: 'typeof APP_VER==="string" && document.readyState', returnByValue: true });
    if (ev.result && ev.result.result && ev.result.result.value === 'complete') break;
    await sleep(200);
  }
  return { send, ws, close: () => ws.close() };
}
async function ev(send, expression) {
  const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (out.result.exceptionDetails) throw new Error(JSON.stringify(out.result.exceptionDetails).slice(0, 1200));
  return out.result.result.value;
}
async function shotOf(send, name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shot + '/' + name, Buffer.from(r.result.data, 'base64'));
}

const MAIN = `(() => {
  const R = [];
  const rec = (id, sev, ok, detail) => R.push({ id, sev, ok: !!ok, detail: String(detail).slice(0, 500) });
  window.__xss = 0;
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = () => null;
  const fetches = [];
  const origFetch = window.fetch;
  window.fetch = (u, o) => { fetches.push(String(u).slice(0, 180)); const s = String(u); if (/^https?:/i.test(s) && !/127\\.0\\.0\\.1|localhost/.test(s)) return Promise.reject(new Error('外部は遮断')); return origFetch(u, o); };
  const trip = curTrip(today()).wd;
  // --- 高: まとめ買いのカゴとチェック ---
  S.list = [
    { name: '玉ねぎ 1個', store: '店', trip, done: false, price: 100 },
    { name: '玉ねぎ 2個', store: '店', trip, done: false, price: 200 }
  ];
  S.spend = []; LV = 'trip'; location.hash = '#list'; render();
  const grow = document.querySelector('li[data-del]');
  const gdel = grow && grow.dataset.del;
  const gshown = grow && grow.querySelector('input[data-yen]') && grow.querySelector('input[data-yen]').value;
  rec('group-row', '高', gdel && gdel.includes(',') && gshown === '100', '行=' + gdel + ' 表示金額=' + gshown);
  grow.querySelector('input[data-yen]').value = '100';
  grow.querySelector('button[data-cart]').click();
  document.querySelector('.cartbar button').click();
  rec('group-cart', '高', S.spend.length === 1 && S.spend[0].amount === 100, 'カゴ後の家計=' + JSON.stringify(S.spend.map(x => x.amount)));
  S.list = [
    { name: '玉ねぎ 1個', store: '店', trip, done: false, price: 100 },
    { name: '玉ねぎ 2個', store: '店', trip, done: false, price: 200 }
  ];
  S.spend = []; render();
  const grow2 = document.querySelector('li[data-del]');
  const box = grow2.querySelector('input[data-tm]');
  box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
  rec('group-check', '高', S.spend.length === 1 && S.spend[0].amount === 100, 'チェック後の家計=' + JSON.stringify(S.spend.map(x => x.amount)));
  S.list = [{ name: '豆腐', store: '店', trip, done: false }]; S.spend = []; render();
  const tofu = document.querySelector('li[data-del]');
  tofu.querySelector('input[data-yen]').value = '250';
  tofu.querySelector('button[data-cart]').click();
  document.querySelector('.cartbar button').click();
  rec('single-cart', '高', S.spend.length === 1 && S.spend[0].amount === 250, '豆腐=' + JSON.stringify(S.spend.map(x => x.amount)));
  // 欄を300に書き換えてからカゴ
  S.list = [
    { name: '玉ねぎ 1個', store: '店', trip, done: false, price: 100 },
    { name: '玉ねぎ 2個', store: '店', trip, done: false, price: 200 }
  ];
  S.spend = []; render();
  const g3 = document.querySelector('li[data-del]');
  g3.querySelector('input[data-yen]').value = '300';
  g3.querySelector('button[data-cart]').click();
  document.querySelector('.cartbar button').click();
  rec('group-typed', '高', S.spend.length === 1 && S.spend[0].amount === 300, '入力300の家計=' + JSON.stringify(S.spend.map(x => x.amount)));
  // --- 高: 曜日表示の金額欄 ---
  S.list = [{ name: '豆腐', store: '店', done: false, price: 150, uses: [{ d: 1, dish: '汁' }] }];
  S.spend = []; LV = 'day'; render();
  const dli = document.querySelector('#day1 li');
  const din = dli && dli.querySelector('input[data-yen]');
  rec('day-field', '高', !!din && !document.querySelector('#day1 [id^=yen]'), 'data-yen=' + !!(din) + ' 旧id=' + !!document.querySelector('#day1 [id^=yen]'));
  din.value = '480';
  dli.querySelector('button[data-cart]').click();
  document.querySelector('.cartbar button').click();
  rec('day-cart-typed', '高', S.spend.length === 1 && S.spend[0].amount === 480, '曜日カゴ=' + JSON.stringify(S.spend.map(x => x.amount)) + ' 保存price=' + (S.list[0] && S.list[0].price));
  S.list = [{ name: '豆腐', store: '店', done: false, uses: [{ d: 1, dish: '汁' }] }];
  S.spend = []; render();
  const dli2 = document.querySelector('#day1 li');
  dli2.querySelector('input[data-yen]').value = '480';
  const cb2 = dli2.querySelector('input[data-tm]'); cb2.checked = true; cb2.dispatchEvent(new Event('change', { bubbles: true }));
  rec('day-check-empty', '高', S.spend.length === 1 && S.spend[0].amount === 480, '曜日チェック=' + JSON.stringify(S.spend.map(x => x.amount)));
  // 同じ品が月と火に出る。火の欄だけ480
  S.list = [{ name: '豆腐', store: '店', done: false, price: 150, uses: [{ d: 1, dish: '月' }, { d: 2, dish: '火' }] }];
  S.spend = []; render();
  const tue = document.querySelector('#day2 li');
  tue.querySelector('input[data-yen]').value = '480';
  tue.querySelector('button[data-cart]').click();
  rec('day-second-row', '高', S.list[0].price === 480, '火の欄のあと price=' + S.list[0].price + ' 月の欄=' + (document.querySelector('#day1 input[data-yen]') && document.querySelector('#day1 input[data-yen]').value));
  // --- 高: XSS ---
  const evil = '"><img src=x onerror="window.__xss=1">';
  const evil2 = "x' onfocus='window.__xss=2";
  localStorage.setItem('okaimono_recipes', JSON.stringify([
    { id: evil, name: '悪id', ingredients: ['卵'], steps: [{ t: '作る', d: '切る' }] },
    { id: 'safeid01', name: '<b>太字にならない料理</b><img src=x onerror="window.__xss=3">', ingredients: ['<b>卵</b>'], steps: [{ t: '<img src=x onerror="window.__xss=4">', d: '中火' }] }
  ]));
  RBO = 'safeid01'; location.hash = '#fridge'; render();
  const rhtml = (document.getElementById('rbox') || document.body).innerHTML;
  rec('xss-recipe-id', '高', window.__xss === 0 && !rhtml.includes('onclick="rbox') && !document.querySelector('#rbox img') && !document.querySelector('#rbox b'), 'xss=' + window.__xss + ' img=' + document.querySelectorAll('#rbox img').length + ' b=' + document.querySelectorAll('#rbox b').length + ' 悪id表示=' + rhtml.includes('悪id'));
  S.fridge = [{ id: evil, name: '倉庫悪', zone: '倉庫' }, { id: evil2, name: '引用', zone: '倉庫' }, { id: 'ok1', name: '牛乳', zone: '倉庫' }];
  location.hash = '#stock'; render();
  const whtml = document.getElementById('view').innerHTML;
  const broken = whtml.includes('data-whid=""><img') || whtml.includes('onchange="WHS');
  document.querySelectorAll('input[data-whid]').forEach(el => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
  render();
  rec('xss-warehouse', '高', window.__xss === 0 && !broken && whtml.includes('&lt;img') && whtml.includes('data-whid="'), 'xss=' + window.__xss + ' broken=' + broken);
  localStorage.setItem('okaimono_hist', JSON.stringify([{ id: evil, at: '2026-11-01T00:00:00.000Z', src: 't', sig: 's', item: { kind: 'chat', reply: '<img src=x onerror="window.__xss=5">', title: 't' } }]));
  AT.open = null; AT.lesson = null; location.hash = '#ai'; render();
  const hhtml = document.getElementById('view').innerHTML;
  rec('xss-hist', '高', window.__xss === 0 && hist().length === 1 && !hhtml.includes('<img src=x') && hhtml.includes('&lt;img'), 'n=' + hist().length + ' xss=' + window.__xss);
  // --- 高: キー、CSP、バックアップ ---
  localStorage.setItem('okaimono_secret', JSON.stringify({ url: 'https://example.com/hook', key: 'ABCDEFGHIJKLMNOP', header: 'X-App-Pass' }));
  location.hash = '#settings'; render();
  const setTxt = document.body.innerText;
  rec('key-mask', '高', setTxt.includes('設定済み（キーは表示しません）') && !setTxt.includes('ABCDEFGHIJKLMNOP') && !setTxt.includes('MNOP'), '末尾表示なし');
  rec('no-origin-gate', '高', !document.getElementById('migrate') && typeof wipeSecret !== 'function' && typeof originShared !== 'function' && !!document.getElementById('c_url') && document.getElementById('c_key') && document.getElementById('c_key').type === 'password', '設定の相談欄');
  const fetchesGate = [];
  const fetchGate = window.fetch;
  window.fetch = (u, o) => { fetchesGate.push(String(u)); return Promise.reject(new Error('blocked')); };
  CON.open = true; CON.from = '#settings'; CON.type = 'menu'; CON.stage = 'confirm'; CON.q = '献立の確認'; CON.sending = false;
  sendConsult();
  rec('consult-not-gated', '高', fetchesGate.length === 1 && !(CON.status || '').includes('このアドレスからは送信しません') && !(CON.status || '').includes('専用アドレス'), (CON.status || '') + ' fetches=' + fetchesGate.length);
  window.fetch = fetchGate;
  rec('csp-meta', '高', !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'), (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || 'なし');
  let captured = null;
  const oldCreate = URL.createObjectURL;
  URL.createObjectURL = function (b) { captured = b; return oldCreate.call(URL, b); };
  const oldClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {};
  backup();
  HTMLAnchorElement.prototype.click = oldClick;
  URL.createObjectURL = oldCreate;
  return captured.text().then(t => {
    rec('backup-excludes-key', '高', !t.includes('ABCDEFGHIJKLMNOP') && !t.includes('okaimono_secret') && t.includes('okaimono'), 'len=' + t.length);
    // --- 中: 復元は置換 ---
    S.list = [{ name: 'いまの卵', done: false }];
    S.spend = [];
    localStorage.setItem('okaimono_ledger', JSON.stringify({ months: { '2026-09': { total: 111 } }, sentAt: '2020-01-01' }));
    localStorage.setItem('okaimono_recipes', JSON.stringify([{ id: 'keepme01', name: '既存', ingredients: ['塩'], steps: [{ t: '作る', d: '' }] }]));
    localStorage.setItem('okaimono_orders', JSON.stringify([{ id: 'okeep1234', at: '2026-01-01T00:00:00.000Z', mode: 'goods', items: [{ name: '残す' }] }]));
    localStorage.setItem('okaimono_hist', JSON.stringify([{ id: 'hlocal1', at: '2026-01-01T00:00:00.000Z', src: '', sig: 'a', item: { kind: 'chat', reply: 'local', title: 't' } }]));
    const backupObj = { app: 'okaimono', version: 2, exported: '2026-11-08T00:00:00.000Z',
      data: { version: 2, settings: S.settings, list: [{ name: '復元たまご', done: false }], spend: [], fridge: [], whrc: [], menu: ['', '', '', '', '', '', ''], prep: '', userStores: [] },
      links: {},
      hist: [{ id: 'hbackup1', at: '2026-11-01T00:00:00.000Z', src: '', sig: '', item: { kind: 'chat', reply: 'bk', title: 't' } }, { id: evil, at: '2026-11-01T00:00:00.000Z', item: { kind: 'nope' } }],
      extra: {
        ledger: { months: { '2026-08': { total: 5 }, '2026-09': { total: 5 } } },
        recipes: [{ id: 'newone01', name: '追加レシピ', ingredients: ['卵'], steps: [{ t: '焼く', d: '200℃' }] }],
        orders: [{ id: 'oabc1234', at: '2026-11-01T00:00:00.000Z', mode: 'goods', items: [{ name: '水' }] }]
      } };
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(backupObj)], 'b.json', { type: 'application/json' }));
    const inp = document.createElement('input'); inp.type = 'file'; inp.files = dt.files;
    const alerts = [];
    window.alert = m => alerts.push(String(m));
    window.confirm = () => true;
    restore({ target: inp });
    return new Promise(res => setTimeout(res, 400)).then(() => {
      const led = JSON.parse(localStorage.getItem('okaimono_ledger') || '{}');
      const recp = JSON.parse(localStorage.getItem('okaimono_recipes') || '[]');
      const ords = JSON.parse(localStorage.getItem('okaimono_orders') || '[]');
      const histJ = JSON.parse(localStorage.getItem('okaimono_hist') || '[]');
      const sec = localStorage.getItem('okaimono_secret') || '';
      rec('restore-list', '中', S.list.length === 1 && S.list[0].name === '復元たまご', JSON.stringify(S.list.map(x => x.name)));
      rec('restore-ledger', '中', led.months && led.months['2026-08'] && led.months['2026-08'].total === 5 && led.months['2026-09'] && led.months['2026-09'].total === 5 && !led.sentAt, JSON.stringify(led).slice(0, 300));
      rec('restore-recipes', '中', recp.length === 1 && recp[0].id === 'newone01' && !recp.some(x => x.id === 'keepme01'), recp.map(x => x.id).join(','));
      rec('restore-orders', '中', ords.length === 1 && ords[0].id === 'oabc1234', ords.map(x => x.id).join(','));
      rec('restore-hist', '中', histJ.length === 1 && histJ[0].id === 'hbackup1', histJ.map(x => x.id).join(',') + ' inbox=' + (typeof INBOX !== 'undefined' ? INBOX.length : '?'));
      rec('restore-keeps-secret', '中', sec.includes('ABCDEFGHIJKLMNOP'), 'キーは復元対象外');
      rec('restore-bad-rejected', '中', true, 'この後に壊れたJSONを足す');
      const dt2 = new DataTransfer();
      dt2.items.add(new File(['{'], 'bad.json', { type: 'application/json' }));
      const inp2 = document.createElement('input'); inp2.type = 'file'; inp2.files = dt2.files;
      restore({ target: inp2 });
      return new Promise(res => setTimeout(res, 300)).then(() => {
        rec('restore-bad-json', '中', S.list.length === 1 && S.list[0].name === '復元たまご' && alerts.some(a => a.includes('読めませんでした')), alerts.join(' / ').slice(0, 240));
        // 行だけ落ちる
        const mixed = JSON.parse(JSON.stringify(backupObj));
        mixed.data.list = [{ name: 'たまご', done: false }, { name: 'あ'.repeat(201), done: false }];
        mixed.data.spend = [{ date: '2026-11-01', amount: -5, store: 'x', cat: '食材' }, { date: '2026-11-02', amount: 200, store: '店', cat: '食材' }];
        mixed.data.fridge = [{ name: '牛乳', zone: '宇宙' }, { name: '牛乳', zone: '冷蔵室' }];
        const dt3 = new DataTransfer();
        dt3.items.add(new File([JSON.stringify(mixed)], 'm.json', { type: 'application/json' }));
        const inp3 = document.createElement('input'); inp3.type = 'file'; inp3.files = dt3.files;
        alerts.length = 0; restore({ target: inp3 });
        return new Promise(res => setTimeout(res, 300));
      }).then(() => {
        rec('restore-drop-rows', '中', S.list.length === 1 && S.list[0].name === 'たまご' && S.spend.length === 1 && S.spend[0].amount === 200 && S.fridge.length === 1 && S.fridge[0].zone === '冷蔵室', 'list=' + S.list.length + ' spend=' + S.spend.map(x => x.amount) + ' fridge=' + S.fridge.map(x => x.zone));
        // --- 低: 空白品名 ---
        location.hash = '#list'; LV = 'trip'; S.list = []; render();
        const name = document.getElementById('li_name'); name.value = '   ';
        [...document.querySelectorAll('button')].find(b => b.textContent.includes('リストに追加')).click();
        rec('blank-name', '低', S.list.length === 0, '件数=' + S.list.length);
        name.value = '卵'; [...document.querySelectorAll('button')].find(b => b.textContent.includes('リストに追加')).click();
        rec('real-name', '低', S.list.length === 1 && S.list[0].name === '卵', S.list.map(x => x.name).join(','));
        // URL
        const urlCases = {
          'https://www.amazon.co.jp/cart': true,
          'javascript:alert(1)': false,
          'http://www.amazon.co.jp/cart': false,
          'https://user:pass@www.amazon.co.jp/cart': false,
          'https://www.amazon.co.jp:444/cart': false,
          'https://www.amazon.co.jp:80/cart': false,
          'https://amazon.co.jp.evil.example/cart': false,
          'https://www.amazon.co.jp:443/cart': true
        };
        const urlObs = {};
        Object.entries(urlCases).forEach(([u, expect]) => { urlObs[u] = { got: !!shopUrl(u), expect }; });
        rec('shop-url', '低', Object.entries(urlObs).every(([u, o]) => o.got === o.expect), JSON.stringify(urlObs));
        const before = fetches.length;
        askOrder([{ name: '水', qty: '1' }], 'goods');
        rec('order-no-network', '低', fetches.length === before && CON.stage === 'confirm' && CON.type === 'order' && CON.extra && CON.extra.order && CON.extra.order.stopAt === 'cart' && CON.extra.order.payment === 'self', 'fetch増分=' + (fetches.length - before) + ' stage=' + CON.stage);
        // --- 中: コントラストとタップ ---
        const probe = document.createElement('a'); probe.className = 'link'; probe.textContent = '見本'; probe.style.background = '#fff1e6';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const rgb = cs.color.match(/\\d+/g).map(Number);
        const bg = [255, 241, 230];
        const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const L = a => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
        const ratio = (rgb[0] === undefined) ? 0 : ((Math.max(L(rgb), L(bg)) + 0.05) / (Math.min(L(rgb), L(bg)) + 0.05));
        const whiteRatio = (Math.max(L(rgb), L([255, 255, 255])) + 0.05) / (Math.min(L(rgb), L([255, 255, 255])) + 0.05);
        rec('contrast', '中', ratio >= 4.5 && whiteRatio >= 4.5, 'sale=' + ratio.toFixed(2) + ' white=' + whiteRatio.toFixed(2) + ' color=' + cs.color);
        probe.remove();
        location.hash = '#home'; render();
        const navH = Math.min(...[...document.querySelectorAll('nav a')].map(a => a.getBoundingClientRect().height));
        location.hash = '#stores'; render();
        const small = [];
        document.querySelectorAll('button, a, summary, .dlvh, .chip, nav a, .frchip').forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return;
          if (b.height < 44 || (b.width < 44 && b.height < 44)) small.push(el.tagName + '.' + (el.className || '').toString().slice(0, 24) + '=' + Math.round(b.width) + 'x' + Math.round(b.height));
        });
        rec('tap-nav', '低', navH >= 44, 'nav=' + navH);
        rec('tap-small', '低', small.length === 0, small.slice(0, 12).join(' ; ') || '44未満なし');
        rec('reduced-motion', '低', [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /prefers-reduced-motion/.test(r.cssText || '')); } catch (e) { return false; } }), 'style.css の有無');
        // 倉庫 UI
        S.fridge = [{ id: 'w1', name: '牛乳', zone: '倉庫' }, { id: 'w2', name: '卵', zone: '倉庫', sug: '冷蔵室' }];
        WHS.clear(); location.hash = '#stock'; render();
        [...document.querySelectorAll('button')].find(b => b.textContent.includes('ぜんぶ選ぶ')).click();
        const allOn = S.fridge.filter(f => f.zone === '倉庫').every(f => WHS.has(f.id));
        [...document.querySelectorAll('button')].find(b => b.textContent.includes('ぜんぶ外す')).click();
        const allOff = WHS.size === 0;
        document.querySelector('input[data-whid="w1"]').click();
        [...document.querySelectorAll('button')].find(b => b.textContent.includes('冷蔵室')).click();
        const moved = S.fridge.find(f => f.id === 'w1').zone === '冷蔵室' && S.fridge.find(f => f.id === 'w2').zone === '倉庫';
        document.querySelector('input[data-whid="w2"]').click();
        [...document.querySelectorAll('button')].find(b => b.textContent.includes('倉庫から消す')).click();
        rec('warehouse-ui', '中', allOn && allOff && moved && !S.fridge.some(f => f.id === 'w2'), 'allOn=' + allOn + ' allOff=' + allOff + ' moved=' + moved + ' left=' + S.fridge.map(f => f.id + f.zone).join(','));
        // レッスンとトースター
        const sample = MOCK.menu(aiContext('menu'));
        const blob = JSON.stringify(sample);
        rec('toaster-mock', '高', /グリルトースター/.test(sample.recipe.name) && !/グリルパンに入れて|アルミホイルを敷|ふたをして|330/.test(blob) && blob.includes('品番'), 'steps=' + sample.recipe.steps.length);
        AT.lesson = { name: '<img src=x onerror="window.__xss=9">', serves: '1', ingredients: ['卵'], steps: [{ t: '炒める', d: 'フライパンを中火にする', tip: 'しんなり', min: 2 }, { t: '盛る', d: '' }] };
        AT.step = 0; TM.step = -2; location.hash = '#ai'; render();
        const lessonHtml = document.body.innerHTML;
        rec('lesson-xss-heat', '高', window.__xss === 0 && !document.querySelector('.lesson img') && document.body.innerText.includes('熱と油の注意') && document.body.innerText.includes('しんなり') && !document.body.innerText.includes('グリルパンで'), 'xss=' + window.__xss);
        AT.step = -1; AT.lesson = sample.recipe; TM.step = -2; render();
        rec('lesson-prep-safety', '高', document.body.innerText.includes('品番は不明') && document.body.innerText.includes('15分') && document.body.innerText.includes('手順は'), 'prep');
        const note = kitchenNote();
        rec('kitchen-note', '高', note.includes('100℃') && note.includes('280℃') && note.includes('15分') && note.includes('品番は不明') && note.includes('書かないでください') && !/グリルパン(に入れて|で焼)/.test(note), 'len=' + note.length);
        rec('pay-note-unchanged', '仕様', typeof payNote === 'function' && payNote().includes('浩二'), '個人名の呼びかけは維持');
        rec('region-unchanged', '仕様', S.settings.region === 'mukonoso', S.settings.region);
        // 家計の枠
        S.spend = [
          { id: 's1', date: '2026-11-02', amount: 1000, cat: '食材', store: 'a' },
          { id: 's2', date: '2026-11-04', amount: 500, cat: '食材・米', store: 'a' },
          { id: 's3', date: '2026-11-05', amount: 2000, cat: '食材', store: 'a' },
          { id: 's4', date: '2026-11-06', amount: 10, cat: '食材', store: 'a' },
          { id: 's5', date: '2026-11-06', amount: 300, cat: '雑費', store: 'a' },
          { id: 's6', date: '2026-11-06', amount: 40, cat: 'タバコ', store: 'a' },
          { id: 's7', date: '2026-11-06', amount: 30, cat: 'お酒', store: 'a' },
          { id: 's8', date: '2026-10-31', amount: 4000, cat: '食材', store: 'a' }
        ];
        const inside = spentBetween('2026-11-01', '2026-11-30');
        const tripNow = spentBetween('2026-11-05', '2026-11-08');
        const mm = monthsFrom(S.spend)['2026-11'];
        rec('ledger-split', '中', inside === 3510 && tripNow === 2010 && mm.total === 3510 && mm.zappi === 300 && mm.tabako === 40 && mm.sake === 30, 'inside=' + inside + ' trip=' + tripNow + ' ' + JSON.stringify({ t: mm.total, z: mm.zappi, tb: mm.tabako, sk: mm.sake }));
        rec('no-wakugai-word', '低', true, '画面は別ナビゲーションで見る');
        rec('app-ver', '情報', APP_VER === 'okaimono-v63', APP_VER);
        return JSON.stringify(R);
      });
    });
  });
})()`;

try {
  await ready();
  const page = await tab(`http://127.0.0.1:${port}/index.html`);
  await sleep(600);
  const main = JSON.parse(await ev(page.send, MAIN));
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?today=2026-11-06#money` });
  for (let i = 0; i < 30; i++) {
    const t = await ev(page.send, `document.body && document.body.innerText.includes('家計')`);
    if (t) break;
    await sleep(200);
  }
  const money = await ev(page.send, `(() => {
    S.spend = [
      {id:'s1',date:'2026-11-02',amount:1000,cat:'食材',store:'a'},
      {id:'s2',date:'2026-11-04',amount:500,cat:'食材',store:'a'},
      {id:'s3',date:'2026-11-05',amount:2000,cat:'食材',store:'a'},
      {id:'s4',date:'2026-11-06',amount:10,cat:'食材',store:'a'},
      {id:'s5',date:'2026-11-06',amount:300,cat:'雑費',store:'a'},
      {id:'s6',date:'2026-11-06',amount:40,cat:'たばこ',store:'a'},
      {id:'s7',date:'2026-11-06',amount:30,cat:'酒',store:'a'}
    ];
    save(); render();
    const txt = document.body.innerText;
    return JSON.stringify({ hasWakugai: txt.includes('枠の外'), hasTabako: txt.includes('たばこ'), hasSake: txt.includes('酒'), hasZappi: txt.includes('雑費'), trip: (txt.match(/木曜分[\\s\\S]{0,80}/)||[''])[0].replace(/\\s+/g,' ').slice(0,80) });
  })()`);
  await shotOf(page.send, 'money.png');
  // 破損起動
  await ev(page.send, `localStorage.setItem('okaimono_v1','{');`);
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  await sleep(800);
  const corrupt = await ev(page.send, `(() => {
    const banner = document.body.innerText.includes('保存データを読めませんでした');
    const raw = (JSON.parse(localStorage.getItem('okaimono_v1_rescue')||'[]')[0]||{}).raw;
    const saved = save() === false && localStorage.getItem('okaimono_v1') === '{';
    return JSON.stringify({ banner, rawIsBrace: raw === '{', savedBlocked: saved, err: typeof LOAD_ERR==='string'?LOAD_ERR:'' });
  })()`);
  await shotOf(page.send, 'corrupt.png');
  // 他キャッシュ
  let sw = '{"threw":true}';
  try { sw = await ev(page.send, `(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    await caches.open('lifehack-cache-test');
    await caches.open('okaimono-v51');
    let err = '';
    try {
      const reg = await navigator.serviceWorker.register('./sw.js?audit=1', { scope: './', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      const w = reg.installing || reg.waiting;
      if (w) await new Promise(res => { w.addEventListener('statechange', res); setTimeout(res, 8000); });
      await new Promise(res => setTimeout(res, 2000));
    } catch (e) { err = String(e && e.message || e); }
    return JSON.stringify({ keys: await caches.keys(), err, ctrl: !!(navigator.serviceWorker.controller) });
  })()`); } catch (e) { sw = JSON.stringify({ threw: String(e).slice(0, 240) }); }
  await sleep(1500);
  const swPage = await tab(`http://127.0.0.1:${port}/index.html`);
  const swAfter = await ev(swPage.send, `(async () => JSON.stringify({ keys: await caches.keys(), script: (navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL) || '' }))()`);
  // 複数タブ
  await ev(swPage.send, `localStorage.setItem('okaimono_v1', JSON.stringify({version:2,settings:{shopDays:[1,4],fridgeDay:0,perTrip:9000,monthly:100000,region:'mukonoso',aiRelay:''},list:[{name:'タブA',done:false}],spend:[],fridge:[],menu:['','','','','','',''],prep:'',userStores:[]}));`);
  const a = await tab(`http://127.0.0.1:${port}/index.html#list`);
  const b = await tab(`http://127.0.0.1:${port}/index.html#list`);
  await sleep(700);
  const tabs = await ev(a.send, `(() => { const before=S.list.map(x=>x.name).join(','); S.list.push({name:'タブAが追加',done:false}); save(); return before; })()`);
  await sleep(400);
  const tabsB = await ev(b.send, `(() => { const seen=S.list.map(x=>x.name).join(','); S.list.push({name:'タブBが追加',done:false}); save(); return seen; })()`);
  const tabsAfter = await ev(a.send, `localStorage.getItem('okaimono_v1')`);
  a.close(); b.close(); swPage.close(); page.close();
  const out = { main: JSON.parse(typeof main === 'string' ? main : JSON.stringify(main)), money: JSON.parse(money), corrupt: JSON.parse(corrupt), sw: JSON.parse(sw), swAfter: JSON.parse(swAfter), tabs: { aLoaded: tabs, bSaw: tabsB, stored: JSON.parse(tabsAfter).list.map(x => x.name) } };
  writeFileSync(shot + '/results.json', JSON.stringify(out, null, 2));
  const bad = out.main.filter(x => !x.ok);
  console.log(JSON.stringify({ bad, money: out.money, corrupt: out.corrupt, sw: out.sw, swAfter: out.swAfter, tabs: out.tabs }, null, 2));
  if (bad.length) process.exitCode = 2;
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
  http.kill('SIGKILL');
}
