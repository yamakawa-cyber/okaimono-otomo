// ===== v39：家計の月次・年次の記録（過去の月は消さずに積み上げ）と、週1回の会計データ送信 =====
const LGK='okaimono_ledger',LEDGER_SYNC=true; // ライフハック！では port.py が false にする
function ldgRead(){try{const o=JSON.parse(localStorage.getItem(LGK)||'{}');return isObj(o)?o:{}}catch(e){return {}}}
function ldgWrite(o){try{localStorage.setItem(LGK,JSON.stringify(o))}catch(e){}}
// 明細から月ごとの集計を作る（純粋関数・テスト用）
function monthsFrom(spend){const m={};(isArr(spend)?spend:[]).forEach(r=>{if(!isObj(r)||!isDate(r.date)||!Number.isFinite(+r.amount))return;const k=r.date.slice(0,7),c=normCat(r.cat)||'そのほか';const e=m[k]||(m[k]={total:0,zappi:0,n:0,byCat:{}});if(c==='雑費')e.zappi+=+r.amount;else e.total+=+r.amount;e.n++;e.byCat[c]=(e.byCat[c]||0)+(+r.amount)});return m}
// 保管庫を更新：明細のある月は作り直し、明細が消えた過去の月は保管庫の数字を残す
function mergeMonths(old,fresh,cur){const out={};Object.entries(isObj(old)?old:{}).forEach(([k,v])=>{if(/^\d{4}-\d{2}$/.test(k)&&isObj(v)&&Number.isFinite(v.total))out[k]=v});Object.entries(fresh).forEach(([k,v])=>{out[k]=Object.assign({},v,{closed:k<cur})});return out}
function ldgUpdate(){if(IS_DEMO)return ldgRead();const L=ldgRead();L.months=mergeMonths(L.months,monthsFrom(S.spend),ymd(today()).slice(0,7));L.budget=S.settings.monthly;L.updated=ymd(today());ldgWrite(L);return L}
const LDG={year:null};
function ledgerHtml(){const L=ldgUpdate(),ms=L.months||{},bud=S.settings.monthly||100000,cur=ymd(today()).slice(0,7);
 const years=[...new Set(Object.keys(ms).map(k=>k.slice(0,4)).concat([cur.slice(0,4)]))].sort().reverse();const y=LDG.year&&years.includes(LDG.year)?LDG.year:years[0];
 let yt=0,yn=0,yz=0;const rows=[];for(let i=12;i>=1;i--){const k=y+'-'+String(i).padStart(2,'0');if(k>cur&&!ms[k])continue;const e=ms[k];if(!e)continue;yt+=e.total;yz+=e.zappi||0;yn++;
  const cats=Object.entries(e.byCat||{}).sort((a,b)=>b[1]-a[1]);
  rows.push(`<details class="lmon"${k===cur?' open':''}><summary><span>${i}月${k===cur?'（今月）':''}</span><span>${yen(e.total)} / ${yen(bud)}${e.zappi?` ＋雑費 ${yen(e.zappi)}`:''} <span class="${e.total>bud?'over':'muted'}">${e.total>bud?'＋'+yen(e.total-bud).replace('-',''):'残り '+yen(bud-e.total)}</span></span></summary>${bar(e.total,bud)}${cats.map(([c,v])=>`<div class="crow"><span>${esc(c)}</span><span>${yen(v)}</span></div>`).join('')}<div class="muted">${e.n||0}件${e.zappi?`・雑費 ${yen(e.zappi)}（枠の外）`:''}</div></details>`)}
 return `<h2>📒 月次・年次の記録</h2><div class="card"><div class="seg wrap">${years.map(x=>`<button class="${x===y?'on':''}" onclick="LDG.year='${x}';render()">${x}年</button>`).join('')}</div>
 <div class="crow"><b>${y}年の生活費</b><b>${yen(yt)}</b></div><div class="crow zappi"><span>${y}年の雑費（枠の外）</span><span>${yen(yz)}</span></div><div class="muted">${yn}か月分・月平均 ${yen(yn?Math.round(yt/yn):0)}（月の枠 ${yen(bud)}）</div>${rows.join('')||'<div class="muted">この年の記録はまだありません</div>'}
 ${LEDGER_SYNC?`<div class="row"><button class="sub" onclick="sendLedger(true)">📤 会計をアキラちゃんに送る</button></div><div class="muted">${esc(ldgStatus())}</div>`:''}</div>`}
function ldgStatus(){const L=ldgRead();return L.sentAt?'最後に送った日：'+L.sentAt+'（週1回、アプリを開いたときに自動で送ります）':'まだ送っていません（中継サーバーの設定があれば、週1回自動で送ります）'}
function ledgerPayload(days){const L=ldgUpdate(),d=today(),from=ymd(new Date(d.getTime()-(days||62)*864e5));
 return {app:'okaimono',type:'ledger',made:ymd(d),from,to:ymd(d),note:'months[月].total は生活費（月の枠の対象）、zappi は雑費（枠の外）',budget:{monthly:S.settings.monthly,outside:['雑費'],cats:Object.fromEntries(CATS.map(c=>[c[0],c[1]]))},
  receipts:S.spend.filter(r=>r.date>=from).map(r=>({id:r.id,date:r.date,store:r.store||'',cat:normCat(r.cat),amount:r.amount,memo:r.memo||'',rc:r.rc?1:0})),months:L.months||{}}}
let ldgBusy=false;
async function sendLedger(manual){if(!LEDGER_SYNC||IS_DEMO||ldgBusy)return;const b=relayBase();if(!b){if(manual)toast('中継サーバー（X-App-Pass）の設定がないので送れません');return}
 const L=ldgRead();if(!manual&&L.sentAt&&(today()-new Date(L.sentAt))<6*864e5)return;if(!manual&&typeof authNg==='function'&&authNg())return;
 ldgBusy=true;try{const r=await fetch(b+'/ledger',{method:'POST',headers:{'Content-Type':'application/json','X-App-Pass':secret().key},body:JSON.stringify(ledgerPayload())});if(!r.ok)throw new Error('中継サーバーのエラー '+r.status);
  const L2=ldgRead();L2.sentAt=ymd(today());ldgWrite(L2);if(manual)toast('会計を送りました');if(location.hash==='#money')render()}catch(e){if(manual)toast('送れませんでした：'+e.message)}finally{ldgBusy=false}}
{const f=V.money;V.money=function(){return f.apply(this,arguments)+ledgerHtml()}}
BKX.ledger={get:()=>ldgRead(),check:v=>isObj(v),set:v=>{if(isObj(v)){const L=ldgRead();L.months=Object.assign({},isObj(v.months)?v.months:{},L.months||{});ldgWrite(L)}}};
try{ldgUpdate()}catch(e){}
setTimeout(()=>sendLedger(false),4000);
