'use strict';
// 📷 レシート：写真を縮小（白黒・長辺1200px・JPEG）して「アキラちゃん」に送る。写真は保存しない（メモリ上だけ）。
const RC_MAX_IMGS=3,RC_MAXBYTES=1400000;
let RC={imgs:[],stage:'',status:'',ok:true,sending:false,preview:null};
function rcHtml(){
 const pv=RC.preview?rcPreviewHtml():'';
 if(IS_DEMO)return `<div class="card sample">🧪 見本モードではレシートを送りません。</div>`+pv;
 const s=secret();
 let h=`<div class="card rcbox"><label class="btnlike">📷 レシートを撮る/選ぶ<input id="rc_file" type="file" accept="image/*" capture="environment" multiple hidden onchange="rcPick(this)"></label>
 <div class="muted">最大${RC_MAX_IMGS}枚。白黒に縮小して送ります。写真はスマホのアプリ内には保存しません。</div>`;
 if(RC.imgs.length){const tot=RC.imgs.reduce((a,x)=>a+x.length,0);
  h+=`<div class="thumbs">${RC.imgs.map((u,i)=>`<span class="th"><img src="${u}" alt="レシート${i+1}"><button class="sub" onclick="RC.imgs.splice(${i},1);render()">✕</button></span>`).join('')}</div>
  <div class="muted">${RC.imgs.length}枚・約${Math.ceil(tot/1024)}KB／いっしょに送るもの：費目の一覧（${CATS.map(c=>c[0]).join('・')}）</div>`;
  if(!s.url||!s.key)h+=`<div class="tip">送信先が未設定です。<a class="link" href="#settings">設定へ →</a></div>`;
  else h+=`<div class="row"><button class="sub" onclick="RC.imgs=[];RC.status='';render()">やめる</button><button onclick="rcSend()" ${RC.sending?'disabled':''}>${RC.sending?'送信中…':'この写真を送る'}</button></div>`}
 if(RC.status)h+=`<div class="${RC.ok?'tip':'err'}">${esc(RC.status)}</div>`;
 return h+'</div>'+pv}
function rcLoad(f){return new Promise((ok,ng)=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);ng(new Error('画像を読めませんでした'))};im.src=u})}
function rcShrink(im,budget){let side=1200,q=0.7,out='';
 for(let k=0;k<12;k++){const r=Math.min(1,side/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*r)),h=Math.max(1,Math.round(im.naturalHeight*r));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
  const d=x.getImageData(0,0,w,h),p=d.data;for(let i=0;i<p.length;i+=4){const g=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];p[i]=p[i+1]=p[i+2]=g}x.putImageData(d,0,0);
  out=c.toDataURL('image/jpeg',q);if(out.length<=budget)return out;if(q>0.45)q-=0.1;else side=Math.round(side*0.85)}
 return out}
async function rcPick(inp){const fs=[...inp.files];inp.value='';if(!fs.length)return;
 const room=RC_MAX_IMGS-RC.imgs.length;if(fs.length>room)alert(`写真は${RC_MAX_IMGS}枚までです（${Math.max(0,room)}枚だけ追加します）`);
 RC.status='写真を縮めています…';RC.ok=true;render();
 try{for(const f of fs.slice(0,Math.max(0,room))){if(!/^image\//.test(f.type))continue;RC.imgs.push(rcShrink(await rcLoad(f),Math.floor(RC_MAXBYTES/RC_MAX_IMGS)-2000))}RC.status=''}
 catch(e){RC.status=e.message;RC.ok=false}render()}
function rcPayload(){CON.reqId='c'+uid();const p={app:'okaimono',id:CON.reqId,type:'receipt',question:'レシートの写真です。読み取り結果を receipt の形のJSONで返してください。',sentAt:new Date().toISOString(),
 data:{categories:CATS.map(c=>c[0]),images:RC.imgs.slice(0,RC_MAX_IMGS)}};const body=JSON.stringify(p);
 if(new Blob([body]).size>RC_MAXBYTES+20000)throw new Error('写真が大きすぎます。枚数を減らしてください');return body}
async function rcSend(){const s=secret();if(IS_DEMO||RC.sending||!RC.imgs.length)return;if(!s.url||!s.key)return;
 if(!navigator.onLine){RC.status='いまオフラインなので送れません。';RC.ok=false;return render()}
 let body;try{body=rcPayload()}catch(e){RC.status=e.message;RC.ok=false;return render()}
 const h={'Content-Type':'application/json'};h[s.header]=s.header==='Authorization'?'Bearer '+s.key:s.key;
 RC.sending=true;RC.status='送信中…（番号 '+CON.reqId+'）';RC.ok=true;render();
 try{const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),30000);const r=await fetch(s.url,{method:'POST',headers:h,body,signal:ctl.signal});clearTimeout(tm);
  if(!r.ok){let m='';try{const j=await r.json();if(j&&isStr(j.message))m=j.message.slice(0,200)}catch(_){}throw new Error(r.status===429?(m||'きょうの上限に達しました'):r.status===413?'写真が大きすぎて受け取ってもらえませんでした。枚数を減らしてください':'受け取り側のエラー（'+r.status+'）'+(m?'：'+m:''))}
  RC.imgs=[];RC.ok=true;RC.status='送りました！（番号 '+CON.reqId+'）読み取り結果の取り込みコードが届いたら、相談の「取り込みコードを貼る」に貼ってください。'}
 catch(e){RC.ok=false;RC.status=e.name==='AbortError'?'時間切れになりました。届いている可能性があります。':/Failed to fetch|NetworkError|Load failed/i.test(e.message)?'送れませんでした：受け取り先につながりませんでした。':'送れませんでした：'+e.message}
 finally{RC.sending=false;render()}}
// 取り込み：{kind:'receipt',store,date,items:[{name,price,category}],total}
function rcCat(c){return CATS.some(x=>x[0]===c)?c:'予備'}
function rcKey(r){return [r.store,r.date,Math.round(r.total)].join('|')}
function rcGroups(r){const by={};r.items.forEach(i=>{const c=rcCat(i.category);by[c]=(by[c]||0)+Math.round(i.price)});return Object.entries(by).filter(([,v])=>v>=1)}
function rcPreviewHtml(){const r=RC.preview,g=rcGroups(r),sum=g.reduce((a,[,v])=>a+v,0),dup=S.spend.some(x=>x.rc===rcKey(r));
 return `<div class="card"><b>🧾 レシートの取り込み</b><div class="muted">${esc(r.store)}・${esc(r.date)}・合計 ${yen(r.total)}（${r.items.length}品）</div>
 <table>${g.map(([c,v])=>`<tr><td>${esc(c)}</td><td>${yen(v)}</td></tr>`).join('')}</table>
 ${sum!==Math.round(r.total)?`<div class="err">品目の合計（${yen(sum)}）とレシートの合計が合いません。値引きなどを確かめてください。</div>`:''}
 ${dup?`<div class="err">同じレシート（店・日付・合計が同じ）はもう取り込み済みです。</div>`:''}
 <div class="row"><button class="sub" onclick="RC.preview=null;render()">やめる</button><button onclick="rcApply()" ${dup?'disabled':''}>家計簿に入れる</button></div></div>`}
function rcApply(){const r=RC.preview;if(!r)return;const k=rcKey(r);if(S.spend.some(x=>x.rc===k)){alert('もう取り込み済みです');return}
 rcGroups(r).forEach(([c,v])=>S.spend.push({id:uid(),date:r.date,store:r.store.slice(0,200),cat:c,amount:v,memo:'レシート',rc:k}));save();RC.preview=null;alert('家計簿に入れました');render()}
function rcImport(r){RC.preview=r;CON.open=false;location.hash='#money';render()}
{const f=V.money;V.money=function(){return rcHtml()+f.apply(this,arguments)}}
