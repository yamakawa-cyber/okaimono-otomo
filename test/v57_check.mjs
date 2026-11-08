// 見本ブラウザで、料理レッスン・グリルトースター条件・監査の回帰を確かめる。
// 使い方: node test/v57_check.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 8765;
const shotDir = process.env.SHOT_DIR || '/tmp/v57-shots';
mkdirSync(shotDir, { recursive: true });
const http = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/chrome-v57-' + Date.now(),
  '--window-size=390,844', 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function jsonList() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9222/json/version');
      if (r.ok) return;
    } catch (e) {}
    await sleep(250);
  }
  throw new Error('chrome のデバッグポートが開きませんでした');
}
function rpc(ws) {
  let n = 0; const wait = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  });
  return (method, params = {}) => new Promise((res, rej) => {
    const id = ++n; wait.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (wait.has(id)) { wait.delete(id); rej(new Error('timeout ' + method)); } }, 20000);
  });
}
async function openPage(url) {
  const r = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = rpc(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (let i = 0; i < 40; i++) {
    const ev = await send('Runtime.evaluate', { expression: 'typeof lessonView==="function" && document.readyState', returnByValue: true });
    if (ev.result && ev.result.result && ev.result.result.value === 'complete') break;
    await sleep(200);
  }
  return { ws, send, close: () => ws.close() };
}
async function evalJson(send, expression) {
  const ev = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (ev.result.exceptionDetails) throw new Error(JSON.stringify(ev.result.exceptionDetails).slice(0, 800));
  return ev.result.result.value;
}
async function waitText(send, text) {
  for (let i = 0; i < 40; i++) {
    const v = await evalJson(send, `!!(document.body && document.body.innerText.includes(${JSON.stringify(text)}))`);
    if (v) return;
    await sleep(250);
  }
  const got = await evalJson(send, `(document.body && document.body.innerText || '').slice(0, 400)`);
  throw new Error('見つからない: ' + text + ' / ' + got);
}
async function shot(send, name, full) {
  const ev = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full, fromSurface: true });
  const p = join(shotDir, name);
  writeFileSync(p, Buffer.from(ev.result.data, 'base64'));
  return p;
}

const LOGIC = `(() => {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  window.alert = () => {}; window.confirm = () => true;
  const note = kitchenNote();
  ok(note.includes('100℃') && note.includes('280℃') && note.includes('15分') && note.includes('品番は不明'), '器具の事実');
  ok(note.includes('書かないでください'), '断定を避ける文言');
  ok(!/グリルパン(に入れて|で焼|を使って)/.test(note), 'グリルパンを使うと書いていない');
  ok(!/アルミホイルを(敷|使)/.test(note), 'ホイルを使うと書いていない');
  ok(!/330/.test(note), '未確認の330℃が無い');
  const menu = JSON.parse(consultPayload('menu', '献立').body);
  ok(menu.data.kitchen && menu.data.kitchen.modelKnown === false, 'kitchen.modelKnown');
  ok(menu.data.kitchen.tempC[0] === 100 && menu.data.kitchen.tempC[1] === 280 && menu.data.kitchen.timerMin === 15, '温度とタイマー');
  ok(menu.data.kitchen.doNotAssert.includes('グリルパン') && menu.data.kitchen.doNotAssert.includes('蒸す'), '避ける項目');
  ok(!JSON.parse(consultPayload('shop', 'リスト').body).data.kitchen, '買い物相談に器具を足さない');
  ok(JSON.parse(consultPayload('recipe', 'レシピ').body).data.kitchen.modelKnown === false, 'レシピにも器具');
  const q = QUICK.find(x => x[1].includes('今夜の献立'));
  ok(q[2].includes('品番は不明') && q[2].includes('15分'), 'ワンタップ献立');
  ok(QUICK.find(x => x[1].includes('作り置き'))[2].includes('グリルトースター'), '作り置き');
  ok(QUICK.find(x => x[1].includes('出前'))[2].includes('品番は不明'), '作るが出前');
  ok(orgQuestion('ごぼう', true).includes('kind:"recipe"') && orgQuestion('ごぼう', false).includes('品番は不明'), 'オリジナルの形は維持');
  frMenu();
  ok(CON.type === 'menu' && CON.q.includes('期限が近い') && CON.q.includes('100℃'), '冷蔵庫からの献立');
  askRecipe(1, '焼き魚');
  ok(CON.type === 'recipe' && CON.q.includes('月曜の「焼き魚」') && CON.q.includes('書かないでください'), '曜日レシピ');
  const ctx = aiContext('menu');
  ok(ctx.kitchen && ctx.kitchen.modelKnown === false, '旧経路の献立文脈');
  ok(!aiContext('money').kitchen, '家計の文脈には器具を足さない');
  const sample = MOCK.menu(ctx);
  checkAI(sample);
  const blob = JSON.stringify(sample.recipe);
  ok(/グリルトースター/.test(sample.recipe.name), '見本レシピ名');
  ok(sample.recipe.steps.length >= 6 && sample.recipe.steps.every(s => s.t && s.d), '見本の手順');
  ok(!/グリルパンに入れて|アルミホイルを敷|ふたをして/.test(blob), '見本が未確認の調理を指示していない');
  ok(blob.includes('15分') && blob.includes('品番'), '見本に制限');
  const kept = rbNorm(sample.recipe);
  ok(kept.steps.some(s => s.tip) && kept.steps.some(s => s.min), 'tip と min を保管');
  ok(!rbValid({ id: 'x" onclick="alert(1)', name: 'a', ingredients: ['卵'], steps: [{ t: '作る', d: '' }] }), '壊れた id は保管しない');
  AT.lesson = { name: '<img src=x onerror=alert(1)>', serves: '1', time: '1', ingredients: ['<b>卵</b>'], steps: [{ t: '切る<img>', d: '中火で炒めます', tip: 'しんなり', min: 3 }, { t: '盛る', d: '粗熱をとる', min: 1 }] };
  AT.step = 0; AT.checked = {}; TM.step = -2;
  let html = lessonView(AT.lesson);
  ok(html.includes('&lt;img') && !html.includes('<img src=x') && !html.includes('<b>卵</b>'), 'レッスンのXSS');
  ok(html.includes('ことば') && html.includes('中火') && html.includes('しんなり') && html.includes('このあと'), 'ことばと次の手順');
  ok(html.includes('熱と油の注意') && !html.includes('熱源の注意（'), '炒めは熱の注意。トースターカードは出さない');
  document.getElementById('view').innerHTML = html;
  ok(document.querySelectorAll('#view img').length === 0, '描画後も img が無い');
  AT.step = -1; AT.lesson = sample.recipe; TM.step = -2;
  html = lessonView(sample.recipe);
  ok(html.includes('始める前に') && html.includes('手順は ' + sample.recipe.steps.length) && html.includes('熱源の注意') && html.includes('品番は不明'), '開始画面');
  ok(!/グリルパンで/.test(html), '開始画面がグリルパン調理を断定しない');
  S.list = [{ name: '玉子', store: '店', done: false, price: 120, cat: '食材' }, { name: '玉子 2個', store: '店', done: false }];
  S.spend = []; LV = 'trip'; location.hash = '#list'; render();
  const li = document.querySelector('li[data-del]');
  ok(!!li && li.dataset.del.includes(','), '同名は1行');
  const yen = li.querySelector('input[data-yen]'); yen.value = '120';
  const box = li.querySelector('input[data-tm]'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
  ok(S.spend.length === 1 && S.spend[0].amount === 120, 'カゴの1行は家計1件');
  ok(S.list.every(i => i.done && i.spendId === S.spend[0].id), '行は同じ家計id');
  const m = monthsFrom([{ date: '2026-11-01', amount: 100, cat: '食材' }, { date: '2026-11-02', amount: 400, cat: 'たばこ' }, { date: '2026-11-03', amount: 500, cat: '酒' }, { date: '2026-11-04', amount: 200, cat: '雑費' }]);
  ok(m['2026-11'].total === 100 && m['2026-11'].tabako === 400 && m['2026-11'].sake === 500 && m['2026-11'].zappi === 200, 'たばこ酒は枠外');
  ok(!isFood({ name: 'ガソリン', type: '食材', category: '食材' }) && isFood({ name: '牛乳', type: '食材' }), '倉庫は食材だけ');
  const before = S.list.length; addItem('   '); ok(S.list.length === before, '空白の品名は拒否');
  localStorage.setItem('okaimono_ledger', JSON.stringify({ months: { '2020-01': { total: 1 } }, sentAt: '2020-01-01' }));
  BKX.ledger.set({ months: { '2024-05': { total: 9 } }, budget: 1 });
  const L = JSON.parse(localStorage.getItem('okaimono_ledger'));
  ok(L.months['2024-05'] && !L.months['2020-01'] && !L.sentAt, '家計の復元は置き換え');
  localStorage.setItem('okaimono_recipes_demo', JSON.stringify([{ id: 'keepme01', name: '残す', ingredients: ['塩'], steps: [{ t: '作る', d: '' }] }]));
  BKX.recipes.set([{ id: 'newone01', name: '新しい', ingredients: ['卵'], steps: [{ t: '焼く', d: '200℃', tip: 'そばを離れない', min: 10 }] }]);
  const boxR = rbox();
  ok(boxR.length === 1 && boxR[0].id === 'newone01' && boxR[0].steps[0].tip === 'そばを離れない' && boxR[0].steps[0].min === 10, 'レシピ復元は置き換え');
  INBOX.length = 0;
  const histOk = checkHist([{ id: 'okhist1', at: '2026-11-01T00:00:00.000Z', item: { kind: 'chat', reply: 'hi', title: 't' } }, { id: 'badshape', item: { kind: 'nope' } }]);
  ok(histOk.length === 1 && histOk[0].id === 'okhist1', '形のよい返事だけ戻す');
  ok(INBOX.some(x => x.err && x.err.includes('形')), '壊れた返事は捨てず保持');
  localStorage.setItem('okaimono_pending', JSON.stringify([{ id: 'cbotpush1', type: 'bot', at: Date.now() }, { id: 'cabc1234', type: 'menu', at: Date.now() }]));
  ok(waitN() === 1, '差し入れ箱は待ち件数に入れない');
  localStorage.setItem('okaimono_secret', JSON.stringify({ url: 'https://example.com/hook', key: 'SECRETKEYVALUE', header: 'X-App-Pass' }));
  const extra = {}; Object.entries(BKX).forEach(([k, x]) => { try { extra[k] = x.get(); } catch (e) {} });
  const dumped = JSON.stringify({ app: 'okaimono', data: S, extra, hist: hist() });
  ok(!dumped.includes('SECRETKEYVALUE'), 'バックアップに送信キーを入れない');
  const pan = { name: '炒め', ingredients: ['卵'], steps: [{ t: '炒める', d: 'フライパンを中火にする', tip: '', min: 2 }] };
  AT.lesson = pan; AT.step = 0; TM.step = -2;
  const panHtml = lessonView(pan);
  ok(panHtml.includes('熱と油の注意') && !panHtml.includes('アラジンのグリルトースター（グリーン）は'), 'トースターを使わない手順に器具カードを出さない');
  return JSON.stringify({ fails, steps: sample.recipe.steps.map(s => s.t) });
})()`;

const CLICK = `(() => {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  window.alert = () => {};
  const click = s => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(s)); if (!b) { fails.push('ボタンが無い: ' + s); return; } b.click(); };
  ok(document.body.textContent.includes('始める前に'), '開始画面が出ている');
  document.querySelectorAll('ul.chk input').forEach(x => { x.checked = true; x.dispatchEvent(new Event('change')); });
  ok(document.getElementById('ls_n').textContent === String(document.querySelectorAll('ul.chk input').length), '材料チェックの件数');
  click('はじめる');
  ok(document.body.textContent.includes('手を洗って'), '最初の手順');
  ok(document.body.textContent.includes('このあと'), '次が見える');
  click('つぎへ');
  ok(document.body.textContent.includes('野菜を切る') && document.body.textContent.includes('包丁'), '切る手順と包丁');
  click('前の手順');
  ok(document.body.textContent.includes('手を洗って'), '前の手順へ戻れる');
  click('つぎへ'); click('つぎへ'); click('つぎへ'); click('つぎへ');
  ok(document.querySelector('.lesson h2').textContent.includes('トースターの温度') && document.body.textContent.includes('品番は不明'), '温度の手順');
  ok(!document.body.textContent.includes('グリルパンで'), 'グリルパン調理を断定しない');
  click('つぎへ');
  ok(document.body.textContent.includes('並べて焼く') && document.body.textContent.includes('15分'), '焼く手順');
  const timer = document.getElementById('lt_btn');
  ok(!!timer, 'タイマーがある');
  timer.click();
  ok(document.getElementById('lt_btn').textContent.includes('止める'), 'タイマーが動く');
  document.getElementById('lt_btn').click();
  return JSON.stringify({ fails });
})()`;

try {
  await jsonList();
  const page = await openPage('http://127.0.0.1:' + port + '/index.html?demo=1&ai=menu&lesson=0');
  await sleep(800);
  const logic = JSON.parse(await evalJson(page.send, LOGIC));
  if (logic.fails.length) { console.log(JSON.stringify(logic, null, 2)); throw new Error('logic ' + logic.fails.length); }
  await page.send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html?demo=1#ai' });
  for (let i = 0; i < 25; i++) {
    const shown = await evalJson(page.send, `(() => { if (typeof render==='function' && location.hash!=='#ai') location.hash='#ai'; return !!(document.body && document.body.innerText.includes('ワンタップ相談') && !document.getElementById('migrate')); })()`).catch(() => false);
    if (shown) break;
    await sleep(300);
    if (i === 24) throw new Error('アキラちゃん欄が開きません');
  }
  await evalJson(page.send, `(async()=>{AI.mode='menu';await aiAsk();AT.open='demo';location.hash='#ai';render();})()`);
  await waitText(page.send, '料理レッスンを始める');
  await shot(page.send, 'lesson-entry.png');
  await evalJson(page.send, `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('料理レッスンを始める')).click()`);
  await waitText(page.send, '始める前に、材料をそろえる');
  await shot(page.send, 'lesson-prep.png', true);
  const clicked = JSON.parse(await evalJson(page.send, CLICK));
  if (clicked.fails.length) { console.log(JSON.stringify(clicked, null, 2)); throw new Error('click ' + clicked.fails.length); }
  await evalJson(page.send, `document.querySelector('.lesson h2').scrollIntoView({block:'start'})`);
  const bake = await shot(page.send, 'lesson-bake.png', true);
  await page.send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html#stock' });
  await waitText(page.send, 'この中身で献立を相談');
  await evalJson(page.send, `localStorage.setItem('okaimono_pending','[]');localStorage.setItem('okaimono_secret', JSON.stringify({url:'https://example.com/hook',key:'x',header:'X-App-Pass'})); frMenu();`);
  const form = await evalJson(page.send, `(()=>{const e=document.getElementById('c_q');return !!(e&&e.value.includes('品番は不明')&&e.value.includes('期限が近い')&&e.value.includes('書かないでください'))})()`);
  if (!form) throw new Error('献立相談の文面に器具条件が無い');
  await evalJson(page.send, `document.getElementById('c_q').scrollIntoView({block:'start'}); [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='送る').click()`);
  await sleep(300);
  const confirmOk = await evalJson(page.send, `(()=>{const e=document.getElementById('c_qe');return !!(e&&e.value.includes('品番は不明')&&e.value.includes('グリルパン')&&document.body.innerText.includes('送信データに添えます')&&document.body.innerText.includes('品番は不明'))})()`);
  if (!confirmOk) throw new Error('確認画面に器具条件が無い');
  await shot(page.send, 'menu-confirm.png', true);
  page.close();
  console.log('OK steps=' + logic.steps.join(' / '));
  console.log('shots ' + shotDir);
  console.log('bake ' + bake);
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
  http.kill('SIGKILL');
}
