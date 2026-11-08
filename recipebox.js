// ===== v43：レシピ保管（献立の画面）。アキラちゃんの返事のレシピをボタン1つで移してためておく =====
const RBK=IS_DEMO?'okaimono_recipes_demo':'okaimono_recipes',RB_MAX=300,RBID=/^[A-Za-z0-9_-]{1,60}$/;let RBO=null;
const rbValid=r=>isObj(r)&&isStr(r.id)&&RBID.test(r.id)&&isStr(r.name)&&r.name&&isArr(r.ingredients)&&isArr(r.steps);
function rbox(){try{const a=JSON.parse(localStorage.getItem(RBK)||'[]');return isArr(a)?a.filter(rbValid):[]}catch(e){return []}}
function rboxIndex(id){return rbox().findIndex(r=>r.id===id)}
function rboxSel(index){return `<select data-rbw="${index}" aria-label="入れる曜日">${[1,2,3,4,5,6,0].map(w=>`<option value="${w}">${WD[w]}曜</option>`).join('')}</select>`}
function rboxSave(a){setLS(RBK,JSON.stringify(a.slice(0,RB_MAX)))}
const rbSig=r=>String(r.name).normalize('NFKC').replace(/\s/g,'')+'#'+(r.ingredients||[]).length+'#'+(r.steps||[]).length;
// 純粋：保管用の形にそろえる（材料は文字。手順は t・d と、あれば tip・min）
function rbNorm(rc){if(!isObj(rc)||!isStr(rc.name)||!rc.name.trim())return null;const ing=(isArr(rc.ingredients)?rc.ingredients:[]).map(x=>typeof x==='string'?x:isObj(x)?[x.name,x.qty||x.amount].filter(Boolean).join(' '):'').filter(Boolean).map(x=>String(x).slice(0,200)).slice(0,100);
 const st=(isArr(rc.steps)?rc.steps:[]).map(x=>{if(typeof x==='string')return {t:x.slice(0,200),d:''};if(!isObj(x))return null;const o={t:String(x.t||x.title||'').slice(0,200),d:String(x.d||x.detail||'').slice(0,2000)};if(isStr(x.tip)&&x.tip.trim())o.tip=x.tip.trim().slice(0,500);const mn=Number(x.min);if(Number.isFinite(mn)&&mn>0&&mn<=180)o.min=Math.round(mn);return (o.t||o.d)?o:null}).filter(Boolean).slice(0,60);
 if(!st.length)st.push({t:'作る',d:''});return {name:rc.name.trim().slice(0,200),serves:isStr(rc.serves)?rc.serves.slice(0,50):'',time:isStr(rc.time)?rc.time.slice(0,50):'',ingredients:ing,steps:st}}
function rboxAdd(rc,src){const n=rbNorm(rc);if(!n)return null;const a=rbox();const old=a.find(r=>rbSig(r)===rbSig(n));if(old)return {id:old.id,dup:true};const id='r'+uid();a.unshift(Object.assign({id,at:ymd(today()),src:src||''},n));rboxSave(a);return {id,dup:false}}
// アキラちゃん欄の「📒 献立のレシピ保管へ移す」
function rboxMove(){const r=typeof curItem==='function'?curItem():null;const rc=r&&recipeOf(r);if(!rc)return;const res=rboxAdd(rc,'アキラちゃん');if(!res)return toast('レシピを読めませんでした');
 if(!res.dup&&AT.open&&AT.open!=='demo'&&r.kind==='recipe'){saveHist(hist().filter(e=>e.id!==AT.open));AT.open=null}
 RBO=res.id;toast(res.dup?'もうレシピ保管にあります':'献立のレシピ保管へ移しました');location.hash='#fridge';render();setTimeout(()=>{const el=document.getElementById('rbox');if(el)el.scrollIntoView({block:'start'})},50)}
function rboxDel(id){const a=rbox(),k=a.findIndex(r=>r.id===id);if(k<0)return;const [g]=a.splice(k,1);rboxSave(a);if(RBO===id)RBO=null;render();undoToast(`「${g.name.slice(0,14)}」を消しました`,()=>{const b=rbox();b.splice(Math.min(k,b.length),0,g);rboxSave(b);render()})}
function rboxToMenu(id){const k=rboxIndex(id),r=rbox()[k];if(!r)return;const sel=document.querySelector(`select[data-rbw="${k}"]`);const w=sel?+sel.value:NaN;if(!Number.isInteger(w)||w<0||w>6)return;const cur=String(menuArr()[w]||'').trim();
 if(dishesOf(w).includes(r.name))return toast('もう'+WD[w]+'曜の献立に入っています');setMenu(w,cur?cur+'・'+r.name:r.name);render();toast(`${WD[w]}曜の献立に「${r.name.slice(0,14)}」を入れました`)}
function rboxLesson(id){const r=rbox().find(x=>x.id===id);if(!r)return;dishLesson('box:'+id+'|'+r.name)}
function rboxHtml(){const a=rbox();
 return `<h2 id="rbox">📒 レシピ保管 <span class="muted">${a.length}件</span></h2>${a.length?a.map((r,k)=>{const op=RBO===r.id;return `<div class="card rbcard${op?' on':''}"><button class="rbhead" data-rb="toggle" data-k="${k}" aria-expanded="${op}">🥘 ${esc(r.name)} <span class="muted">${esc([r.serves,r.time].filter(Boolean).join('・'))}</span> ${op?'▲':'▼'}</button>
 ${op?`<div class="muted">保管した日 ${esc(r.at||'')}${r.src?'・'+esc(r.src)+'から':''}</div><b>材料</b><ul>${r.ingredients.map(x=>`<li>${iconOf(x)?iconOf(x)+' ':''}${esc(x)}</li>`).join('')||'<li class="muted">なし</li>'}</ul><b>作り方</b><ol>${r.steps.map(s=>`<li><b>${esc(s.t)}</b>${s.d?' '+esc(s.d):''}</li>`).join('')}</ol>
 <div class="row">${rboxSel(k)}<button data-rb="menu" data-k="${k}">📅 献立に使う</button></div>
 <div class="row"><button class="sub" data-rb="lesson" data-k="${k}">👩‍🍳 料理レッスン</button><button class="sub" data-rb="del" data-k="${k}">🗑 消す</button></div>`:''}</div>`}).join(''):'<div class="card muted">まだありません。アキラちゃん欄でレシピを開いて「📒 献立のレシピ保管へ移す」を押すと、ここにたまります。</div>'}`}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button[data-rb]');if(!b)return;const k=Number(b.dataset.k);if(!Number.isInteger(k)||!rbox()[k])return;const id=rbox()[k].id;switch(b.dataset.rb){case 'toggle':RBO=RBO===id?null:id;render();break;case 'menu':rboxToMenu(id);break;case 'lesson':rboxLesson(id);break;case 'del':rboxDel(id);break}});
// 献立の画面のいちばん下に足す
{const f=V.fridge;V.fridge=function(){return f.apply(this,arguments)+rboxHtml()}}
function normRbox(v){const out=[],ids=new Set();if(!isArr(v))return out;v.forEach(r=>{if(!isObj(r)||!isStr(r.id)||!RBID.test(r.id)||ids.has(r.id))return;const n=rbNorm(r);if(n){ids.add(r.id);out.push(Object.assign({id:r.id,at:isDate(r.at)?r.at:'',src:isStr(r.src)?r.src.slice(0,50):''},n))}});return out}
BKX.recipes={get:()=>rbox(),check:v=>isArr(v),set:v=>{if(isArr(v))rboxSave(normRbox(v))}};
// ===== v46：オリジナルレシピ（献立の画面の「出前」「通販」の下）。材料や「こんな料理が食べたい」を書いてアキラちゃんに頼む =====
const ORK=IS_DEMO?'okaimono_orig_demo':'okaimono_orig';
let ORG={open:false,q:'',fridge:true,msg:'',ok:true,sending:false};
function orgSt(){try{const o=JSON.parse(localStorage.getItem(ORK)||'{}');return isObj(o)?o:{}}catch(e){return {}}}
function orgSave(o){setLS(ORK,JSON.stringify(o))}
// 純粋：依頼の文面（受け取り側がレシピの依頼だと分かるように見出しを付ける）
function orgQuestion(wish,useFridge){return `【オリジナルレシピの依頼】\n${wish}\n\nこの内容に沿ったオリジナルレシピを1つ考えてください。${useFridge?'冷蔵庫と保存棚にある物（data.fridge）をできるだけ使ってください。':'冷蔵庫の中身は気にしなくて大丈夫です。'}\n返事は kind:"recipe"（name・serves・time・ingredients［分量つきの文字］・steps［{t,d}］）でお願いします。\n${kitchenNote()}`}
async function orgSend(){if(IS_DEMO||ORG.sending)return;const e=document.getElementById('org_q');if(e)ORG.q=e.value;const wish=String(ORG.q||'').trim().slice(0,1500);
 if(!wish){ORG.msg='材料や、食べたい料理のイメージを書いてね';ORG.ok=false;return render()}
 const s=secret();if(!s.url||!s.key){ORG.msg='アキラちゃんへの送り先がまだ設定されていません。⚙️設定の「アキラちゃんに相談」で送り先と合言葉を入れてください。';ORG.ok=false;return render()}
 const keep={type:CON.type,q:CON.q,inc:CON.inc,stage:CON.stage,retry:CON.retry,status:CON.status,ok:CON.ok};
 CON.type='recipe';CON.q=orgQuestion(wish,ORG.fridge);CON.inc={fridge:!!ORG.fridge,list:false,spend:'off',memo:false};CON.orig={kind:'original-recipe',wish,useFridge:!!ORG.fridge};CON.retry=null;CON.status='';
 ORG.sending=true;ORG.msg='送信中…';ORG.ok=true;render();
 try{await sendConsult()}finally{const id=CON.reqId,inP=!!id&&pending().some(x=>x.id===id),okSend=CON.ok&&inP,maybe=!CON.ok&&inP;
  ORG.sending=false;if(okSend||maybe){orgSave({id,wish,at:Date.now(),fridge:!!ORG.fridge});ORG.q='';ORG.msg=maybe?'アキラちゃん側の応答が遅れています。届いていれば、このあと返事が出ます。':'';ORG.ok=true}else{ORG.msg=(CON.status||'送れませんでした')+'（書いた内容は残してあります。電波や設定を確かめて、もう一度送ってください）';ORG.ok=false}
  CON.orig=null;Object.assign(CON,keep);render()}}
function orgReply(){const st=orgSt();if(!st.id||typeof INBOX==='undefined')return null;return INBOX.find(e=>e.id===st.id&&!e.err&&e.item&&(e.item.kind==='recipe'||(e.item.kind==='menu'&&e.item.recipe)))||null}
function orgRecipe(){const e=orgReply();return e?(e.item.kind==='recipe'?e.item:e.item.recipe):null}
function orgKeep(useW){const e=orgReply(),rc=orgRecipe();if(!rc)return;const res=rboxAdd(rc,'オリジナルレシピ');if(!res)return toast('レシピを読めませんでした');
 if(useW){const sel=document.getElementById('org_w');RBO=res.id;setTimeout(()=>{},0);const w=sel?+sel.value:1;const r=rbox().find(x=>x.id===res.id);if(r&&!dishesOf(w).includes(r.name)){const cur=String(menuArr()[w]||'').trim();setMenu(w,cur?cur+'・'+r.name:r.name)}toast(`レシピ保管に入れて、${WD[w]}曜の献立に使いました`)}else toast(res.dup?'もうレシピ保管にあります':'レシピ保管に入れました');
 orgSave({});dropInbox([e.key]);RBO=res.id;render()}
function orgDone(){const e=orgReply();orgSave({});if(e)dropInbox([e.key]);render()}
function orgHtml(){const st=orgSt(),rc=orgRecipe(),waiting=st.id&&!rc,mins=waiting?Math.floor((Date.now()-(st.at||0))/60000):0;
 let h=`<div class="row"><button class="${ORG.open||rc||waiting?'on':'sub'} orgbtn" onclick="ORG.open=!ORG.open;render()" aria-expanded="${ORG.open}">🍳 オリジナルレシピ</button></div>`;
 if(rc){return h+`<div class="card orgbox"><b>✨ アキラちゃんのオリジナルレシピ：${esc(rc.name)}</b> <span class="muted">${esc([rc.serves,rc.time].filter(Boolean).join('・'))}</span>
 <div class="muted">頼んだ内容：${esc(st.wish||'')}</div><b>材料</b><ul>${(rc.ingredients||[]).map(x=>{const t=typeof x==='string'?x:[x&&x.name,x&&(x.qty||x.amount)].filter(Boolean).join(' ');return `<li>${iconOf(t)?iconOf(t)+' ':''}${esc(t)}</li>`}).join('')}</ul>
 <b>作り方</b><ol>${(rc.steps||[]).map(s=>typeof s==='string'?`<li>${esc(s)}</li>`:`<li><b>${esc(s.t||'')}</b>${s.d?' '+esc(s.d):''}</li>`).join('')}</ol>
 <div class="row"><button onclick="orgKeep(false)">📒 レシピ保管に入れる</button></div>
 <div class="row"><select id="org_w" aria-label="使う曜日">${[1,2,3,4,5,6,0].map(w=>`<option value="${w}">${WD[w]}曜</option>`).join('')}</select><button class="sub" onclick="orgKeep(true)">📅 保管して献立に使う</button></div>
 <div class="row"><button class="sub" onclick="orgDone()">とじる（保管しない）</button></div></div>`}
 if(waiting)h+=`<div class="card orgbox tip"><div class="orgwait">🍳 アキラちゃんがレシピを考え中…<span class="dots"></span></div><div class="muted">頼んだ内容：${esc(st.wish||'')}（${mins<1?'いま':mins+'分前'}に送信）</div>
 ${mins>=30?`<div class="err">まだ返事が届いていません。アキラちゃんが手を離せないのかもしれません。下のボタンで確かめるか、しばらくしてからまた開いてみてください（返事は7日間とっておけます）。</div>`:'<div class="muted">返事が届くと、ここにレシピが出ます（アプリを開いたときに自動で確かめます）。</div>'}
 <div class="row"><button class="sub" onclick="fetchReplies(true).then(render)">📩 返事を確かめる</button><button class="sub" onclick="if(confirm('待つのをやめますか？（あとで届いた返事は「📩 返事」に出ます）')){orgSave({});render()}">待つのをやめる</button></div>${INBOX_ST?`<div class="muted">${esc(INBOX_ST)}</div>`:''}</div>`;
 if(ORG.open&&!waiting)h+=`<div class="card orgbox"><label for="org_q"><b>どんな料理にする？</b></label><textarea id="org_q" rows="4" maxlength="1500" style="width:100%" placeholder="例：ごぼうとにんじんを使いたい／あったかい汁物が食べたい／子どもが喜ぶ甘めの味" oninput="ORG.q=this.value">${esc(ORG.q)}</textarea>
 <label class="chk1"><input type="checkbox" ${ORG.fridge?'checked':''} onchange="ORG.fridge=this.checked"> <span>🧊 冷蔵庫と保存棚の中身（${S.fridge.length}品）を参考にしてもらう</span></label>
 <div class="row"><button onclick="orgSend()" ${ORG.sending?'disabled':''}>${ORG.sending?'送信中…':'✨ アキラちゃんにレシピを頼む'}</button></div>
 ${ORG.msg?`<div class="${ORG.ok?'muted':'err'}">${esc(ORG.msg)}</div>`:''}<div class="muted">書いた内容${ORG.fridge?'と冷蔵庫の中身':''}だけを送ります（家計・買い物リストは送りません）。</div></div>`;
 else if(ORG.msg&&!waiting)h+=`<div class="${ORG.ok?'muted':'err'}">${esc(ORG.msg)}</div>`;
 return h}
