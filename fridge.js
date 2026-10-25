'use strict';
// v26 仮想冷蔵庫：棚ごとの在庫表示・手で編集（元に戻すあり）・写真の読み取り（kind:"fridge"）を確認してから取り込む
const ZONES=['冷蔵室','チルド','ドアポケット','野菜室','冷凍室'];
const ZICON={'冷蔵室':'🧊','チルド':'🥩','ドアポケット':'🚪','野菜室':'🥬','冷凍室':'❄️'};
const EMO=[[/卵|玉子|たまご/,'🥚'],[/牛乳|ミルク|豆乳/,'🥛'],[/ヨーグルト/,'🍶'],[/チーズ/,'🧀'],[/バター|マーガリン/,'🧈'],[/豚|牛|鶏|ひき肉|肉|ハム|ベーコン|ウインナー|ソーセージ/,'🥩'],[/魚|鮭|さけ|サバ|さば|ぶり|まぐろ|刺身|しらす|えび|海老|いか/,'🐟'],[/豆腐|納豆|厚揚げ|油揚げ/,'🫘'],[/にんじん|人参/,'🥕'],[/キャベツ|レタス|白菜|ほうれん草|小松菜|ねぎ|ネギ|ブロッコリー|水菜|もやし/,'🥬'],[/トマト/,'🍅'],[/きゅうり|胡瓜/,'🥒'],[/なす|茄子/,'🍆'],[/玉ねぎ|たまねぎ|玉葱/,'🧅'],[/じゃがいも|芋|いも/,'🥔'],[/ピーマン|パプリカ/,'🫑'],[/きのこ|しめじ|えのき|しいたけ|まいたけ/,'🍄'],[/りんご|リンゴ/,'🍎'],[/バナナ/,'🍌'],[/みかん|オレンジ/,'🍊'],[/いちご|苺/,'🍓'],[/ぶどう|葡萄/,'🍇'],[/レモン/,'🍋'],[/ジュース|お茶|麦茶|水|ドリンク|コーラ/,'🧃'],[/ビール|酒|ワイン/,'🍺'],[/ケチャップ|マヨ|ソース|醤油|しょうゆ|味噌|みそ|ドレッシング|ポン酢|たれ|タレ|ジャム|調味料|わさび|からし|生姜|にんにく/,'🧂'],[/アイス/,'🍨'],[/ご飯|ごはん|米/,'🍚'],[/パン/,'🍞'],[/餃子|ぎょうざ|冷凍/,'🥟'],[/ケーキ|プリン|ゼリー|デザート/,'🍮'],[/漬物|キムチ|梅干/,'🫙']];
const emoOf=n=>{for(const [r,e] of EMO)if(r.test(n))return e;return '🍱'};
const zoneOk=z=>ZONES.includes(z);
let FR={sel:null,rev:null};
function frItems(){return S.fridge.map(f=>Object.assign({},f,{zone:zoneOk(f.zone)?f.zone:'冷蔵室'}))}
function frChip(f){const soon=isDate(f.until)&&f.until<=ymd(addDays(today(),2));const on=FR.sel===f.id;return `<button class="frchip${on?' on':''}${soon||/期限|近い|早め/.test(f.note||'')?' soon':''}" data-fr="${esc(f.id)}" aria-pressed="${on}">${emoOf(f.name)} ${esc(f.name)}${f.amt?`<small>${esc(f.amt)}</small>`:''}${soon?'<small>⚠️'+(isDate(f.until)?md(f.until):'')+'</small>':''}</button>`}
function frZone(z,L){const its=L.filter(f=>f.zone===z);return `<div class="fz fz-${ZONES.indexOf(z)}"><div class="fzt">${ZICON[z]} ${z}<span class="muted"> ${its.length}</span></div><div class="fzc">${its.map(frChip).join('')||'<span class="muted fzempty">からっぽ</span>'}</div></div>`}
function frSelHtml(){const f=S.fridge.find(x=>x.id===FR.sel);if(!f)return '';const z=zoneOk(f.zone)?f.zone:'冷蔵室';
 return `<div class="card frsel"><b>${emoOf(f.name)} ${esc(f.name)}</b> <span class="muted">${esc(z)}${f.amt?'・'+esc(f.amt):''}${isDate(f.until)?'・期限 '+md(f.until):''}${f.note?'・'+esc(f.note):''}</span>
 <div class="muted">ほかの場所へうつす</div><div class="frmv">${ZONES.filter(x=>x!==z).map(x=>`<button class="sub" data-frmv="${x}">${ZICON[x]} ${x}</button>`).join('')}</div>
 <div class="row"><input id="fr_amt" value="${esc(f.amt||'')}" placeholder="量（例：半分・2個）" aria-label="量"><button class="sub" onclick="frSetAmt()">量を変える</button></div>
 <div class="row"><button class="sub" onclick="frToList()">🛒 →買い物リスト</button><button class="sub" onclick="frDel()">✕ 消す（使い切った）</button><button class="sub" onclick="FR.sel=null;render()">とじる</button></div></div>`}
function frView(){const L=frItems();if(FR.rev)return frReviewHtml();
 return `<h2>🧊 冷蔵庫の中（${WD[S.settings.fridgeDay]}曜に点検）</h2>
 <div class="fridge"><div class="fbody"><div class="fmain">${frZone('冷蔵室',L)}${frZone('チルド',L)}</div><div class="fdoor">${frZone('ドアポケット',L)}</div></div>${frZone('野菜室',L)}${frZone('冷凍室',L)}</div>
 <div class="muted">品物をタップすると、場所の移動・量・リストへ・消すができます。⚠️は期限が近いもの。</div>${frSelHtml()}
 <div class="card"><b>手で入れる</b><div class="row"><input id="fr_name" placeholder="品名"><input id="fr_amt2" placeholder="量" style="flex:0 0 80px"></div>
 <div class="row"><select id="fr_zone">${ZONES.map(z=>`<option>${z}</option>`).join('')}</select><input id="fr_until" type="date" lang="ja" aria-label="期限"></div><div class="row"><button onclick="addFr()">冷蔵庫に入れる</button></div></div>
 <div class="card"><div class="row"><button onclick="frPhoto()">📷 冷蔵庫の写真をアキラちゃんに読んでもらう</button></div>
 <div class="row"><button class="sub" onclick="frMenu()">🍳 この中身で献立を相談</button><button class="sub" onclick="frMissing()">🛒 足りない物をリストに</button></div>
 <div class="muted">「足りない物」は、よく買う品のうち冷蔵庫にも買い物リストにも無いものです。</div></div>`}
function addFr(){const n=val('fr_name').trim().slice(0,200);if(!n)return toast('品名を入れてね');const f={id:uid(),name:n,until:val('fr_until'),zone:val('fr_zone')||'冷蔵室'};const a=val('fr_amt2').trim().slice(0,50);if(a)f.amt=a;S.fridge.push(f);save();render();toast(`${emoOf(n)} ${n.slice(0,14)} を入れました`)}
document.addEventListener('click',e=>{const c=e.target.closest&&e.target.closest('[data-fr]');if(c){FR.sel=FR.sel===c.dataset.fr?null:c.dataset.fr;const y=scrollY;render();scrollTo(0,y);const s=document.querySelector('.frsel');if(s)s.scrollIntoView({block:'nearest'});return}
 const m=e.target.closest&&e.target.closest('[data-frmv]');if(m){const f=S.fridge.find(x=>x.id===FR.sel);if(!f)return;const old=f.zone;f.zone=m.dataset.frmv;save();const y=scrollY;render();scrollTo(0,y);undo1(`${f.name.slice(0,12)} を${f.zone}へうつしました`,()=>{f.zone=old;save();render()})}});
function frSetAmt(){const f=S.fridge.find(x=>x.id===FR.sel);if(!f)return;const a=val('fr_amt').trim().slice(0,50);if(a)f.amt=a;else delete f.amt;save();render()}
function frDel(){const k=S.fridge.findIndex(x=>x.id===FR.sel);if(k<0)return;const [g]=S.fridge.splice(k,1);FR.sel=null;save();const y=scrollY;render();scrollTo(0,y);undoToast(`「${g.name.slice(0,14)}」を消しました`,()=>{S.fridge.splice(Math.min(k,S.fridge.length),0,g);save();render()})}
function frToList(){const f=S.fridge.find(x=>x.id===FR.sel);if(!f)return;S.list.push({name:f.name,store:'',trip:curTrip(today()).wd,done:false});save();toast('買い物リストに入れました')}
function frHas(n){const b=s=>normDish(baseName(s));const m=b(n);return x=>{const y=b(x);return y&&m&&(y===m||y.includes(m)||m.includes(y))}}
function frMissing(){const miss=oft().filter(o=>{const h=frHas(o.name);return !S.fridge.some(f=>h(f.name))&&!S.list.some(i=>!i.done&&h(i.name))});if(!miss.length)return toast('足りない物はありません（よく買う品はそろっています）');
 const add=miss.map(o=>{const it={name:o.name,qty:o.qty||'',store:'',trip:curTrip(today()).wd,done:false};if(o.cat)it.cat=o.cat;if(o.price)it.price=o.price;return it});S.list.push(...add);save();render();
 undo1(`${add.length}品をリストに入れました（${add.slice(0,3).map(i=>i.name).join('、')}${add.length>3?'…':''}）`,()=>{S.list=S.list.filter(i=>!add.includes(i));save();render()},add.length)}
function frMenu(){CON.open=true;CON.from=location.hash;CON.type='menu';CON.stage='form';CON.status='';CON.q='冷蔵庫の中身（場所・量つき）を見て、使い切れる献立を考えて。期限が近いものから先に使ってね。足りない材料があれば買い物リストの形でも教えて。';render();scrollTo(0,0)}
function frPhoto(){CON.open=true;CON.from=location.hash;CON.type='fridge';CON.stage='form';CON.status='';CON.q='冷蔵庫の写真です。中身を読み取って fridge の形で返してください。';render();scrollTo(0,0);const f=document.getElementById('rc_file');if(f&&secret().url)f.click()}
// --- 読み取り結果の確認画面 ---
AISHAPE.fridge=r=>isArr(r.items)&&r.items.length>0&&r.items.length<=200&&r.items.every(i=>isObj(i)&&isStr(i.name)&&i.name.length>0&&i.name.length<=200&&(i.zone===undefined||isStr(i.zone))&&(i.amount===undefined||isStr(i.amount))&&(i.note===undefined||isStr(i.note))&&(i.until===undefined||i.until===''||isDate(i.until)));
if(typeof KLABEL==='object')KLABEL.fridge='🧊 冷蔵庫';
function frReview(r,key){FR.rev={key,mode:'merge',items:r.items.map(i=>({on:true,name:i.name.slice(0,200),zone:zoneOk(i.zone)?i.zone:'冷蔵室',amt:String(i.amount||'').slice(0,50),note:String(i.note||'').slice(0,100),until:isDate(i.until)?i.until:''}))};FR.sel=null;CON.open=false;location.hash='#fridge';render();scrollTo(0,0)}
function frReviewHtml(){const R=FR.rev,n=R.items.filter(i=>i.on).length;return `<h2>🧊 冷蔵庫の読み取り結果を確認</h2><div class="card"><div class="muted">チェックを外した物は入れません。場所はここで直せます。</div>
 <ul class="chk frrev">${R.items.map((i,k)=>`<li><label class="lrow"><input type="checkbox" ${i.on?'checked':''} onchange="FR.rev.items[${k}].on=this.checked;render()"><span style="flex:1">${emoOf(i.name)} ${esc(i.name)}${i.amt?` <span class="muted">${esc(i.amt)}</span>`:''}${i.note?` <span class="tag">${esc(i.note)}</span>`:''}</span></label><select aria-label="場所" onchange="FR.rev.items[${k}].zone=this.value">${ZONES.map(z=>`<option${z===i.zone?' selected':''}>${z}</option>`).join('')}</select></li>`).join('')}</ul>
 <label class="chk1"><input type="radio" name="frm" ${R.mode==='merge'?'checked':''} onchange="FR.rev.mode='merge'"> いまの中身に足す（同じ名前は上書き）</label>
 <label class="chk1"><input type="radio" name="frm" ${R.mode==='replace'?'checked':''} onchange="FR.rev.mode='replace'"> いまの中身を全部入れかえる</label>
 <div class="row"><button class="sub" onclick="frRevDrop()">入れない</button><button onclick="frRevApply()" ${n?'':'disabled'}>冷蔵庫に入れる（${n}品）</button></div></div>`}
function frRevDrop(){const k=FR.rev&&FR.rev.key;FR.rev=null;if(k)dropInbox([k]);else render()}
function frRevApply(){const R=FR.rev;if(!R)return;const prev=S.fridge.map(f=>Object.assign({},f));const add=R.items.filter(i=>i.on).map(i=>{const f={id:uid(),name:i.name,until:i.until,zone:i.zone};if(i.amt)f.amt=i.amt;if(i.note)f.note=i.note;return f});
 if(R.mode==='replace')S.fridge=add;else add.forEach(f=>{const o=S.fridge.find(x=>x.name===f.name);if(o){Object.assign(o,f,{id:o.id,until:f.until||o.until})}else S.fridge.push(f)});
 FR.rev=null;save();if(R.key)dropInbox([R.key]);else render();scrollTo(0,0);undo1(`冷蔵庫に${add.length}品入れました`,()=>{S.fridge=prev;save();render()},add.length)}
{const f=openReply;openReply=function(key){const e=INBOX.find(x=>x.key===key);if(e&&!e.err&&e.item.kind==='fridge')return frReview(e.item,key);return f(key)}}
{const f=rcImport;rcImport=function(arr){if(arr.length===1&&arr[0].kind==='fridge')return frReview(arr[0],null);return f(arr)}}
