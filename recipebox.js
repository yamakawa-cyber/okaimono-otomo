// ===== v43：レシピ保管（献立の画面）。アキラちゃんの返事のレシピをボタン1つで移してためておく =====
const RBK=IS_DEMO?'okaimono_recipes_demo':'okaimono_recipes',RB_MAX=300;let RBO=null;
function rbox(){try{const a=JSON.parse(localStorage.getItem(RBK)||'[]');return isArr(a)?a.filter(r=>isObj(r)&&isStr(r.id)&&isStr(r.name)&&r.name&&isArr(r.ingredients)&&isArr(r.steps)):[]}catch(e){return []}}
function rboxSave(a){setLS(RBK,JSON.stringify(a.slice(0,RB_MAX)))}
const rbSig=r=>String(r.name).normalize('NFKC').replace(/\s/g,'')+'#'+(r.ingredients||[]).length+'#'+(r.steps||[]).length;
// 純粋：保管用の形にそろえる（材料は文字に、手順は {t,d} のまま）
function rbNorm(rc){if(!isObj(rc)||!isStr(rc.name)||!rc.name.trim())return null;const ing=(isArr(rc.ingredients)?rc.ingredients:[]).map(x=>typeof x==='string'?x:isObj(x)?[x.name,x.qty||x.amount].filter(Boolean).join(' '):'').filter(Boolean).map(x=>String(x).slice(0,200)).slice(0,100);
 const st=(isArr(rc.steps)?rc.steps:[]).map(x=>typeof x==='string'?{t:x.slice(0,200),d:''}:isObj(x)?{t:String(x.t||x.title||'').slice(0,200),d:String(x.d||x.detail||'').slice(0,2000)}:null).filter(x=>x&&(x.t||x.d)).slice(0,60);
 if(!st.length)st.push({t:'作る',d:''});return {name:rc.name.trim().slice(0,200),serves:isStr(rc.serves)?rc.serves.slice(0,50):'',time:isStr(rc.time)?rc.time.slice(0,50):'',ingredients:ing,steps:st}}
function rboxAdd(rc,src){const n=rbNorm(rc);if(!n)return null;const a=rbox();const old=a.find(r=>rbSig(r)===rbSig(n));if(old)return {id:old.id,dup:true};const id='r'+uid();a.unshift(Object.assign({id,at:ymd(today()),src:src||''},n));rboxSave(a);return {id,dup:false}}
// アキラちゃん欄の「📒 献立のレシピ保管へ移す」
function rboxMove(){const r=typeof curItem==='function'?curItem():null;const rc=r&&recipeOf(r);if(!rc)return;const res=rboxAdd(rc,'アキラちゃん');if(!res)return toast('レシピを読めませんでした');
 if(!res.dup&&AT.open&&AT.open!=='demo'&&r.kind==='recipe'){saveHist(hist().filter(e=>e.id!==AT.open));AT.open=null}
 RBO=res.id;toast(res.dup?'もうレシピ保管にあります':'献立のレシピ保管へ移しました');location.hash='#fridge';render();setTimeout(()=>{const el=document.getElementById('rbox');if(el)el.scrollIntoView({block:'start'})},50)}
function rboxDel(id){const a=rbox(),k=a.findIndex(r=>r.id===id);if(k<0)return;const [g]=a.splice(k,1);rboxSave(a);if(RBO===id)RBO=null;render();undoToast(`「${g.name.slice(0,14)}」を消しました`,()=>{const b=rbox();b.splice(Math.min(k,b.length),0,g);rboxSave(b);render()})}
function rboxToMenu(id){const r=rbox().find(x=>x.id===id);if(!r)return;const w=+val('rb_w_'+id);if(!Number.isInteger(w)||w<0||w>6)return;const cur=String(menuArr()[w]||'').trim();
 if(dishesOf(w).includes(r.name))return toast('もう'+WD[w]+'曜の献立に入っています');setMenu(w,cur?cur+'・'+r.name:r.name);render();toast(`${WD[w]}曜の献立に「${r.name.slice(0,14)}」を入れました`)}
function rboxLesson(id){const r=rbox().find(x=>x.id===id);if(!r)return;dishLesson('box:'+id+'|'+r.name)}
function rboxHtml(){const a=rbox();const ws=[1,2,3,4,5,6,0];
 return `<h2 id="rbox">📒 レシピ保管 <span class="muted">${a.length}件</span></h2>${a.length?a.map(r=>{const op=RBO===r.id;return `<div class="card rbcard${op?' on':''}"><button class="rbhead" onclick="RBO=RBO==='${r.id}'?null:'${r.id}';render()" aria-expanded="${op}">🥘 ${esc(r.name)} <span class="muted">${esc([r.serves,r.time].filter(Boolean).join('・'))}</span> ${op?'▲':'▼'}</button>
 ${op?`<div class="muted">保管した日 ${esc(r.at||'')}${r.src?'・'+esc(r.src)+'から':''}</div><b>材料</b><ul>${r.ingredients.map(x=>`<li>${iconOf(x)?iconOf(x)+' ':''}${esc(x)}</li>`).join('')||'<li class="muted">なし</li>'}</ul><b>作り方</b><ol>${r.steps.map(s=>`<li><b>${esc(s.t)}</b>${s.d?' '+esc(s.d):''}</li>`).join('')}</ol>
 <div class="row"><select id="rb_w_${r.id}" aria-label="入れる曜日">${ws.map(w=>`<option value="${w}">${WD[w]}曜</option>`).join('')}</select><button onclick="rboxToMenu('${r.id}')">📅 献立に使う</button></div>
 <div class="row"><button class="sub" onclick="rboxLesson('${r.id}')">👩‍🍳 料理レッスン</button><button class="sub" onclick="rboxDel('${r.id}')">🗑 消す</button></div>`:''}</div>`}).join(''):'<div class="card muted">まだありません。アキラちゃん欄でレシピを開いて「📒 献立のレシピ保管へ移す」を押すと、ここにたまります。</div>'}`}
// 献立の画面のいちばん下に足す
{const f=V.fridge;V.fridge=function(){return f.apply(this,arguments)+rboxHtml()}}
BKX.recipes={get:()=>rbox(),check:v=>isArr(v),set:v=>{if(!isArr(v))return;const a=rbox(),ids=new Set(a.map(r=>r.id));v.forEach(r=>{if(isObj(r)&&isStr(r.id)&&!ids.has(r.id)){const n=rbNorm(r);if(n)a.push(Object.assign({id:r.id.slice(0,60),at:isDate(r.at)?r.at:'',src:isStr(r.src)?r.src.slice(0,50):''},n))}});rboxSave(a)}};
