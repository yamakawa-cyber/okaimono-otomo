'use strict';
// 📷 写真（相談パネルの中）と 📩 返事の受け取り。写真はメモリ上だけ（保存しない）。
const RC_MAX_IMGS=6,RC_MAXBYTES=1350000,PK='okaimono_pending';
let RC={imgs:[],busy:false};
let INBOX=[],INBOX_ST='';
function rcThumbs(del){return `<div class="thumbs">${RC.imgs.map((u,i)=>`<span class="th"><img src="${u}" alt="写真${i+1}">${del?`<button class="sub" onclick="RC.imgs.splice(${i},1);render()" aria-label="消す">✕</button>`:''}</span>`).join('')}</div>`}
function rcPickHtml(){return `<label class="btnlike">📷 写真を撮る/選ぶ（レシートなど）<input id="rc_file" type="file" accept="image/*" capture="environment" multiple hidden onchange="rcPick(this)"></label>
 ${RC.busy?'<div class="muted">写真を縮めています…</div>':''}${RC.imgs.length?rcThumbs(true)+`<div class="muted">${RC.imgs.length}枚（最大${RC_MAX_IMGS}枚）・約${Math.ceil(RC.imgs.reduce((a,x)=>a+x.length,0)/1024)}KB。白黒に縮めて送ります。写真はスマホに保存しません。</div>`:`<div class="muted">レシートは「レシート読み取り」を選ぶと家計簿に入れられます（何枚でも、最大${RC_MAX_IMGS}枚）。</div>`}`}
function rcLoad(f){return new Promise((ok,ng)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);ng(new Error('画像を読めませんでした'))};im.src=u})}
function rcShrink(im,budget){let side=1200,q=0.7,out='';
 for(let k=0;k<12;k++){const r=Math.min(1,side/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*r)),h=Math.max(1,Math.round(im.naturalHeight*r));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
  const d=x.getImageData(0,0,w,h),p=d.data;for(let i=0;i<p.length;i+=4){const g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];p[i]=p[i+1]=p[i+2]=g}x.putImageData(d,0,0);
  out=c.toDataURL('image/jpeg',q);if(out.length<=budget)return out;if(q>0.45)q-=0.1;else side=Math.round(side*0.85)}
 return out}
async function rcPick(inp){const q=document.getElementById('c_q'),t=document.getElementById('c_type');if(q)CON.q=q.value;if(t)CON.type=t.value;
 const fs=[...inp.files].filter(f=>/^image\//.test(f.type));inp.value='';if(!fs.length)return;
 const room=RC_MAX_IMGS-RC.imgs.length;if(fs.length>room)alert(`写真は${RC_MAX_IMGS}枚までです（${Math.max(0,room)}枚だけ追加します）`);
 RC.busy=true;render();try{for(const f of fs.slice(0,Math.max(0,room)))RC.imgs.push(rcShrink(await rcLoad(f),Math.floor(RC_MAXBYTES/RC_MAX_IMGS)-2000))}catch(e){alert(e.message)}
 RC.busy=false;if(RC.imgs.length&&CON.type!=='receipt'&&confirm('レシートの読み取り（家計簿に入れる）として送りますか？'))CON.type='receipt';render()}
// --- 送った相談の番号（返事を受け取るため。7日で忘れる）---
function pending(){try{const a=JSON.parse(localStorage.getItem(PK)||'[]');return isArr(a)?a.filter(x=>isObj(x)&&/^c[a-z0-9]{4,40}$/.test(x.id)&&Date.now()-x.at<7*864e5):[]}catch(e){return []}}
function savePending(a){localStorage.setItem(PK,JSON.stringify(a.slice(-30)))}
function addPending(id,type){const a=pending();a.push({id,type,at:Date.now()});savePending(a);[20,60,180].forEach(s=>setTimeout(fetchReplies,s*1000))}
function relayBase(){const s=secret();if(s.header!=='X-App-Pass'||!s.url||!s.key)return null;try{return new URL(s.url).origin}catch(e){return null}}
let fetching=false;
async function fetchReplies(manual){const b=relayBase(),p=pending();if(IS_DEMO||fetching)return;if(!b){if(manual){INBOX_ST='返事の受け取りは中継サーバー（X-App-Pass）を使うときだけです';render()}return}
 if(!p.length){if(manual){INBOX_ST='待っている返事はありません';render()}return}
 fetching=true;try{const r=await fetch(b+'/replies?ids='+p.map(x=>x.id).join(','),{headers:{'X-App-Pass':secret().key}});if(!r.ok)throw new Error('受け取りエラー（'+r.status+'）');
  const j=await r.json();let n=0;(isArr(j.replies)?j.replies:[]).forEach(x=>{if(!isObj(x)||!isArr(x.items))return;x.items.forEach((it,k)=>{const key=x.id+'#'+k;if(INBOX.some(e=>e.key===key))return;let err='';try{checkAI(it)}catch(e){err=e.message}INBOX.push({key,id:x.id,item:it,err});n++})});
  INBOX_ST=n?'':(manual?'まだ返事は届いていません':INBOX_ST)}
 catch(e){if(manual)INBOX_ST='返事を確かめられませんでした：'+e.message}finally{fetching=false;render()}}
async function ackId(id){if(!id||INBOX.some(e=>e.id===id))return;savePending(pending().filter(x=>x.id!==id));const b=relayBase();if(!b)return;
 try{await fetch(b+'/ack',{method:'POST',headers:{'Content-Type':'application/json','X-App-Pass':secret().key},body:JSON.stringify({ids:[id]})})}catch(e){}}
function dropInbox(keys){const ids=new Set();INBOX=INBOX.filter(e=>{if(keys.includes(e.key)){ids.add(e.id);return false}return true});ids.forEach(ackId);render()}
// --- レシート ---
function rcCat(c){return CATS.some(x=>x[0]===c)?c:'予備'}
function rcKey(r){return [r.store,r.date,Math.round(r.total)].join('|')}
function rcGroups(r){const by={};r.items.forEach(i=>{const c=rcCat(i.category);by[c]=(by[c]||0)+Math.round(i.price)});return Object.entries(by).filter(([,v])=>v>=1)}
const rcDup=r=>S.spend.some(x=>x.rc===rcKey(r));
function rcApply(keys){let n=0,sk=0;INBOX.filter(e=>keys.includes(e.key)&&!e.err&&e.item.kind==='receipt').forEach(e=>{const r=e.item,k=rcKey(r);if(S.spend.some(x=>x.rc===k)){sk++;return}
  rcGroups(r).forEach(([c,v])=>S.spend.push({id:uid(),date:r.date,store:r.store.slice(0,200),cat:c,amount:v,memo:'レシート',rc:k}));n++});
 save();dropInbox(keys);alert(`家計簿に${n}枚分を入れました`+(sk?`（同じレシート${sk}枚は入れませんでした）`:''))}
function rcImport(arr){arr.forEach((r,k)=>INBOX.push({key:'paste'+uid()+'#'+k,id:null,item:r,err:''}));CON.open=false;location.hash='#home';render()}
function openReply(key){const e=INBOX.find(x=>x.key===key);if(!e||e.err)return;const r=e.item;
 if(r.kind==='chat'){AI.mode='chat';AI.chat.push({t:r.reply})}else{AI.res=r;AI.mode=r.kind;AI.lesson=false;AI.started=false;AI.step=0}dropInbox([key]);location.hash='#ai';render()}
function inboxHtml(){if(IS_DEMO)return '';if(!INBOX.length)return INBOX_ST?`<div class="card tip">${esc(INBOX_ST)}</div>`:'';
 const rc=INBOX.filter(e=>!e.err&&e.item.kind==='receipt'),other=INBOX.filter(e=>!(!e.err&&e.item.kind==='receipt'));
 let h=`<div class="card inbox"><b>📩 アキラちゃんから返事（${INBOX.length}件）</b>`;
 if(rc.length){const okKeys=rc.filter(e=>!rcDup(e.item)).map(e=>e.key);
  h+=rc.map(e=>{const r=e.item,g=rcGroups(r),sum=g.reduce((a,[,v])=>a+v,0);return `<div class="rcprev"><div>🧾 <b>${esc(r.store)}</b> <span class="muted">${esc(r.date)}・合計 ${yen(r.total)}（${r.items.length}品）</span></div>
   <table>${g.map(([c,v])=>`<tr><td>${esc(c)}</td><td>${yen(v)}</td></tr>`).join('')}</table>
   ${sum!==Math.round(r.total)?`<div class="err">品目の合計（${yen(sum)}）とレシートの合計が合いません。値引きなどを確かめてください。</div>`:''}${rcDup(r)?'<div class="err">同じレシート（店・日付・合計が同じ）はもう取り込み済みです。</div>':''}
   <div class="row"><button class="sub" onclick="dropInbox(['${e.key}'])">入れない</button>${rcDup(r)?'':`<button onclick="rcApply(['${e.key}'])">これを家計簿に入れる</button>`}</div></div>`}).join('');
  if(okKeys.length>1)h+=`<div class="row"><button onclick="rcApply(${esc(JSON.stringify(okKeys))})">まとめて家計簿に入れる（${okKeys.length}枚）</button></div>`}
 h+=other.map(e=>e.err?`<div class="err">読めない返事がありました（${esc(e.err)}）<button class="sub" onclick="dropInbox(['${e.key}'])">消す</button></div>`
  :`<div class="rcprev">${esc({menu:'🍳 献立',shop:'🛒 買い物リスト',money:'💰 節約',hacks:'💡 ライフハック',advise:'🧭 やりたいこと',chat:'💬 ひとこと'}[e.item.kind]||e.item.kind)}：<b>${esc(e.item.title||'')}</b>${e.item.kind==='chat'?`<div>${esc(String(e.item.reply).slice(0,200))}</div>`:''}
   <div class="row"><button class="sub" onclick="dropInbox(['${e.key}'])">消す</button><button onclick="openReply('${e.key}')">ひらく</button></div></div>`).join('');
 return h+'</div>'}
for(const t of ['home','fridge','list','money','ai','stores','settings'])if(V[t]){const f=V[t];V[t]=function(){return inboxHtml()+f.apply(this,arguments)}}
setTimeout(()=>fetchReplies(false),1500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')fetchReplies(false)});
