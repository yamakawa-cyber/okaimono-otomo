// 共有オリジンでは合言葉が読め、別ポート（別オリジン）では読めないことを隔離プロファイルで見る。
// 秘密の値は結果に出さない。
import { spawn } from 'node:child_process';
const root = new URL('..', import.meta.url).pathname;
const ports = [8781, 8782];
const dbg = 9341;
const servers = ports.map(p => spawn('python3', ['-m', 'http.server', String(p), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' }));
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${dbg}`, `--user-data-dir=/tmp/chrome-origin-${Date.now()}`,
  'about:blank'
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
    setTimeout(() => { if (wait.has(id)) { wait.delete(id); rej(new Error('timeout ' + method)); } }, 20000);
  });
}
async function tab(url) {
  const t = await (await fetch(`http://127.0.0.1:${dbg}/json/new?` + encodeURIComponent(url), { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = rpc(ws);
  await send('Page.enable'); await send('Runtime.enable');
  for (let i = 0; i < 40; i++) {
    const ev = await send('Runtime.evaluate', { expression: 'typeof isSharedHost==="function" && document.readyState', returnByValue: true });
    if (ev.result && ev.result.result && ev.result.result.value === 'complete') break;
    await sleep(200);
  }
  await sleep(400);
  return { send, close: () => ws.close() };
}
async function ev(send, expression) {
  const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (!out.result || out.result.exceptionDetails) throw new Error(JSON.stringify(out.result && out.result.exceptionDetails || out).slice(0, 800));
  return out.result.result.value;
}
const MARK = 'origin-test-sentinel';
try {
  await ready();
  const a = await tab(`http://127.0.0.1:${ports[0]}/index.html#settings`);
  const hosts = await ev(a.send, `JSON.stringify({
    gio: isSharedHost('yamakawa-cyber.github.io'),
    gio2: isSharedHost('github.io'),
    pages: isSharedHost('okaimono-otomo.pages.dev'),
    workers: isSharedHost('app.example.workers.dev'),
    local: isSharedHost('127.0.0.1'),
    localHost: isSharedHost(location.hostname),
    emptyBad: dedicatedOrigin() === ''
  })`);
  await ev(a.send, `localStorage.setItem('okaimono_secret', JSON.stringify({url:'https://example.com/hook',key:${JSON.stringify(MARK)},header:'X-App-Pass'})); localStorage.setItem('lifehack_keep','stay'); localStorage.setItem('okaimono_v1', JSON.stringify({version:2,settings:{shopDays:[1,4],fridgeDay:0,perTrip:9000,monthly:100000,region:'mukonoso',aiRelay:''},list:[{name:'残す卵',done:false}],spend:[],fridge:[],menu:['','','','','','',''],prep:'',userStores:[]}));`);
  const same = await tab(`http://127.0.0.1:${ports[0]}/index.html#home`);
  const sameRead = await ev(same.send, `(() => { const s=localStorage.getItem('okaimono_secret')||''; return JSON.stringify({ readable: s.includes(${JSON.stringify(MARK)}), hasList: (localStorage.getItem('okaimono_v1')||'').includes('残す卵') }); })()`);
  const b = await tab(`http://127.0.0.1:${ports[1]}/index.html`);
  const other = await ev(b.send, `(() => { const own = localStorage.getItem('okaimono_secret'); return JSON.stringify({ otherOriginHasSecret: !!own, ownEmpty: own === null }); })()`);
  await sleep(500);
  const frame = await ev(b.send, `new Promise(res => { const f=document.createElement('iframe'); const done=v=>res(JSON.stringify(v)); f.addEventListener('load', () => { let threw=false; try { void f.contentWindow.localStorage; } catch (e) { threw=true; } if (threw) done({ crossOriginBlocked: true }); }); document.body.appendChild(f); f.src=${JSON.stringify('http://127.0.0.1:' + ports[0] + '/index.html')}; setTimeout(() => done({ crossOriginBlocked: false }), 4000); })`);
  const shared = await ev(a.send, `(() => {
    const fetches = [];
    const orig = window.fetch;
    window.fetch = (u, o) => { fetches.push(String(u)); return Promise.reject(new Error('blocked')); };
    window.alert = () => {};
    window.confirm = () => true;
    originHost = () => 'yamakawa-cyber.github.io';
    PUBLIC_ORIGIN = '';
    render();
    const banner = !!document.getElementById('migrate');
    const link0 = document.querySelector('#migrate a');
    setConsult('key', 'NEWKEY', null);
    const raw = localStorage.getItem('okaimono_secret') || '';
    const savedAfterBlock = raw.includes(${JSON.stringify(MARK)});
    const notReplaced = !raw.includes('NEWKEY');
    PUBLIC_ORIGIN = 'https://yamakawa-cyber.github.io/okaimono-otomo';
    const rejectShared = dedicatedOrigin() === '';
    PUBLIC_ORIGIN = 'javascript:alert(1)';
    const rejectJs = dedicatedOrigin() === '';
    PUBLIC_ORIGIN = 'https://user:pass@okaimono-otomo.pages.dev/path?x=1';
    const rejectUser = dedicatedOrigin() === '';
    PUBLIC_ORIGIN = 'https://okaimono-otomo.pages.dev';
    render();
    const link = document.querySelector('#migrate a');
    const href = link ? link.getAttribute('href') : '';
    CON.open = true; CON.q = '献立'; CON.type = 'menu'; CON.stage = 'confirm';
    sendConsult();
    const blocked = fetches.length === 0 && CON.status.includes('このアドレスからは送信しません');
    S.list = [{ name: '残す卵', done: false }];
    let blob = '';
    const old = URL.createObjectURL;
    URL.createObjectURL = function (x) { blob = x; return old.call(URL, x); };
    HTMLAnchorElement.prototype.click = function () {};
    backup();
    URL.createObjectURL = old;
    return blob.text().then(t => JSON.stringify({
      banner, noLinkBefore: !link0, rejectShared, rejectJs, rejectUser,
      hrefOk: href === 'https://okaimono-otomo.pages.dev', hrefHasQuery: href.includes('?') || href.includes(${JSON.stringify(MARK)}),
      keyStillThere: savedAfterBlock, notReplaced, blocked, backupHasSecret: t.includes(${JSON.stringify(MARK)}), backupHasEgg: t.includes('残す卵')
    }));
  })()`);
  await ev(a.send, `window.confirm=()=>true; wipeSecret();`);
  await sleep(200);
  const afterWipe = await ev(same.send, `(() => { location.reload(); return 'reload'; })()`).catch(() => 'nav');
  await sleep(800);
  const wiped = await ev(same.send, `JSON.stringify({ secretGone: localStorage.getItem('okaimono_secret')===null, eggKept: (localStorage.getItem('okaimono_v1')||'').includes('残す卵'), otherKept: localStorage.getItem('lifehack_keep')==='stay' })`);
  await ev(a.send, `window.confirm=()=>true; try{wipeOriginData()}catch(e){}`);
  await sleep(800);
  const wipedAll = await ev(a.send, `JSON.stringify({ secretGone: localStorage.getItem('okaimono_secret')===null, appGone: localStorage.getItem('okaimono_v1')===null, otherKept: localStorage.getItem('lifehack_keep')==='stay' })`).catch(async () => {
    const again = await tab(`http://127.0.0.1:${ports[0]}/index.html`);
    return ev(again.send, `JSON.stringify({ secretGone: localStorage.getItem('okaimono_secret')===null, appGone: localStorage.getItem('okaimono_v1')===null, otherKept: localStorage.getItem('lifehack_keep')==='stay' })`);
  });
  const out = { hosts: JSON.parse(hosts), sameRead: JSON.parse(sameRead), other: JSON.parse(other), frame: JSON.parse(frame), shared: JSON.parse(shared), afterWipe: afterWipe, wiped: JSON.parse(wiped), wipedAll: JSON.parse(wipedAll) };
  const ok = out.hosts.gio && out.hosts.gio2 && !out.hosts.pages && !out.hosts.workers && !out.hosts.local && !out.hosts.localHost && out.hosts.emptyBad
    && out.sameRead.readable && out.sameRead.hasList
    && out.other.otherOriginHasSecret === false && out.other.ownEmpty
    && out.frame.crossOriginBlocked
    && out.shared.banner && out.shared.noLinkBefore && out.shared.rejectShared && out.shared.rejectJs && out.shared.rejectUser
    && out.shared.hrefOk && !out.shared.hrefHasQuery && out.shared.keyStillThere && out.shared.notReplaced && out.shared.blocked
    && out.shared.backupHasSecret === false && out.shared.backupHasEgg
    && out.wiped.secretGone && out.wiped.eggKept && out.wiped.otherKept
    && out.wipedAll.secretGone && out.wipedAll.appGone && out.wipedAll.otherKept;
  console.log(JSON.stringify(out, null, 2));
  if (!ok) process.exitCode = 2;
  else console.log('ORIGIN_OK');
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
  servers.forEach(s => s.kill('SIGKILL'));
}
