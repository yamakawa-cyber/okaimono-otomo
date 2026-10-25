'use strict';
// 「アキラちゃんに相談」：受け取りURLへ JSON をPOSTする。送信キーは localStorage の別キーだけに保存（バックアップに含めない）。
const SK='okaimono_secret';
const CTYPES=[['menu','献立・作り置き'],['lesson','レシピレッスン'],['shop','買い物リスト'],['money','節約アドバイス'],['hacks','ライフハック'],['advise','やりたいこと相談'],['recipe','レシピ'],['receipt','レシート読み取り'],['chat','雑談']];
const MAXBYTES=100000;
function secret(){try{const j=JSON.parse(localStorage.getItem(SK)||'{}');return {url:isStr(j.url)?j.url:'',key:isStr(j.key)?j.key:'',header:isStr(j.header)?j.header:'Authorization'}}catch(e){return {url:'',key:'',header:'Authorization'}}}
function saveSecret(x){localStorage.setItem(SK,JSON.stringify(x))}
function okConsultUrl(u){try{const x=new URL(u);if(x.protocol==='https:')return true;return x.protocol==='http:'&&/^(localhost|127\.0\.0\.1)$/.test(x.hostname)}catch(e){return false}} // 試験用にlocalhostのみhttp可
function setConsult(field,v,el){const s=secret();v=String(v).trim();
 if(field==='url'){if(v&&!okConsultUrl(v)){if(el)el.value=s.url;alert('受け取りURLは https:// で始まるものだけ使えます');return}s.url=v}
 if(field==='key'){if(v.length>1000){if(el)el.value='';alert('キーが長すぎます');return}s.key=v}
 if(field==='header'){if(!/^[A-Za-z0-9-]{1,64}$/.test(v)){alert('ヘッダ名は英数字とハイフンだけです');return}s.header=v}
 saveSecret(s);render()}
const mask=k=>k?'●'.repeat(Math.min(8,k.length))+k.slice(-4):'未設定';
function consultSettingsHtml(){const s=secret();return `<h2>アキラちゃんに相談</h2><div class="card">
 相談の受け取りURL（https）<input id="c_url" value="${esc(s.url)}" placeholder="https://…" style="width:100%" onchange="setConsult('url',this.value,this)">
 送信キー（いま：${esc(mask(s.key))}）<input id="c_key" type="password" autocomplete="off" placeholder="貼り付けると上書き" style="width:100%" onchange="setConsult('key',this.value,this)">
 キーを付けるヘッダ<select id="c_hdr" onchange="setConsult('header',this.value)">${['Authorization','X-Api-Key','X-Webhook-Secret','X-App-Pass'].map(h=>`<option${h===s.header?' selected':''}>${h}</option>`).join('')}</select>
 <div class="muted">Authorization の場合は「Bearer キー」の形で送ります。中継サーバー（Cloudflare Workers）を使うときは X-App-Pass を選び、キーの欄には中継用の合言葉を入れます。キーはこのスマホの中だけに保存し、バックアップには入れません。</div>
 <div class="row"><button class="sub" onclick="if(confirm('受け取りURLと送信キーを消しますか？')){localStorage.removeItem(SK);render()}">消す</button></div></div>`}
let CON={open:false,type:'menu',status:'',stage:'form',inc:{fridge:true,list:true,spend:'sum',memo:false}};
function consultBtn(def){return `<div class="row"><button class="consult" data-act="consult" data-type="${esc(def)}">💬 アキラちゃんに相談</button></div>${CON.open&&CON.from===location.hash?consultPanel():''}`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act=consult]');if(!b)return;CON.open=!(CON.open&&CON.from===location.hash);CON.from=location.hash;CON.type=b.dataset.type;CON.status='';CON.stage='form';render()});
const st=()=>CON.status?`<div class="${CON.ok?'tip':'err'}">${esc(CON.status)}</div>`:'';
function consultPanel(){const s=secret();
 if(IS_DEMO)return `<div class="card sample">🧪 見本モードでは相談を送りません。</div>`;
 if(!s.url||!s.key)return `<div class="card tip">送信先がまだ設定されていません。<a class="link" href="#settings">設定で「相談の受け取りURL」と「送信キー」を入れる →</a></div>`;
 if(CON.stage==='confirm')return confirmPanel();
 return `<div class="card consultbox"><select id="c_type">${CTYPES.map(([k,l])=>`<option value="${k}"${k===CON.type?' selected':''}>${l}</option>`).join('')}</select>
 <textarea id="c_q" rows="3" style="width:100%" placeholder="相談したいこと">${esc(CON.q||'')}</textarea>
 ${rcPickHtml()}
 <div class="row"><button onclick="toConfirm()" ${CON.sending?'disabled':''}>送る</button><button class="sub" onclick="CON.code=!CON.code;render()">取り込みコードを貼る</button></div>
 ${CON.code?`<textarea id="c_code" rows="4" style="width:100%" placeholder="アキラちゃんから届いた取り込みコード（JSON）"></textarea><div class="row"><button class="sub" onclick="importCode()">取り込む</button></div>`:''}
 ${st()}<div class="muted">送る前に、送る内容を確認できます。</div>${pending().length&&relayBase()?`<div class="row"><button class="sub" onclick="fetchReplies(true)">📩 返事を確かめる（待ち${pending().length}件）</button></div>`:''}</div>`}
function toConfirm(){let q=val('c_q');CON.type=val('c_type')||CON.type;if(!q&&RC.imgs.length)q=CON.type==='receipt'?'レシートの写真です。読み取って receipt の形で返してください。':'写真を見て相談にのってください。';if(!q){alert('相談したいことを書いてください');return}if(CON.type==='receipt'&&!RC.imgs.length){alert('レシートの写真を選んでください');return}CON.q=q;CON.stage='confirm';CON.status='';render()}
function setInc(k,v){CON.inc[k]=v;render()}
function confirmPanel(){let pl;try{pl=consultPayload(CON.type,CON.q)}catch(e){pl=null;CON.status=e.message;CON.ok=false}
 const d=pl?JSON.parse(pl.body).data:{},i=CON.inc,cb=(k,l)=>`<label class="chk1"><input type="checkbox" ${i[k]?'checked':''} onchange="setInc('${k}',this.checked)"> ${l}</label>`;
 const ex=(a,f)=>a&&a.length?a.slice(0,3).map(f).map(esc).join('、')+(a.length>3?' ほか':''):'なし';
 return `<div class="card consultbox"><b>送る内容の確認</b>
 <div class="muted">種類：${esc((CTYPES.find(x=>x[0]===CON.type)||[])[1]||'')}／相談：${esc(CON.q)}</div>${RC.imgs.length?`<div>📷 写真 ${RC.imgs.length}枚</div>${rcThumbs(false)}`:''}
 ${cb('fridge',`冷蔵庫（${i.fridge?S.fridge.length+'件':'送らない'}）`)}<div class="muted">見本：${(i.fridge?ex(d.fridge,f=>f.name):'送らない')}</div>
 ${cb('list',`買い物リスト（${i.list?S.list.length+'件':'送らない'}）`)}<div class="muted">見本：${(i.list?ex(d.list,x=>x.name):'送らない')}</div>
 <div>家計（今月${i.spend==='off'?'・送らない':i.spend==='sum'?'・'+(d.spendingCount||0)+'件を集計':'・'+((d.spending||[]).length)+'件'}）：<select onchange="setInc('spend',this.value)">${[['sum','費目別の集計だけ'],['detail','明細も送る'],['off','送らない']].map(([k,l])=>`<option value="${k}"${i.spend===k?' selected':''}>${l}</option>`).join('')}</select></div>
 <div class="muted">見本：${i.spend==='sum'?ex(Object.entries(d.spendingByCat||{}),([k,v])=>k+' '+yen(v)):i.spend==='detail'?ex(d.spending,r=>md(r.date)+' '+yen(r.amount)+(r.memo?' '+r.memo:'')):'送らない'}</div>
 ${cb('memo','メモ（品名以外の書き込み）も含める')}
 <div class="muted">設定（地域・買い物日・予算）は毎回送ります。約${pl?Math.ceil(new Blob([pl.body]).size/1024):'?'}KB${pl&&pl.dropped?`（古い家計記録${pl.dropped}件は省きます）`:''}</div>
 <div class="row"><button class="sub" onclick="CON.stage='form';render()">もどる</button><button onclick="sendConsult()" ${CON.sending||!pl?'disabled':''}>${CON.sending?'送信中…':'この内容で送信'}</button></div>${st()}</div>`}
function consultPayload(type,q){const mo=ymd(today()).slice(0,7),i=CON.inc;
 const strip=o=>{const x={...o};if(!i.memo)delete x.memo;return x};
 const month=S.spend.filter(r=>isObj(r)&&isStr(r.date)&&r.date.startsWith(mo)).sort((a,b)=>a.date.localeCompare(b.date));
 const data={settings:{region:S.settings.region,shopDays:S.settings.shopDays,perTrip:S.settings.perTrip,monthly:S.settings.monthly}};
 if(i.fridge)data.fridge=S.fridge.map(f=>({name:f.name,until:f.until||''}));
 if(i.list)data.list=S.list.map(x=>strip({name:x.name,qty:x.qty,store:x.store,done:!!x.done,memo:x.memo}));
 if(i.spend!=='off'){const by={};month.forEach(r=>by[r.cat||'その他']=(by[r.cat||'その他']||0)+Number(r.amount||0));data.spendingByCat=by;data.spendingCount=month.length}
 if(i.spend==='detail')data.spending=month.map(r=>strip({date:r.date,store:r.store,cat:r.cat,amount:r.amount,memo:r.memo}));
 const p={app:'okaimono',id:CON.reqId||'',type,question:q,sentAt:new Date().toISOString(),data};
 if(CON.type==='receipt')data.categories=CATS.map(c=>c[0]);
 let body=JSON.stringify(p),dropped=0;const size=t=>new Blob([t]).size;
 while(size(body)>MAXBYTES&&p.data.spending&&p.data.spending.length){p.data.spending.shift();dropped++;p.data.spendingOmitted=dropped;body=JSON.stringify(p)}
 if(size(body)>MAXBYTES)throw new Error('送るデータが大きすぎます（冷蔵庫や買い物リストを減らすか、送るものを減らしてください）');
 if(RC.imgs.length){p.data.images=RC.imgs.slice(0,RC_MAX_IMGS);body=JSON.stringify(p);if(size(body)>MAXBYTES+RC_MAXBYTES)throw new Error('写真が大きすぎます。枚数を減らしてください')}
 return {body,dropped}}
async function sendConsult(){const s=secret();if(IS_DEMO||CON.sending)return;if(!s.url||!s.key){CON.status='送信先が未設定です';CON.ok=false;return render()}
 if(!CTYPES.some(([k])=>k===CON.type)||!CON.q)return;
 if(!navigator.onLine){CON.status='いまオフラインなので送れません。電波のあるところで、もう一度送ってください。';CON.ok=false;return render()}
 CON.reqId='c'+uid();let pl;try{pl=consultPayload(CON.type,CON.q)}catch(e){CON.status=e.message;CON.ok=false;return render()}
 const h={'Content-Type':'application/json'};h[s.header]=s.header==='Authorization'?'Bearer '+s.key:s.key;
 CON.sending=true;CON.status='送信中…（番号 '+CON.reqId+'）';CON.ok=true;render();
 try{const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),RC.imgs.length?40000:15000);
  const r=await fetch(s.url,{method:'POST',headers:h,body:pl.body,signal:ctl.signal});clearTimeout(tm);
  if(!r.ok){let m='';try{const jj=await r.json();if(jj&&typeof jj.message==='string')m=jj.message.slice(0,200)}catch(_){}throw new Error(r.status===429?(m||'きょうの相談の上限に達しました。日本時間の0時を過ぎたら、また送れます。'):'受け取り側のエラー（'+r.status+'）'+(m?'：'+m:''))}
  addPending(CON.reqId,CON.type);RC.imgs=[];CON.status='送りました！（番号 '+CON.reqId+'）返事が届くと、この画面の上に「📩 返事」が出ます。'+(pl.dropped?`（古い家計記録${pl.dropped}件は省きました）`:'');CON.ok=true;CON.q='';CON.stage='form'}
 catch(e){CON.ok=false;CON.status=e.name==='AbortError'?'時間切れになりました（番号 '+CON.reqId+'）。受け取り側には届いている可能性があります。続けて送り直す前に、届いたか確かめてください。'
  :/Failed to fetch|NetworkError|Load failed/i.test(e.message)?'送れませんでした：受け取り先につながりませんでした。URLの間違い、受け取り側が止まっている、または受け取り側がブラウザからの送信を許可していない（CORSの設定）可能性があります。CORSの場合は、設定の「中継サーバー」の方法を使ってください。':'送れませんでした：'+e.message}
 finally{CON.sending=false;render()}}
function importCode(){const t=val('c_code');if(!t)return;try{let r;try{r=JSON.parse(t)}catch(e){throw new Error('JSONではありません')}checkAI(r);
 const hid=histAdd(r,'code');if(r.kind==='receipt'){CON.code=false;return rcImport([r])}AT.open=hid;AT.lesson=null;CON.code=false;CON.open=false;location.hash='#ai';render()}
 catch(e){CON.status='取り込めませんでした：'+e.message;CON.ok=false;render()}}
// 各タブに相談ボタンを差し込む
for(const [tab,t] of [['home','menu'],['fridge','menu'],['list','shop'],['money','money'],['ai','advise']]){const f=V[tab];V[tab]=function(){return consultBtn(t)+f.apply(this,arguments)}}
{const f=V.settings;V.settings=function(){return f.apply(this,arguments).replace('<h2>バックアップ</h2>',consultSettingsHtml()+'<h2>バックアップ</h2>')}}
