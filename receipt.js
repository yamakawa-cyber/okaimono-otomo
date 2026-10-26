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
 RC.busy=false;if(RC.imgs.length&&CON.type!=='receipt'&&CON.type!=='fridge'&&confirm('レシートの読み取り（家計簿に入れる）として送りますか？'))CON.type='receipt';render()}
// --- 送った相談の番号（返事を受け取るため。7日で忘れる）---
function pending(){try{const a=JSON.parse(localStorage.getItem(PK)||'[]');return isArr(a)?a.filter(x=>isObj(x)&&/^c[a-z0-9]{4,40}$/.test(x.id)&&Date.now()-x.at<7*864e5&&!(x.tk&&Date.now()-x.tk>2*864e5)):[]}catch(e){return []}}
function savePending(a){setLS(PK,JSON.stringify(a.slice(-30)))}
function addPending(id,type){const a=pending();if(a.some(x=>x.id===id))return;a.push({id,type,at:Date.now()});savePending(a);[20,60,180].forEach(s=>setTimeout(fetchReplies,s*1000))}
function relayBase(){const s=secret();if(s.header!=='X-App-Pass'||!s.url||!s.key)return null;try{return new URL(s.url).origin}catch(e){return null}}
let fetching=false;
async function fetchReplies(manual){const b=relayBase(),p=pending();if(IS_DEMO||fetching)return;if(!b){if(manual){INBOX_ST='返事の受け取りは中継サーバー（X-App-Pass）を使うときだけです';render()}return}
 if(!p.length){if(manual){INBOX_ST='待っている返事はありません';render()}return}
 fetching=true;try{const r=await fetch(b+'/replies?ids='+p.map(x=>x.id).join(','),{headers:{'X-App-Pass':secret().key}});if(!r.ok)throw new Error('受け取りエラー（'+r.status+'）');
  const j=await r.json();let n=0;(isArr(j.replies)?j.replies:[]).forEach(x=>{if(!isObj(x)||!isArr(x.items))return;const off=Number.isInteger(x.off)&&x.off>=0?x.off:0,pe=p.find(y=>y.id===x.id)||{};x.items.forEach((it,k0)=>{const k=off+k0,key=x.id+'#'+k;if(k<(pe.taken||0)||INBOX.some(e=>e.key===key))return;let err='';try{checkAI(it);histAdd(it,'reply')}catch(e){err=e.message}INBOX.push({key,id:x.id,item:it,err});n++})});
  INBOX_ST=n?'':(manual?'まだ返事は届いていません':INBOX_ST)}
 catch(e){if(manual)INBOX_ST='返事を確かめられませんでした：'+e.message}finally{fetching=false;render()}}
// 受取済み：取り込んだ番号(#k)までを知らせる。後から届いた分は消さない
async function ackId(id,upto){if(!id||INBOX.some(e=>e.id===id))return;const a=pending(),pe=a.find(x=>x.id===id);if(pe){pe.taken=Math.max(pe.taken||0,upto||0);pe.tk=Date.now();savePending(a)}const b=relayBase();if(!b)return;
 try{await fetch(b+'/ack',{method:'POST',headers:{'Content-Type':'application/json','X-App-Pass':secret().key},body:JSON.stringify({ids:[id],upto:{[id]:upto||0}})})}catch(e){}}
function dropInbox(keys){const up={};INBOX=INBOX.filter(e=>{if(keys.includes(e.key)){if(e.id){const k=+String(e.key).split('#')[1]||0;up[e.id]=Math.max(up[e.id]||0,k+1)}return false}return true});Object.entries(up).forEach(([id,n])=>ackId(id,n));render()}
// --- レシート ---
function rcCat(c){return CATS.some(x=>x[0]===c)?c:'予備'}
function rcKey(r){const k=[r.store,r.date,Math.round(r.total)];if(r.no||r.time)k.push(String(r.no||'')+'@'+String(r.time||''));return k.join('|')}
const rcSure=r=>!!(r.no||r.time); // 番号か時刻があれば同じレシートと言い切れる
function rcGroups(r){const by={};r.items.forEach(i=>{const c=rcCat(i.category);by[c]=(by[c]||0)+Math.round(i.price)});let g=Object.entries(by).filter(([,v])=>v>=1);
 // レシートの合計（税込）との差は「消費税・調整」で記録。品目の方が多い（値引き）ときは大きい費目から引く
 const sum=g.reduce((a,[,v])=>a+v,0),diff=Math.round(r.total)-sum;
 if(diff>=1)g.push(['消費税・調整',diff]);else if(diff<0){let rest=-diff;g=g.sort((a,b)=>b[1]-a[1]).map(([c,v])=>{const t=Math.min(rest,v-1);rest-=t;return [c,v-t]})}
 return g}
const rcDup=r=>S.spend.some(x=>x.rc===rcKey(r));
const rcTaxNote=r=>{const s0=r.items.reduce((a,i)=>a+Math.round(i.price),0),d=Math.round(r.total)-s0;return d>=1?`<div class="muted">品目の合計 ${yen(s0)} とレシートの合計の差 ${yen(d)} は「消費税・調整」で記録します。</div>`:d<0?`<div class="muted">品目の合計 ${yen(s0)} がレシートの合計より多いので、差（値引き）${yen(-d)} を費目から引いて記録します。</div>`:''};
function rcApply(keys,force){let n=0,sk=0;INBOX.filter(e=>keys.includes(e.key)&&!e.err&&e.item.kind==='receipt').forEach(e=>{const r=e.item,k=rcKey(r);if(!force&&S.spend.some(x=>x.rc===k)){sk++;return}
  rcGroups(r).forEach(([c,v])=>S.spend.push({id:uid(),date:r.date,store:r.store.slice(0,200),cat:c,amount:v,memo:'レシート',rc:k}));n++});
 save();dropInbox(keys);alert(`家計簿に${n}枚分を入れました`+(sk?`（同じレシート${sk}枚は入れませんでした）`:''))}
function rcImport(arr){arr.forEach((r,k)=>INBOX.push({key:'paste'+uid()+'#'+k,id:null,item:r,err:''}));CON.open=false;location.hash='#home';render()}
function openReply(key){const e=INBOX.find(x=>x.key===key);if(!e||e.err)return;const r=e.item;
 AT.open=histAdd(r,'reply');AT.lesson=null;dropInbox([key]);location.hash='#ai';render()}
function inboxHtml(){if(IS_DEMO)return '';if(!INBOX.length)return INBOX_ST?`<div class="card tip">${esc(INBOX_ST)}</div>`:'';
 const rc=INBOX.filter(e=>!e.err&&e.item.kind==='receipt'),other=INBOX.filter(e=>!(!e.err&&e.item.kind==='receipt'));
 let h=`<div class="card inbox"><b><img class="ava" src="img/face.webp" alt="">アキラちゃんから返事（${INBOX.length}件）</b>`;
 if(rc.length){const okKeys=rc.filter(e=>!rcDup(e.item)).map(e=>e.key);
  h+=rc.map(e=>{const r=e.item,g=rcGroups(r),sum=g.reduce((a,[,v])=>a+v,0);return `<div class="rcprev"><div>🧾 <b>${esc(r.store)}</b> <span class="muted">${esc(r.date)}・合計 ${yen(r.total)}（${r.items.length}品）</span></div>
   <table>${g.map(([c,v])=>`<tr><td>${esc(c)}</td><td>${yen(v)}</td></tr>`).join('')}</table>
   ${rcTaxNote(r)}${rcDup(r)?(rcSure(r)?'<div class="err">同じレシート（番号・時刻も同じ）はもう取り込み済みです。</div>':'<div class="err">店・日付・合計が同じレシートがもう入っています。別の買い物なら「それでも入れる」を押してください。</div>'):''}
   <div class="row"><button class="sub" data-x="drop" data-k="${esc(e.key)}">入れない</button>${!rcDup(r)?`<button data-x="apply" data-k="${esc(e.key)}">これを家計簿に入れる</button>`:rcSure(r)?'':`<button data-x="force" data-k="${esc(e.key)}">それでも入れる</button>`}</div></div>`}).join('');
  if(okKeys.length>1)h+=`<div class="row"><button data-x="applyall">まとめて家計簿に入れる（${okKeys.length}枚）</button></div>`}
 h+=other.map(e=>e.err?`<div class="err">読めない返事がありました（${esc(e.err)}）<button class="sub" data-x="drop" data-k="${esc(e.key)}">消す</button></div>`
  :`<div class="rcprev">${esc(KLABEL[e.item.kind]||e.item.kind)}：<b>${esc(histTitle(e.item))}</b>${e.item.kind==='chat'?`<div>${esc(String(e.item.reply).slice(0,200))}</div>`:''}
   <div class="row"><button class="sub" data-x="drop" data-k="${esc(e.key)}">消す</button><button data-x="open" data-k="${esc(e.key)}">ひらく</button></div></div>`).join('');
 return h+'</div>'}
for(const t of ['home','fridge','list','money','ai','stores','settings'])if(V[t]){const f=V[t];V[t]=function(){return inboxHtml()+f.apply(this,arguments)}}
setTimeout(()=>fetchReplies(false),1500);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')fetchReplies(false)});

// ボタンの動作（idは data-k で渡す。onclick に文字列を埋め込まない）
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-x]');if(!b)return;const k=b.dataset.k||'';
 switch(b.dataset.x){case 'drop':return dropInbox([k]);case 'open':return openReply(k);case 'apply':return rcApply([k]);case 'force':return rcApply([k],true);
  case 'applyall':return rcApply(INBOX.filter(e=>!e.err&&e.item.kind==='receipt'&&!rcDup(e.item)).map(e=>e.key));
  case 'hdel':return histDel(k);case 'hopen':return histOpen(k);case 'hfilter':AT.filter=k;return render()}});
setTimeout(()=>{try{if(linkMenu()&&location.hash==='#fridge')render()}catch(e){}},400);
