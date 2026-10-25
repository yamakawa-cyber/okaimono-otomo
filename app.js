'use strict';
const WD=['日','月','火','水','木','金','土'];
const DATA_VERSION=2;
const IS_DEMO=new URLSearchParams(location.search).has('demo');
const K=IS_DEMO?'okaimono_demo':'okaimono_v1'; // 見本は別キー（本データに保存しない）
const CATS=[['食材・米',62000],['おやつ・飲み物',7000],['惣菜',3000],['日用品',13000],['子ども',5000],['予備',10000]];
const OFTEN0=['玉子','牛乳','食パン','豆腐','納豆','玉ねぎ','にんじん','鶏むね肉','米','トイレットペーパー'];const OFTD=()=>OFTEN0.map(n=>({name:n,cat:n==='トイレットペーパー'?'日用品':'食材・米'}));const oft=()=>isArr(S.often)?S.often:OFTD();let OE=false;const mapU=(n,o)=>{const x=o||stores().find(z=>z.name===n)||{};const a=x.address||x.city||'';return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(n+(a&&!/不明/.test(a)?' '+a:''))};const mapA=(n,o)=>`<a class="maplink" href="${esc(mapU(n,o))}" target="_blank" rel="noopener"><b>📍${esc(n)}</b></a>`;
const def={version:DATA_VERSION,settings:{shopDays:[1,4],fridgeDay:0,perTrip:9000,monthly:100000,region:'mukonoso',aiRelay:''},list:[],spend:[],fridge:[],menu:['','','','','','',''],prep:'',userStores:[]};
// ---- 検証 ----
const isStr=v=>typeof v==='string',isArr=Array.isArray,isObj=v=>v&&typeof v==='object'&&!isArr(v);
const isDate=v=>{if(!isStr(v)||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d};
const safeUrl=u=>{try{const x=new URL(String(u));return (x.protocol==='https:'||x.protocol==='http:')?x.href:''}catch(e){return ''}};
function cleanSettings(s){const d=structuredClone(def.settings);if(!isObj(s))return d;
 if(isArr(s.shopDays)&&s.shopDays.length>=1&&s.shopDays.every(x=>Number.isInteger(x)&&x>=0&&x<=6))d.shopDays=[...new Set(s.shopDays)].sort();
 if(Number.isInteger(s.fridgeDay)&&s.fridgeDay>=0&&s.fridgeDay<=6)d.fridgeDay=s.fridgeDay;
 if(Number.isFinite(s.perTrip)&&s.perTrip>0)d.perTrip=s.perTrip;if(Number.isFinite(s.monthly)&&s.monthly>0)d.monthly=s.monthly;
 if(isStr(s.region)&&(!BASE.regions.length||BASE.regions.some(r=>r.id===s.region)))d.region=s.region;if(isStr(s.aiRelay))d.aiRelay=safeUrl(s.aiRelay)?s.aiRelay:'';return d}
// 形が違えば例外。正しければ、初期値とマージしたデータを返す（失敗時は呼び出し側が元データを保持）
const MAXS=2000,MAXN=10000000,MAXITEMS=5000;
const okS=(v,n=MAXS)=>v===undefined||(isStr(v)&&v.length<=n);
const okAmt=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=MAXN;
const okAmt1=v=>okAmt(v)&&v>=1;const okB=v=>v===undefined||typeof v==='boolean';const TYPES=['super','big','daily','car'];
function dedupe(a,pfx){const seen=new Set();a.forEach(x=>{if(!x.id||seen.has(x.id))x.id=pfx+uid();seen.add(x.id)})}
const okWd=x=>Number.isInteger(x)&&x>=0&&x<=6;
function validate(data){if(!isObj(data))throw new Error('データの形が違います');
 const out=structuredClone(def);const bad=k=>{throw new Error('「'+k+'」の形が違います')};
 for(const k of ['list','spend','fridge','userStores'])if(k in data){if(!isArr(data[k])||data[k].length>MAXITEMS)bad(k);out[k]=data[k]}
 out.list.forEach(i=>{if(!isObj(i)||!isStr(i.name)||!i.name||!okS(i.name,200)||!okS(i.store,200)||!okS(i.qty,50)||!okS(i.cat,50)||!okS(i.spendId,50)||(i.yen!==undefined&&!okAmt1(i.yen))||!okB(i.done)||!okB(i.cart)||(i.price!==undefined&&!okAmt1(i.price))||!okB(i.sample)||(i.trip!==undefined&&!okWd(i.trip))||(i.uses!==undefined&&!(isArr(i.uses)&&i.uses.length<=14&&i.uses.every(u=>isObj(u)&&okWd(u.d)&&okS(u.dish,100)))))bad('list')});
 out.spend.forEach(r=>{if(!isObj(r)||!isDate(r.date)||!okAmt1(r.amount)||!okS(r.store,200)||!okS(r.cat,50)||!okS(r.memo,500)||!okS(r.id,100)||!okS(r.rc,300))bad('spend');if(!r.id)r.id=uid()});
 out.fridge.forEach(f=>{if(!isObj(f)||!isStr(f.name)||!okB(f.sample)||!okS(f.name,200)||!okS(f.id,100)||(f.until!==undefined&&f.until!==''&&!isDate(f.until))||(f.zone!==undefined&&!['冷蔵室','チルド','ドアポケット','野菜室','冷凍室'].includes(f.zone))||!okS(f.amt,50)||!okS(f.note,100))bad('fridge');if(!f.id)f.id=uid()});
 out.userStores.forEach(s=>{if(!isObj(s)||!isStr(s.name)||!okS(s.name,200)||!isStr(s.id)||!okS(s.id,100)||!okB(s.user)||(s.type!==undefined&&!TYPES.includes(s.type)))bad('userStores');
  for(const k of ['dist','hours','note','kind','address','closed','flyer','type','region'])if(!okS(s[k],500))bad('userStores');
  if(s.region!==undefined&&BASE.regions.length&&!BASE.regions.some(r=>r.id===s.region))bad('userStores');
  if(s.sales!==undefined&&(!isArr(s.sales)||!s.sales.every(x=>isObj(x)&&isStr(x.text)&&x.text.length>0&&x.text.length<=200&&(x.wd!==undefined||x.md!==undefined)&&(x.wd===undefined||okWd(x.wd))&&(x.md===undefined||(isArr(x.md)&&x.md.every(n=>Number.isInteger(n)&&n>=1&&n<=31))))))bad('userStores');
  if(s.links!==undefined&&(!isArr(s.links)||!s.links.every(l=>isObj(l)&&okS(l.t,200)&&okS(l.u,2000))))bad('userStores');
  s.links=(s.links||[]).filter(l=>safeUrl(l.u));s.sales=s.sales||[]});
 dedupe(out.spend,'s');dedupe(out.fridge,'f');dedupe(out.userStores,'u');
 if('menu' in data){if(isArr(data.menu)&&data.menu.length===7&&data.menu.every(x=>isStr(x)&&x.length<=500))out.menu=data.menu;else if(okS(data.menu,5000))out.menu=data.menu;else bad('menu')}
 if('prep' in data){if(!okS(data.prep,5000))bad('prep');out.prep=data.prep}
 if('settings' in data){const st=data.settings;if(!isObj(st))bad('settings');
  if('shopDays' in st&&!(isArr(st.shopDays)&&st.shopDays.length>=1&&st.shopDays.every(okWd)))bad('settings（買い物の曜日）');
  if('region' in st&&!(isStr(st.region)&&(!BASE.regions.length||BASE.regions.some(r=>r.id===st.region))))bad('settings（地域）');
  for(const k of ['perTrip','monthly'])if(k in st&&!(okAmt(st[k])&&st[k]>0))bad('settings（予算）');
  if('aiRelay' in st&&!okS(st.aiRelay,500))bad('settings（AI）')}
 out.settings=cleanSettings(data.settings);
 for(const k of Object.keys(data)){if(k==='lastBackup'&&isDate(data[k]))out[k]=data[k];if(k==='often'&&isArr(data[k]))out[k]=data[k].filter(o=>isObj(o)&&okS(o.name,100)&&o.name&&okS(o.cat,50)&&okS(o.qty,50)&&(o.price===undefined||okAmt1(o.price))).slice(0,60).map(o=>{const x={name:o.name};if(o.cat)x.cat=o.cat;if(o.qty)x.qty=o.qty;if(o.price)x.price=o.price;return x});if(k==='sampleKeys'&&isArr(data[k]))out[k]=data[k].filter(isStr).slice(0,50)}
 out.version=DATA_VERSION;return out}
let BASE={regions:[],stores:[]};let S=load();
function load(){try{const t=localStorage.getItem(K);return t?validate(JSON.parse(t)):structuredClone(def)}catch(e){console.log('load: 初期値で開始',e.message);return structuredClone(def)}}
function save(){localStorage.setItem(K,JSON.stringify(S))}
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
const today=()=>{const p=new URLSearchParams(location.search).get('today');return p&&isDate(p)?new Date(p+'T12:00'):new Date()};
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const md=v=>{if(!isDate(v))return '';const d=new Date(v+'T12:00');return (d.getMonth()+1)+'/'+d.getDate()+'（'+WD[d.getDay()]+'）'};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const stores=()=>BASE.stores.concat(S.userStores.filter(isObj)).sort((a,b)=>(parseFloat(String(a.dist||'').replace(/[^\d.]/g,''))||99)-(parseFloat(String(b.dist||'').replace(/[^\d.]/g,''))||99));
const regStores=()=>stores().filter(s=>s.region===S.settings.region);
function salesOn(s,d){return (isArr(s.sales)?s.sales:[]).filter(x=>isObj(x)&&isStr(x.text)&&x.text&&(x.wd!==undefined&&x.wd===d.getDay())||(isArr(x.md)&&x.md.includes(d.getDate())))}
function saleText(s){return (isArr(s.sales)?s.sales:[]).filter(x=>isObj(x)&&isStr(x.text)&&x.text).map(x=>okWd(x.wd)?WD[x.wd]+'曜：'+x.text:isArr(x.md)?'毎月'+x.md.join('・')+'日：'+x.text:x.text)}
function weekStart(d){const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x)} // 月曜始まり
function spentBetween(a,b,f){return S.spend.filter(r=>r.date>=a&&r.date<=b&&(!f||f(r))).reduce((t,r)=>t+Number(r.amount||0),0)}
function bar(used,max){const r=max>0?used/max:0;return `<div class="bar"><div class="${r>1?'over':r>=0.8?'warn':''}" style="width:${Math.min(100,r*100)}%"></div></div>`}
// 買い物の回：買い物日ごとに、次の買い物日の前日までを1回分とする（[1,4]なら 月〜水／木〜日）
function trips(d){const days=(S.settings.shopDays.length?S.settings.shopDays:[1]).slice().sort((a,b)=>((a+6)%7)-((b+6)%7));const ws=new Date(weekStart(d)+'T12:00');
 return days.map((w,i)=>{const off=(w+6)%7,next=i+1<days.length?(days[i+1]+6)%7:7;return {wd:w,from:ymd(addDays(ws,off)),to:ymd(addDays(ws,next-1)),label:WD[w]+'曜分'}})}
function curTrip(d){const t=ymd(d),a=trips(d);return a.find(x=>t>=x.from&&t<=x.to)||a[a.length-1]}
function storeCard(s,d){const on=d?salesOn(s,d):[];
 return `<div class="card ${on.length?'sale':''}">${mapA(s.name,s)} <span class="muted">${esc(s.dist||'')}</span>
 ${s.kind?`<span class="tag">${esc(s.kind)}</span>`:''}${s.address?`<div class="muted">📍${esc(s.address)}</div>`:''}
 <div class="muted">営業：${esc(s.hours||'不明')}${s.closed?'／定休：'+esc(s.closed):''}${s.flyer?'／チラシ：'+esc(s.flyer):''}</div>
 ${s.note?`<div class="muted">${esc(s.note)}</div>`:''}
 ${saleText(s).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}
 <div>${links(s)}</div>
 ${s.user?`<button class="sub" data-act="delStore" data-id="${esc(s.id)}">このお店を消す</button>`:''}</div>`}
const links=s=>(isArr(s.links)?s.links:[]).filter(isObj).map(l=>({t:l.t,u:safeUrl(l.u)})).filter(l=>l.u).map(l=>`<a class="link" href="${esc(l.u)}" target="_blank" rel="noopener">🔗${esc(l.t)}</a>`).join('');
const catOpts=sel=>CATS.map(([c])=>`<option${c===sel?' selected':''}>${c}</option>`).join('');
const V={
home(){const d=today(),st=S.settings,mo=ymd(d).slice(0,7);
 const goes=new Set(S.list.filter(i=>!i.done).map(i=>i.store));const sale=regStores().filter(s=>salesOn(s,d).length).sort((a,b)=>goes.has(b.name)-goes.has(a.name));const isShop=st.shopDays.includes(d.getDay()),isFr=st.fridgeDay===d.getDay();
 const tr=trips(d),mUsed=spentBetween(mo+'-01',mo+'-31');
 return `<h2>${md(ymd(d))}</h2>
 <div class="card">${isShop?'🛒 きょうは買い物の日':'買い物の日：'+st.shopDays.map(x=>WD[x]).join('・')+'曜'}<br>${isFr?'<a class="link" href="#fridge">🧊 きょうは冷蔵庫点検と献立の日 → 点検する</a>':'冷蔵庫点検：'+WD[st.fridgeDay]+'曜'}</div>
 <div class="card">${tr.map(t=>{const u=spentBetween(t.from,t.to);return `${t.label}（${md(t.from)}〜${md(t.to)}） ${yen(u)} / ${yen(st.perTrip)}${bar(u,st.perTrip)}<div class="muted">残り ${yen(st.perTrip-u)}</div>`}).join('')}
 今月 ${yen(mUsed)} / ${yen(st.monthly)}${bar(mUsed,st.monthly)}</div>
 <h2>きょう特売のお店（${esc(regName())}）</h2>${sale.length?sale.map(s=>`<div class="card sale">${mapA(s.name,s)}${goes.has(s.name)?' <span class="tag">🛒きょう行く</span>':''}<br>${salesOn(s,d).map(x=>`<span class="tag">${esc(x.text)}</span>`).join('')}<div>${links(s)}</div></div>`).join(''):'<div class="card muted">きょう決まった特売日のお店はありません（特売日が未確認のお店もあります）</div>'}
 <h2>買い物リスト</h2><div class="card">${S.list.filter(i=>!i.done).length} 品が未購入 <a class="link" href="#list">ひらく</a></div>`},
stores(){const d=today();const grp=(t,l)=>{const a=regStores().filter(s=>(s.type||'super')===t);return a.length?`<h2>${l}</h2>`+a.map(s=>storeCard(s,d)).join(''):''};
 return regionSeg()+`<p class="muted">${regStores().length}店。${esc(BASE.source||'')} チラシの中身は取り込まず、公式ページ・チラシサイトへのリンクだけ載せています。</p>`
 +grp('super','スーパー')+grp('big','大型店（総合スーパー）')+grp('daily','ドラッグストア・100均・ホームセンター')+grp('car','車圏')+(()=>{const a=regStores().filter(s=>!TYPES.includes(s.type||'super'));return a.length?'<h2>そのほか</h2>'+a.map(s=>storeCard(s,d)).join(''):''})()+(regStores().length?'':'<div class="card muted">この地域のお店はまだありません。下から追加してください。</div>')
 +`<h2>お店を追加（${esc(regName())}）</h2><div class="card"><input id="ns_name" placeholder="店名" style="width:100%"><div class="row"><input id="ns_hours" placeholder="営業時間"><select id="ns_type"><option value="super">スーパー</option><option value="daily">日用品</option><option value="car">車圏</option></select></div>
 <div class="row"><select id="ns_wd"><option value="">特売の曜日なし</option>${WD.map((w,i)=>`<option value="${i}">${w}曜</option>`).join('')}</select><input id="ns_sale" placeholder="特売の内容（例：玉子）"></div>
 <input id="ns_url" placeholder="公式ページやチラシのURL（https://…）" style="width:100%"><div class="row"><button onclick="addStore()">追加</button></div></div>`},
list(){const d=today(),tr=trips(d),cur=curTrip(d);const opts=regStores().map(s=>`<option>${esc(s.name)}</option>`).join('');
 const tOf=i=>tr.some(t=>t.wd===i.trip)?i.trip:cur.wd;
 const seg=`<div class="seg lv"><button class="${lvNow()==='day'?'on':''}" onclick="LV='day';render()">🍽 曜日ごと</button><button class="${lvNow()!=='day'?'on':''}" onclick="LV='trip';render()">🛒 まとめて買う</button></div>`;
 const form=`<div class="card"><div class="row"><input id="li_name" placeholder="品名（例：玉子）"><input id="li_qty" placeholder="数量" style="flex:0 0 80px"></div>
 <div class="row"><select id="li_store"><option value="">お店</option>${opts}</select><select id="li_trip">${tr.map(t=>`<option value="${t.wd}"${t.wd===cur.wd?' selected':''}>${t.label}</option>`).join('')}</select></div>
 <div class="row"><button onclick="addItem()">リストに追加</button></div>
 <div class="often">よく買う品：${oft().map((o,k)=>`<button class="chip" data-act="often" data-id="${k}">＋${esc(o.name)}</button>`).join('')}<button class="chip oedit" onclick="OE=!OE;render()">${OE?'✔ 編集おわり':'✏️ 編集'}</button></div>${typeof netBtn==='function'?`<div class="often">🔎 ネットで探す：${oft().map(o=>`<button class="chip" data-ns="${esc(o.name)}">${esc(o.name)}</button>`).join('')}</div>${NS&&NSF&&oft().some(o=>o.name===NS)?netMenu(NS,''):''}`:''}${OE?oftEditor():''}</div>`;
 const nc=S.list.filter(i=>i.cart&&!i.done).length;const cb=nc?`<div class="cartbar"><span>🛒 カゴの中 ${nc}品</span><button onclick="cartToBought()">カゴの中を「買った」にする</button></div>`:'';const clr=S.list.some(i=>i.done)?`<div class="row"><button class="sub" onclick="clearChecked()">✔ チェック済みをまとめて消す</button></div>`:'';if(lvNow()==='day')return seg+cb+clr+dayView()+form;
 const block=t=>{const g={};S.list.forEach((i,n)=>{if(tOf(i)!==t.wd)return;const k=i.store||'お店未定';const m=(g[k]=g[k]||{});const nk=baseName(i.name);(m[nk]=m[nk]||[]).push([i,n])});const keys=Object.keys(g);
  return `<h2>🗓 ${t.label}（${md(t.from)}の買い物）${t.wd===cur.wd?' <span class="tag">いまの回</span>':''}</h2>`+(keys.length?keys.map(st=>`<h3>🏪 ${st==='お店未定'?esc(st):mapA(st)}</h3><ul class="chk card">${Object.values(g[st]).map(rows=>{const ns=rows.map(r=>r[1]),i=rows[0][0],n=ns[0],done=rows.every(r=>r[0].done);
   const qty=rows.map(r=>r[0].qty||qtyOf(r[0].name)).filter(Boolean),nm=rows.length>1?baseName(i.name):i.name;
   const uses=[];rows.forEach(r=>(r[0].uses||[]).forEach(u=>{if(!uses.some(x=>x.d===u.d&&x.dish===u.dish))uses.push(u)}));
   const inc=!done&&rows.every(r=>r[0].cart);return `<li class="${done?'done':inc?'incart':''}" data-del="${ns}">${done?'':cartBtn(ns,inc)}<label class="lrow"><input type="checkbox" ${done?'checked':''} data-tm="${ns}"><span style="flex:1">${esc(nm)}${qty.length?` <span class="muted">${esc(qty.join('＋'))}</span>`:''}${rows.length>1?` <span class="tag">${rows.length}件まとめ</span>`:''}${i.yen?` <span class="muted">${yen(i.yen)}・${esc(i.cat||'')}</span>`:''}</span></label>${done?'':`<input type="number" inputmode="numeric" id="yen${n}" placeholder="金額" style="width:80px"${i.price?` value="${i.price}"`:''}><select id="cat${n}" style="width:96px">${catOpts(i.cat||'食材・米')}</select>`}${done?'':netBtn(nm)}<button class="sub" data-act="del" data-id="${ns}" aria-label="消す">✕</button>${!done&&!NSF&&NS===baseName(nm)?netMenu(nm,qty.join('＋')):''}${uses.length?`<div class="badges">${uses.sort((a,b)=>(a.d+6)%7-(b.d+6)%7).map(u=>`<button class="badge" data-act="jump" data-id="${u.d}">${WD[u.d]}${u.dish?'・'+esc(u.dish.slice(0,12)):''}</button>`).join('')}</div>`:''}</li>`}).join('')}</ul>`).join(''):'<div class="card muted empty"><img src="img/chibi_sleep.webp" alt="" width="120">まだありません</div>')};
 return seg+cb+form+`
 ${tr.map(block).join('')}
 <p class="muted">チェックするときに金額と費目を入れると、家計に「日付・店・費目・金額・メモ（品名）」で記録されます。✕で品物を消しても、家計の記録は残ります（家計タブで消せます）。</p>
 <div class="row"><button class="sub" onclick="clearChecked()">✔ チェック済みをまとめて消す</button></div>`},
money(){let fix=false;S.spend.forEach(r=>{if(isObj(r)&&!r.id){r.id=uid();fix=true}});if(fix)save();const d=today(),st=S.settings,c=curTrip(d),mo=ymd(d).slice(0,7);const tUsed=spentBetween(c.from,c.to);
 return `<div class="card">${c.label}（${md(c.from)}〜${md(c.to)}） ${yen(tUsed)} / ${yen(st.perTrip)}${bar(tUsed,st.perTrip)}<div class="muted">1回の目安 ${yen(st.perTrip)}、残り ${yen(st.perTrip-tUsed)}</div></div>
 <div class="card"><b>今月の費目別</b>${CATS.map(([k,b])=>{const u=spentBetween(mo+'-01',mo+'-31',r=>r.cat===k);return `<div class="crow"><span>${k}</span><span>${yen(u)} / ${yen(b)}</span></div>${bar(u,b)}`}).join('')}
 ${(()=>{const o=spentBetween(mo+'-01',mo+'-31',r=>!CATS.some(([k])=>k===r.cat));return o?`<div class="crow muted"><span>そのほかの費目</span><span>${yen(o)}</span></div>`:''})()}</div>
 <div class="card"><div class="row"><input id="sp_date" type="date" lang="ja" value="${ymd(d)}"><select id="sp_store"><option value="">店</option>${stores().map(s=>`<option>${esc(s.name)}</option>`).join('')}</select></div>
 <div class="row"><select id="sp_cat">${catOpts()}</select><input id="sp_amt" type="number" inputmode="numeric" placeholder="金額（円）"></div>
 <input id="sp_memo" placeholder="メモ" style="width:100%"><div class="row"><button onclick="addSpend()">記録する</button><button class="sub" onclick="csv()">CSVで書き出す</button></div></div>
 ${S.spend.slice().reverse().map(r=>`<div class="card scard"><div style="flex:1"><div class="muted">${md(r.date)}</div><b>${esc(r.store||'店なし')}</b><div><span class="tag">${esc(r.cat)}</span> <span class="muted">${esc(r.memo)}</span></div></div><div class="amt">${yen(r.amount)}</div><button class="sub" data-act="delSpend" data-id="${esc(r.id)}">✕</button></div>`).join('')||'<div class="card muted">まだ記録がありません</div>'}`},
fridge(){return `${frView()}
 <h2>今週の献立</h2><div class="card">${[1,2,3,4,5,6,0].map(w=>`<div class="row mrow"><b style="flex:0 0 2em">${WD[w]}</b><input value="${esc(menuArr()[w])}" placeholder="${WD[w]}曜の献立" oninput="setMenu(${w},this.value)" onchange="render()"></div>${dishChips(w)}`).join('')}</div>
 <h2>作り置き</h2><textarea id="prep" rows="5" style="width:100%" placeholder="作るもの・いつ作るか・食べきる目安" oninput="S.prep=this.value;save()">${esc(S.prep)}</textarea>`},
settings(){const st=S.settings;return `${IS_DEMO?'<div class="card sample">🧪 見本データで表示中です（本データには保存されません）</div>':''}<h2>地域</h2>${regionSeg()}
 <h2>買い物の曜日（週2回が目安）</h2><div class="seg">${WD.map((w,i)=>`<button class="${st.shopDays.includes(i)?'on':''}" onclick="togDay(${i})">${w}</button>`).join('')}</div>
 <h2>冷蔵庫点検の曜日</h2><div class="seg">${WD.map((w,i)=>`<button class="${st.fridgeDay===i?'on':''}" onclick="S.settings.fridgeDay=${i};save();render()">${w}</button>`).join('')}</div>
 <h2>予算</h2><div class="card">1回の買い物 <input type="number" value="${st.perTrip}" onchange="S.settings.perTrip=+this.value||9000;save()"> 円<br>月の予算 <input type="number" value="${st.monthly}" onchange="S.settings.monthly=+this.value||100000;save()"> 円
 <div class="muted">費目別の月予算：${CATS.map(([k,b])=>k+' '+yen(b)).join('、')}</div></div>
 <h2>AI</h2><div class="card">（旧方式）AI中継サーバーのURL（ふだんは空のままでOK。相談は下の「アキラちゃんに相談」を使います）<input id="relay" placeholder="https://…workers.dev" value="${esc(st.aiRelay||'')}" style="width:100%" onchange="setRelay(this.value)">
 <div class="muted">APIキーはアプリに入れません。キーは中継サーバーだけが持ちます。</div>
 <div class="row"><button class="sub" onclick="aiExport()">AIに頼む用に書き出す</button><label class="btnlike">AIの答えを読み込む<input type="file" accept=".json" hidden onchange="aiImport(event)"></label></div></div>
 <h2>バックアップ</h2><div class="card">${bkDue()?'<div class="tip">⚠️ 最後のバックアップから1週間たちました。書き出しておきましょう。</div>':''}<div class="muted">最後のバックアップ：${S.lastBackup?md(S.lastBackup):'まだ'}</div>
 <div class="row"><button onclick="backup()">全部を書き出す</button><label class="btnlike">読み込んで戻す<input type="file" accept=".json" hidden onchange="restore(event)"></label></div>
 <div class="muted">お店（追加した店）・買い物リスト・冷蔵庫・献立・家計・設定に加えて、献立とレシピのつながり（リンク）とAIの答えの保管庫もまとめて1つのファイルにします。</div></div>
 <h2>見本データ</h2><div class="card"><button class="sub" onclick="clearSamples()">見本（サンプル）のデータをまとめて消す</button></div>
 <p class="muted">データはこのスマホの中だけに保存されます。機種変更の前に書き出してください。</p>`}
};
function regName(){return (BASE.regions.find(r=>r.id===S.settings.region)||{}).name||''}
function regionSeg(){return `<div class="seg wrap">${BASE.regions.map(r=>`<button class="${r.id===S.settings.region?'on':''}" data-act="region" data-id="${esc(r.id)}">${esc(r.name)}</button>`).join('')}</div>`}
const val=id=>{const e=document.getElementById(id);return e?e.value.trim():''};const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function setRelay(v){v=v.trim();if(v&&!safeUrl(v))return alert('URLは http:// か https:// で始めてください');S.settings.aiRelay=v;save()}
function addStore(){const n=val('ns_name');if(!n)return alert('店名を入れてください');const wd=val('ns_wd'),sl=val('ns_sale'),u=val('ns_url');
 if(u&&!safeUrl(u))return alert('URLは http:// か https:// で始めてください');
 S.userStores.push({id:'u'+uid(),user:true,region:S.settings.region,type:val('ns_type'),name:n,hours:val('ns_hours')||'未確認',sales:wd!==''?[{wd:+wd,text:sl||'特売'}]:[],links:u?[{t:'公式・チラシ',u:safeUrl(u)}]:[]});save();render()}
function addItem(name){const n=name||val('li_name');if(!n)return;const t=val('li_trip');S.list.push({name:n,qty:name?'':val('li_qty'),store:val('li_store'),trip:t!==''?+t:curTrip(today()).wd,done:false});save();render()}
function tog(n){const i=S.list[n];if(!i)return;i.done=!i.done;delete i.cart;if(i.done){const a=+val('yen'+n);if(okAmt(a)&&a>0){i.yen=a;i.cat=val('cat'+n)||'食材・米';i.spendId=uid();S.spend.push({id:i.spendId,date:ymd(today()),store:i.store,cat:i.cat,amount:a,memo:i.name})}}
 else if(i.spendId){S.spend=S.spend.filter(r=>r.id!==i.spendId);delete i.spendId;delete i.yen;delete i.cat}save();render()}
let LV=null;const lvNow=()=>LV||(S.list.some(i=>i.uses&&i.uses.length)?'day':'trip');
const baseName=n=>String(n).replace(/[\s　]+[0-9０-９０-９\/½¼].*$/,'').replace(/[\s　]+(少々|適量|1袋|1箱|1本|1個|1房|1丁|1束)$/,'').trim()||String(n);
const qtyOf=n=>{const m=String(n).match(/[\s　]+([0-9０-９].*)$/);return m?m[1]:''};
function togMany(ns,root){const its=ns.map(n=>S.list[n]).filter(Boolean);if(!its.length)return;const nd=!its.every(i=>i.done);
 if(nd){let a=NaN,c='';const ai=root&&root.querySelector('input[type=number]'),cs=root&&root.querySelector('select');if(ai){a=+ai.value;c=cs?cs.value:''}else for(const n of ns){const v=+val('yen'+n);if(okAmt(v)&&v>0){a=v;c=val('cat'+n);break}}
  its.forEach(i=>{i.done=true;delete i.cart});const f=its[0];if(!its.some(i=>i.spendId)&&okAmt(a)&&a>0){f.yen=a;f.cat=c||'食材・米';f.spendId=uid();S.spend.push({id:f.spendId,date:ymd(today()),store:f.store||'',cat:f.cat,amount:a,memo:its.length>1?baseName(f.name):f.name})}}
 else its.forEach(i=>{i.done=false;if(i.spendId){const sid=i.spendId;S.spend=S.spend.filter(r=>r.id!==sid);delete i.spendId;delete i.yen;delete i.cat}});
 const y=scrollY;save();render();scrollTo(0,y)}
const cartBtn=(ns,on)=>`<button class="cartb${on?' on':''}" data-cart="${ns}" aria-pressed="${on?'true':'false'}" aria-label="カゴに入れた">${on?'✅ カゴ':'🛒 カゴ'}</button>`;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button[data-cart]');if(!b)return;e.preventDefault();const its=b.dataset.cart.split(',').map(Number).filter(Number.isInteger).map(n=>S.list[n]).filter(Boolean);if(!its.length)return;const n0=+b.dataset.cart.split(',')[0],ya=+val('yen'+n0);if(document.getElementById('yen'+n0)){if(okAmt(ya)&&ya>0){its[0].price=ya;its[0].cat=val('cat'+n0)||its[0].cat||'食材・米'}else if(val('yen'+n0)==='')delete its[0].price}const on=!its.every(i=>i.cart);its.forEach(i=>{if(on)i.cart=true;else delete i.cart});const y=scrollY;save();render();scrollTo(0,y)});
function oftEditor(){const L=oft();return `<div class="oftbox"><b>よく買う品の編集</b><div class="muted">変えたらそのまま保存されます。↑↓で並べかえ。</div>${L.map((o,k)=>`<div class="oftrow" data-ok="${k}"><input data-of="name" value="${esc(o.name)}" placeholder="品名" aria-label="品名"><input data-of="qty" value="${esc(o.qty||'')}" placeholder="いつもの量" aria-label="いつもの量"><select data-of="cat" aria-label="費目">${catOpts(o.cat||'食材・米')}</select><input data-of="price" type="number" inputmode="numeric" value="${o.price||''}" placeholder="いつもの値段" aria-label="いつもの値段"><div class="oftbtn"><button class="sub" onclick="oftMove(${k},-1)" ${k?'':'disabled'} aria-label="上へ">↑</button><button class="sub" onclick="oftMove(${k},1)" ${k<L.length-1?'':'disabled'} aria-label="下へ">↓</button><button class="sub" onclick="oftDel(${k})" aria-label="消す">✕</button></div></div>`).join('')}
<div class="oftrow"><input id="of_name" placeholder="新しい品名"><input id="of_qty" placeholder="いつもの量"><select id="of_cat">${catOpts('食材・米')}</select><input id="of_price" type="number" inputmode="numeric" placeholder="いつもの値段"><div class="oftbtn"><button onclick="oftAdd()">＋ 追加</button></div></div>
<div class="row"><button class="sub" onclick="oftReset()">はじめの品ぞろえに戻す</button></div></div>`}
function oftSet(L){S.often=L;save();const y=scrollY;render();scrollTo(0,y)}
function oftAdd(){const n=val('of_name').trim().slice(0,100);if(!n)return toast('品名を入れてね');const o={name:n,cat:val('of_cat')||'食材・米'};const q=val('of_qty').trim().slice(0,50);if(q)o.qty=q;const p=+val('of_price');if(okAmt(p)&&p>0)o.price=p;oftSet(oft().concat([o]))}
function oftMove(k,d){const L=oft().slice();const j=k+d;if(j<0||j>=L.length)return;[L[k],L[j]]=[L[j],L[k]];oftSet(L)}
function oftDel(k){const L=oft().slice();const [g]=L.splice(k,1);if(!g)return;oftSet(L);undoToast(`「${g.name.slice(0,14)}」を消しました`,()=>{const M=oft().slice();M.splice(Math.min(k,M.length),0,g);oftSet(M)})}
function oftReset(){const prev=oft().slice();delete S.often;save();const y=scrollY;render();scrollTo(0,y);undo1('はじめの品ぞろえに戻しました',()=>oftSet(prev))}
document.addEventListener('change',e=>{const f=e.target.dataset&&e.target.dataset.of;if(!f)return;const row=e.target.closest('[data-ok]');if(!row)return;const k=+row.dataset.ok;const L=oft().map(o=>Object.assign({},o));const o=L[k];if(!o)return;let v=e.target.value;
 if(f==='name'){v=v.trim().slice(0,100);if(!v){toast('品名は空にできません');return render()}o.name=v}else if(f==='price'){const p=+v;if(okAmt(p)&&p>0)o.price=p;else delete o.price}else{v=v.trim().slice(0,50);if(v)o[f]=v;else delete o[f]}S.often=L;save()});
function cartToBought(){const its=S.list.filter(i=>i.cart&&!i.done);if(!its.length)return;
 its.forEach((i,k)=>{const n=S.list.indexOf(i),v=+val('yen'+n);if(document.getElementById('yen'+n)&&okAmt(v)&&v>0){i.price=v;i.cat=val('cat'+n)||i.cat}});
 const rec=[];its.forEach(i=>{i.done=true;delete i.cart;if(!i.spendId&&okAmt(+i.price)&&+i.price>0){i.yen=+i.price;i.cat=i.cat||'食材・米';i.spendId=uid();S.spend.push({id:i.spendId,date:ymd(today()),store:i.store||'',cat:i.cat,amount:i.yen,memo:i.name});rec.push(i)}});
 const y=scrollY;save();render();scrollTo(0,y);undo1(`カゴの中の${its.length}品を「買った」にしました`+(rec.length?`（家計に${rec.length}件記録）`:''),()=>{its.forEach(i=>{i.done=false;i.cart=true});rec.forEach(i=>{const sid=i.spendId;S.spend=S.spend.filter(r=>r.id!==sid);delete i.spendId;delete i.yen});save();render()},its.length)}
document.addEventListener('change',e=>{const c=e.target.closest&&e.target.closest('input[data-tm]');if(!c)return;togMany(c.dataset.tm.split(',').map(Number).filter(Number.isInteger),c.closest('li'))});
function delMany(ns){const gone=ns.map(k=>[k,S.list[k]]).filter(x=>x[1]);if(!gone.length)return;S.list=S.list.filter((_,k)=>!ns.includes(k));save();render();
 undoToast(`「${gone[0][1].name.slice(0,14)}」${gone.length>1?`ほか${gone.length-1}件`:''}を消しました`,()=>{gone.sort((a,b)=>a[0]-b[0]).forEach(([k,i])=>S.list.splice(Math.min(k,S.list.length),0,i));save();render()},gone.length)}
let UND={fns:[],n:0,el:null,h:0};function undo1(m,f,c){UND.fns=[];UND.n=0;undoToast(m,f,c)}
function undoToast(msg,fn,cnt){UND.fns.push(fn);UND.n+=cnt||1;let t=UND.el;if(!t||!t.isConnected){t=UND.el=document.createElement('div');t.id='undos';t.className='undo';t.setAttribute('role','status');t.innerHTML='<span></span><button>元に戻す</button>';document.body.appendChild(t);
  t.querySelector('button').onclick=()=>{const f=UND.fns.slice().reverse();UND.fns=[];UND.n=0;t.remove();clearTimeout(UND.h);f.forEach(x=>x())}}
 t.querySelector('span').textContent=UND.fns.length>1?`${UND.n}品を消しました`:msg;clearTimeout(UND.h);UND.h=setTimeout(()=>{UND.fns=[];UND.n=0;t.remove()},6000)}
function clearChecked(){const ns=S.list.map((i,k)=>i.done?k:-1).filter(k=>k>=0);if(!ns.length)return toast('チェック済みの品物はありません');delMany(ns)}
let SW=null;document.addEventListener('touchstart',e=>{const li=e.target.closest('li[data-del]');SW=li?{li,x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
document.addEventListener('touchmove',e=>{if(!SW)return;const dx=e.touches[0].clientX-SW.x,dy=e.touches[0].clientY-SW.y;if(Math.abs(dy)>Math.abs(dx)){SW.li.style.transform='';SW=null;return}if(dx<0)SW.li.style.transform=`translateX(${dx}px)`},{passive:true});
document.addEventListener('touchend',e=>{if(!SW)return;const li=SW.li,dx=e.changedTouches[0].clientX-SW.x;SW=null;li.style.transform='';if(dx<-90)delMany(li.dataset.del.split(',').map(Number))});
function jumpDay(d){LV='day';render();const e=document.getElementById('day'+d);if(e)e.scrollIntoView({block:'start'})}
function dishesOf(d){return String(menuArr()[d]||'').split(/[・、,]/).map(x=>x.trim()).filter(Boolean)}
const normDish=x=>String(x||'').normalize('NFKC').replace(/[（(\[【][^）)\]】]*[）)\]】]/g,'').replace(/[0-9０-９]+(人分|日分|個|枚|g|ml|本)/g,'').replace(/[\s　・、,。!！?？~〜]/g,'').replace(/作り置き|作りおき|つくりおき|多め|多めに|大盛り|簡単|かんたん|定番|お肉|肉|の|と|風/g,'');
const LK='okaimono_links';
function recipeList(){const out=[],seen=new Set();const walk=(o,eid,dep)=>{if(!o||typeof o!=='object'||dep>6)return;if(isArr(o)){o.forEach(x=>walk(x,eid,dep+1));return}
  if(isStr(o.name)&&isArr(o.steps)&&o.steps.length&&isArr(o.ingredients)){const k=eid+'|'+o.name;if(!seen.has(k)){seen.add(k);out.push({eid,rc:o})}}
  Object.values(o).forEach(v=>{if(v&&typeof v==='object')walk(v,eid,dep+1)})};
 let raw=[];try{raw=JSON.parse(localStorage.getItem(typeof HK!=='undefined'?HK:'okaimono_hist')||'[]')}catch(e){}if(!isArr(raw))raw=[];
 raw.forEach(e=>isObj(e)&&walk(e.item,String(e.id||''),0));if(typeof INBOX!=='undefined')INBOX.forEach(e=>walk(e.item,'inbox:'+e.key,0));return out}
const bigr=s=>{const a=new Set();for(let i=0;i<s.length-1;i++)a.add(s.slice(i,i+2));return a};
function matchScore(dish,name){const k=normDish(dish),n=normDish(name);if(!k||!n)return 0;if(k===n)return 3;if(k.includes(n)||n.includes(k))return 2;const A=bigr(k),B=bigr(n);if(!A.size||!B.size)return 0;let c=0;A.forEach(x=>B.has(x)&&c++);const j=c/Math.min(A.size,B.size);return j>=0.6?1+j/2:0}
function getLinks(){try{const o=JSON.parse(localStorage.getItem(LK)||'{}');return isObj(o)?o:{}}catch(e){return {}}}
function findRecipeObj(dish){if(!dish)return null;const all=recipeList();const L=getLinks();const nk=normDish(dish);
 if(L[nk]){const hit=all.find(r=>r.eid+'|'+r.rc.name===L[nk]);if(hit)return hit}
 let best=null,bs=0;all.forEach(r=>{const sc=matchScore(dish,r.rc.name);if(sc>bs){bs=sc;best=r}});return best}
function findRecipe(dish){const r=findRecipeObj(dish);return r?r.eid+'|'+r.rc.name:null}
function recipeById(id){return recipeList().find(r=>r.eid+'|'+r.rc.name===id)||null}
function linkMenu(){const L=getLinks();let ch=false;const all=recipeList();menuArr().forEach((m,d)=>dishesOf(d).forEach(x=>{const nk=normDish(x);if(!nk)return;const cur=L[nk]&&all.find(r=>r.eid+'|'+r.rc.name===L[nk]);if(cur)return;let best=null,bs=0;all.forEach(r=>{const sc=matchScore(x,r.rc.name);if(sc>bs){bs=sc;best=r}});if(best){L[nk]=best.eid+'|'+best.rc.name;ch=true}}));if(ch)try{localStorage.setItem(LK,JSON.stringify(L))}catch(e){}return ch}
let DO=null;
function dishChips(w){const ds=dishesOf(w);if(!ds.length)return '';return `<div class="dishes">${ds.map((x,j)=>{const k=w+'|'+j,op=DO===k;return `<button class="dish${op?' on':''}" aria-expanded="${op}" data-act="tdish" data-id="${esc(k)}">${findRecipe(x)?'🍳':'🍽'} ${esc(x)} ${op?'▲':'▼'}</button>`}).join('')}</div>${DO&&DO.split('|')[0]==w?dishPanel(w,ds[+DO.split('|')[1]]):''}`}
function togDish(k){const y=scrollY;DO=DO===k?null:k;if(DO)linkMenu();render();scrollTo(0,y)}
const ingName=x=>normDish(baseName(typeof x==='string'?x:(x&&x.name)||'')).replace(/チューブ$/,'');
function ingState(x){const n=ingName(x);const hit=S.list.filter(i=>{const m=normDish(baseName(i.name));return m&&(m===n||m.includes(n)||n.includes(m))});return hit.some(i=>i.done)?'bought':hit.length?'listed':''}
const PANTRY=/^(塩|こしょう|しょうゆ|醤油|みりん|酒|砂糖|酢|サラダ油|油|水|顆粒だし|だし|片栗粉|小麦粉|味噌|みそ|アルミホイル|ごま油|バター)/;
function dishPanel(w,dish){const f=findRecipeObj(dish);const id=f&&(f.eid+'|'+f.rc.name);const rc=f&&f.rc;
 if(rc){const ing=(rc.ingredients||[]);const miss=ing.filter(x=>!ingState(x)&&!PANTRY.test(ingName(x)));
  return `<div class="card dpanel"><b>🍳 ${esc(rc.name)}</b> <span class="muted">${esc(rc.serves||'')}・${esc(rc.time||'')}</span>
  <h3>材料</h3><ul class="ing">${ing.map(x=>{const st=ingState(x);const t=typeof x==='string'?x:(x.name||'')+(x.qty?' '+x.qty:'');return `<li><span>${esc(t)}</span>${st==='bought'?'<span class="tag ok">買った</span>':st==='listed'?'<span class="tag">リスト済み</span>':PANTRY.test(ingName(x))?'<span class="tag muted">家にある?</span>':''}</li>`}).join('')}</ul>
  <div class="row">${miss.length?`<button data-act="mtl" data-w="${w}" data-id="${esc(id)}">🛒 足りない材料をリストへ（${miss.length}）</button>`:'<span class="muted">材料はそろっています</span>'}</div>
  <h3>作り方</h3><ol class="steps">${(rc.steps||[]).map(st=>`<li>${esc(st.t||'')}${st.min?` <span class="muted">約${esc(st.min)}分</span>`:''}</li>`).join('')}</ol>
  <div class="row"><button data-act="dles" data-id="${esc(id)}">👩‍🍳 料理レッスンを始める</button></div></div>`}
 const buys=S.list.filter(i=>(i.uses||[]).some(u=>u.d===w&&(!u.dish||normDish(dish).includes(normDish(u.dish))||normDish(u.dish).includes(normDish(dish)))));
 return `<div class="card dpanel"><b>🍽 ${esc(dish)}</b><div class="muted">レシピはまだ保管庫にありません</div>${buys.length?`<h3>この料理で買うもの</h3><ul class="ing">${buys.map(i=>`<li><span>${esc(i.name)}</span>${i.done?'<span class="tag ok">買った</span>':'<span class="tag">リスト済み</span>'}</li>`).join('')}</ul>`:''}
 <div class="row"><button data-act="ask" data-w="${w}" data-id="${esc(dish)}">💬 アキラちゃんにレシピを聞く</button></div></div>`}
function missingToList(w,id){const f=recipeById(id);if(!f)return;const rc=f.rc;const miss=(rc.ingredients||[]).filter(x=>!ingState(x)&&!PANTRY.test(ingName(x)));
 const y=scrollY;const [n]=pushList(listItemsOf({items:miss}).map(i=>Object.assign(i,{uses:[{d:w,dish:rc.name.slice(0,100)}],trip:tripForDay(w)})));render();scrollTo(0,y);toast(`足りない材料を${n}品リストに入れました`)}
function dishLesson(id){const f=recipeById(id);if(!f)return;CON.open=false;AT.open=null;AT.lesson=Object.assign({},f.rc,{ingredients:(f.rc.ingredients||[]).map(x=>typeof x==='string'?x:[x&&x.name,x&&(x.qty||x.amount)].filter(Boolean).join(' ')),steps:(f.rc.steps||[]).map(x=>Object.assign({t:'',d:'',tip:''},x))});AT.step=-1;AT.checked={};if(typeof timerStop==='function')timerStop();if(typeof wakeOn==='function')wakeOn();location.hash='#ai';render();scrollTo(0,0)}
function askRecipe(w,dish){CON.open=true;CON.from=location.hash;CON.type='recipe';CON.stage='form';CON.q=`${WD[w]}曜の「${dish}」のレシピを教えて。材料（4人分・分量つき）と手順、料理レッスン用のステップでお願い。`;CON.status='';render();const c=document.querySelector('.consultbox,#c_q');if(c)c.scrollIntoView({block:'center'})}
function openRecipe(id){CON.open=false;DO=null;const f=recipeById(id);if(!f)return;const w=menuArr().findIndex((m,d)=>dishesOf(d).some(x=>findRecipe(x)===id));if(w>=0){const j=dishesOf(w).findIndex(x=>findRecipe(x)===id);DO=w+'|'+j;location.hash='#fridge';render();const el=document.querySelector('.dpanel');if(el)el.scrollIntoView({block:'start'});return}dishLesson(id)}
function dayView(){const order=[1,2,3,4,5,6,0];let h='';const used=new Set();
 order.forEach(d=>{const dishes=dishesOf(d);const its=[];S.list.forEach((i,n)=>{if((i.uses||[]).some(u=>u.d===d)){its.push([i,n]);used.add(n)}});if(!dishes.length&&!its.length)return;
  h+=`<div class="card" id="day${d}"><h2>${WD[d]}曜</h2><div class="dishes">${dishes.map(x=>{const id=findRecipe(x);return id?`<button class="dish" data-act="orec" data-id="${esc(id)}">🍳 ${esc(x)} ›</button>`:`<span class="dish0">🍽 ${esc(x)}</span>`}).join('')}</div>
  ${its.length?`<ul class="chk">${its.map(([i,n])=>`<li class="${i.done?'done':i.cart?'incart':''}" data-del="${n}">${i.done?'':cartBtn(n,i.cart)}<label class="lrow"><input type="checkbox" ${i.done?'checked':''} data-tm="${n}"><span style="flex:1">${esc(i.name)}${i.qty?` <span class="muted">${esc(i.qty)}</span>`:''}<span class="muted">${(i.uses||[]).filter(u=>u.d===d&&u.dish).map(u=>'・'+esc(u.dish)).join('')}</span></span></label>${i.done?(i.yen?`<span class="muted">${yen(i.yen)}・${esc(i.cat||'')}</span>`:''):`<input type="number" inputmode="numeric" placeholder="金額" style="width:80px"${i.price?` value="${i.price}"`:''}><select style="width:96px">${catOpts(i.cat||'食材・米')}</select>`}<button class="sub" data-act="del" data-id="${n}" aria-label="消す">✕</button></li>`).join('')}</ul>`:'<div class="muted">この日に買うものはありません</div>'}</div>`});
 const rest=S.list.map((i,n)=>[i,n]).filter(([i,n])=>!used.has(n));
 if(rest.length)h+=`<div class="card" id="dayx"><h2>曜日なし</h2><ul class="chk">${rest.map(([i,n])=>`<li class="${i.done?'done':i.cart?'incart':''}" data-del="${n}">${i.done?'':cartBtn(n,i.cart)}<label class="lrow"><input type="checkbox" ${i.done?'checked':''} data-tm="${n}"><span style="flex:1">${esc(i.name)}${i.qty?` <span class="muted">${esc(i.qty)}</span>`:''}</span></label>${i.done?(i.yen?`<span class="muted">${yen(i.yen)}・${esc(i.cat||'')}</span>`:''):`<input type="number" inputmode="numeric" placeholder="金額" style="width:80px"${i.price?` value="${i.price}"`:''}><select style="width:96px">${catOpts(i.cat||'食材・米')}</select>`}<button class="sub" data-act="del" data-id="${n}" aria-label="消す">✕</button></li>`).join('')}</ul></div>`;
 return h||'<div class="card muted empty"><img src="img/chibi_cheer.webp" alt="" width="120">献立も買い物もまだありません。アキラちゃんの献立の返事から「まとめて入れる」で入ります。</div>'}
function delItem(n){S.list.splice(n,1);save();render()}
function clearDone(){S.list=S.list.filter(i=>!i.done);save();render()}
function addSpend(){const a=+val('sp_amt');if(!okAmt(a)||a<=0)return alert('金額は1円以上の数字で入れてください（マイナスは使えません）');const dt=val('sp_date');if(!isDate(dt))return alert('日付を入れてください');S.spend.push({id:uid(),date:dt,store:val('sp_store'),cat:val('sp_cat'),amount:a,memo:val('sp_memo')});save();render()}
function csv(){const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';const t='\ufeff日付,店,費目,金額,メモ\r\n'+S.spend.map(r=>[r.date,r.store,r.cat,r.amount,r.memo].map(q).join(',')).join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download='家計_'+ymd(today())+'.csv';a.click()}
function togDay(i){const a=S.settings.shopDays;S.settings.shopDays=a.includes(i)?a.filter(x=>x!==i):a.concat(i).sort();save();render()}
function clearSamples(){if(!confirm('メモが「サンプル」の記録や、見本の品物を消します。よろしいですか？'))return;S.spend=S.spend.filter(r=>!/サンプル/.test(r.memo||''));S.list=S.list.filter(i=>!i.sample);S.fridge=S.fridge.filter(f=>!f.sample);S.menu=menuArr().map(x=>/サンプル/.test(x)?'':x);if(isArr(S.sampleKeys)&&S.sampleKeys.includes('prep'))S.prep='';delete S.sampleKeys;save();render()}
// data属性のボタン（onclickに値を埋め込まない）
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const id=b.dataset.id;
 switch(b.dataset.act){
  case 'del':delMany(String(id).split(',').map(Number).filter(Number.isInteger));break;
  case 'jump':jumpDay(+id);break;
  case 'tdish':togDish(id);break;
  case 'mtl':missingToList(+b.dataset.w,id);break;
  case 'dles':dishLesson(id);break;
  case 'ask':askRecipe(+b.dataset.w,id);break;
  case 'orec':openRecipe(id);break;
 case 'delStore':if(confirm('消しますか？')){S.userStores=S.userStores.filter(s=>s.id!==id);save();render()}break;
 case 'delSpend':if(confirm('消しますか？')){S.spend=S.spend.filter(r=>r.id!==id);save();render()}break;
 case 'delFr':S.fridge=S.fridge.filter(f=>f.id!==id);save();render();break;
 case 'toList':{const f=S.fridge.find(x=>x.id===id);if(f){S.list.push({name:f.name,store:'',trip:curTrip(today()).wd,done:false});save();alert('買い物リストに入れました')}break}
 case 'region':if(BASE.regions.some(r=>r.id===id)){S.settings.region=id;save();render()}break;
 case 'often':{const o=oft()[+b.dataset.id];if(o){const t=val('li_trip');const it={name:o.name,qty:o.qty||'',store:val('li_store'),trip:t!==''?+t:curTrip(today()).wd,done:false};if(o.cat)it.cat=o.cat;if(o.price)it.price=o.price;S.list.push(it);save();render();toast('「'+o.name.slice(0,14)+'」を入れました')}break}}});
function render(){const t=(location.hash||'#home').slice(1);const f=V[t]||V.home;$('#view').innerHTML=f();
 document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+t));if(render._t!==t){render._t=t;window.scrollTo(0,0)}}
function demo(){const d=ymd(today()),w=curTrip(today()).wd;S=structuredClone(def);
 S.list=[{name:'玉子',store:'スーパーマルハチ 武庫之荘店',trip:w,done:false,sample:true},{name:'牛乳',store:'フレスコ 武庫之荘店',trip:w,done:true,sample:true},{name:'鶏むね肉',qty:'2枚',store:'',trip:w,done:false,sample:true},{name:'冷凍ブロッコリー',store:'業務スーパー 南武庫之荘店',trip:w,done:false,sample:true}];
 S.spend=[{id:'a',date:d,store:'KOHYO 武庫之荘店',cat:'食材・米',amount:5480,memo:'サンプル'},{id:'b',date:d,store:'ウエルシア 尼崎南武庫之荘店',cat:'日用品',amount:1260,memo:'サンプル'}];
 S.fridge=[{id:'c',name:'にんじん',until:d,sample:true},{id:'d',name:'豚こま',until:'',sample:true}];S.menu=['','豚の生姜焼き（サンプル）','カレー（サンプル）','','','',''];S.prep='きんぴら（日曜に作る・水曜まで）';S.sampleKeys=['prep'];save()}
window.addEventListener('hashchange',render);
Promise.all([fetch('data/regions.json').then(r=>r.json()),fetch('data/stores.json').then(r=>r.json())]).then(([r,s])=>{BASE={regions:r.regions,stores:s.stores,source:s.source};if(!BASE.regions.some(x=>x.id===S.settings.region))S.settings.region=def.settings.region;
 const q=new URLSearchParams(location.search);if(IS_DEMO)demo();render();if(q.get('ai'))setTimeout(()=>aiDemo(q),50)}).catch(e=>{$('#view').innerHTML='データを読めませんでした：'+esc(e)});
if('serviceWorker' in navigator){const had=!!navigator.serviceWorker.controller;let rl=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!rl){rl=true;location.reload()}});navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(r=>{r.update();document.addEventListener('visibilitychange',()=>{if(!document.hidden)r.update()})})}
async function aiDemo(q){AI.mode=q.get('ai');if(AI.mode==='chat'||AI.mode==='advise'){render();document.getElementById('aiq').value=AI.mode==='chat'?'あしたの晩ごはん、何がいい？':'お弁当を毎日作りたい';await aiAsk();AT.open='demo';render();return}
 await aiAsk();AT.open='demo';render();if(q.has('lesson')){startLesson();goStep(+q.get('lesson')-1)}}
function menuArr(){if(isArr(S.menu)&&S.menu.length===7)return S.menu;const a=['','','','','','',''];String(S.menu||'').split('\n').forEach(l=>{const m=l.match(/^([日月火水木金土])[：:](.*)$/);if(m)a[WD.indexOf(m[1])]=m[2].trim()});return a}
function setMenu(w,v){const a=menuArr().slice();a[w]=v;S.menu=a;save()}
function bkDue(){return !S.lastBackup||(today()-new Date(S.lastBackup+'T12:00'))>7*864e5}
function backup(){S.lastBackup=ymd(today());save();const data={app:'okaimono',version:DATA_VERSION,exported:new Date().toISOString(),data:S,links:getLinks(),hist:(typeof hist==='function'?hist():[])};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'}));a.download='おかいもの_バックアップ_'+ymd(today())+'.json';a.click();render()}
function restore(ev){const inp=ev.target,f=inp.files[0];if(!f)return;
 if(f.size>4e6){alert('読めませんでした（いまのデータはそのままです）：ファイルが大きすぎます（4MBまで）');inp.value='';return}
 f.text().then(t=>{if(new Blob([t]).size>4e6)throw new Error('ファイルが大きすぎます（4MBまで）');let j;try{j=JSON.parse(t)}catch(e){throw new Error('JSONではありません')}
  if(!isObj(j)||j.app!=='okaimono'||!isObj(j.data))throw new Error('このアプリのバックアップではありません');
  if(!Number.isInteger(j.version)||j.version<1||j.version>DATA_VERSION)throw new Error(j.version===undefined?'版（version）が書かれていないため読めません':'対応していない版です（version '+String(j.version).slice(0,20)+'）');
  const nd=validate(j.data); // ここで失敗すれば、いまのデータはそのまま
  if(!confirm('いまのデータを、バックアップの内容で置き換えます。よろしいですか？'))return;const txt=JSON.stringify(nd);if(new Blob([txt]).size>4e6)throw new Error('データが大きすぎます（4MBまで）');try{localStorage.setItem(K,txt)}catch(e){throw new Error('スマホの保存領域に入りきりませんでした')}S=nd;
  if(isObj(j.links)){const L={};Object.entries(j.links).forEach(([k,v])=>{if(isStr(k)&&isStr(v)&&k.length<200&&v.length<400)L[k]=v});try{localStorage.setItem(LK,JSON.stringify(L))}catch(e){}}
  if(isArr(j.hist)&&typeof saveHist==='function'){const cur=hist(),ids=new Set(cur.map(e=>e.id));saveHist(cur.concat(j.hist.filter(e=>isObj(e)&&isStr(e.id)&&isObj(e.item)&&AISHAPE[e.item.kind]&&!ids.has(e.id))))}
  alert('戻しました');render()})
 .catch(e=>alert('読めませんでした（いまのデータはそのままです）：'+e.message)).finally(()=>{inp.value=''})}
// 初回起動で、データを消されにくくする（ブラウザが空き容量不足のときに自動削除しない）
(function(){try{if(localStorage.getItem('okaimono_persist'))return;if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().then(ok=>{try{localStorage.setItem('okaimono_persist',ok?'granted':'denied:'+new Date().toISOString().slice(0,10))}catch(e){}}).catch(()=>{})}}catch(e){}})();
