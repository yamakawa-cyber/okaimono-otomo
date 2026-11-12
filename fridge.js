'use strict';
// v26 仮想冷蔵庫：棚ごとの在庫表示・手で編集（元に戻すあり）・写真の読み取り（kind:"fridge"）を確認してから取り込む
const ZONES=['冷蔵室','チルド','ドアポケット','野菜室','冷凍室','保存棚1','保存棚2','保存棚3','倉庫'];const SHELVES=['保存棚1','保存棚2','保存棚3']; // v42：保存棚（常温の棚）を3つ
const ZICON={'冷蔵室':'🧊','チルド':'🥩','ドアポケット':'🚪','野菜室':'🥬','冷凍室':'❄️','保存棚1':'🪵','保存棚2':'🪵','保存棚3':'🪵','倉庫':'📦'};
const EMO=[[/卵|玉子|たまご/,'🥚'],[/牛乳|ミルク|豆乳/,'🥛'],[/ヨーグルト/,'🍶'],[/チーズ/,'🧀'],[/バター|マーガリン/,'🧈'],[/豚|牛|鶏|ひき肉|肉|ハム|ベーコン|ウインナー|ソーセージ/,'🥩'],[/魚|鮭|さけ|サバ|さば|ぶり|まぐろ|刺身|しらす|えび|海老|いか/,'🐟'],[/豆腐|納豆|厚揚げ|油揚げ/,'🫘'],[/にんじん|人参/,'🥕'],[/キャベツ|レタス|白菜|ほうれん草|小松菜|ねぎ|ネギ|ブロッコリー|水菜|もやし/,'🥬'],[/トマト/,'🍅'],[/きゅうり|胡瓜/,'🥒'],[/なす|茄子/,'🍆'],[/玉ねぎ|たまねぎ|玉葱/,'🧅'],[/じゃがいも|芋|いも/,'🥔'],[/ピーマン|パプリカ/,'🫑'],[/きのこ|しめじ|えのき|しいたけ|まいたけ/,'🍄'],[/りんご|リンゴ/,'🍎'],[/バナナ/,'🍌'],[/みかん|オレンジ/,'🍊'],[/いちご|苺/,'🍓'],[/ぶどう|葡萄/,'🍇'],[/レモン/,'🍋'],[/ジュース|お茶|麦茶|水|ドリンク|コーラ/,'🧃'],[/ビール|酒|ワイン/,'🍺'],[/ケチャップ|マヨ|ソース|醤油|しょうゆ|味噌|みそ|ドレッシング|ポン酢|たれ|タレ|ジャム|調味料|わさび|からし|生姜|にんにく/,'🧂'],[/アイス/,'🍨'],[/ご飯|ごはん|米/,'🍚'],[/パン/,'🍞'],[/餃子|ぎょうざ|冷凍/,'🥟'],[/ケーキ|プリン|ゼリー|デザート/,'🍮'],[/漬物|キムチ|梅干/,'🫙']];
const emoOf=n=>{const v=iconOf(n,null);if(v)return v;for(const [r,e] of EMO)if(r.test(n))return e;return '🍱'}; // v41：まず種類別、だめなら従来
const zoneOk=z=>ZONES.includes(z);
let FR={sel:null,rev:null};
function frItems(){return S.fridge.map(f=>Object.assign({},f,{zone:zoneOk(f.zone)?f.zone:'冷蔵室'}))}
function frChip(f){const soon=isDate(f.until)&&f.until<=ymd(addDays(today(),2));const on=FR.sel===f.id;return `<button class="frchip${on?' on':''}${soon||/期限|近い|早め/.test(f.note||'')?' soon':''}" data-fr="${esc(f.id)}" aria-pressed="${on}">${emoOf(f.name)} ${esc(f.name)}${f.amt?`<small>${esc(f.amt)}</small>`:''}${soon?'<small>⚠️'+(isDate(f.until)?md(f.until):'')+(f.est?'目安':'')+'</small>':''}</button>`}
function frZone(z,L){const its=L.filter(f=>f.zone===z);return `<div class="fz fz-${ZONES.indexOf(z)}${SHELVES.includes(z)?' shelf':''}"><div class="fzt">${ZICON[z]} ${z}<span class="muted"> ${its.length}</span></div><div class="fzc">${its.map(frChip).join('')||'<span class="muted fzempty">からっぽ</span>'}</div></div>`}
function frSelHtml(){const f=S.fridge.find(x=>x.id===FR.sel);if(!f)return '';const z=zoneOk(f.zone)?f.zone:'冷蔵室';
 return `<div class="card frsel"><b>${emoOf(f.name)} ${esc(f.name)}</b> <span class="muted">${esc(z)}${f.amt?'・'+esc(f.amt):''}${isDate(f.until)?'・期限'+(f.est?'の目安':'')+' '+md(f.until):''}${f.note?'・'+esc(f.note):''}</span>
 <div class="muted">ほかの場所へうつす</div><div class="frmv">${ZONES.filter(x=>x!==z).map(x=>`<button class="sub" data-frmv="${x}">${ZICON[x]} ${x}</button>`).join('')}</div>
 <div class="row"><input id="fr_amt" value="${esc(f.amt||'')}" placeholder="量（例：半分・2個）" aria-label="量"><button class="sub" onclick="frSetAmt()">量を変える</button></div>
 <div class="muted">量の一部だけうつす</div><div class="row"><input id="fr_part" placeholder="うつす量（例：1個）" aria-label="うつす量" style="flex:0 0 140px"><select id="fr_pz" aria-label="うつす先">${ZONES.filter(x=>x!==z).map(x=>`<option>${x}</option>`).join('')}</select><button class="sub" onclick="frPart(val('fr_pz'))">一部をうつす</button></div>
 <div class="row"><button class="sub" onclick="frToList()">🛒 →買い物リスト</button><button class="sub" onclick="frDel()">${z===WH?'✕ 倉庫から消す':'✕ 消す（使い切った）'}</button><button class="sub" onclick="FR.sel=null;render()">とじる</button></div></div>`}
function frView(){const L=frItems();if(FR.wh)return whReviewHtml();if(FR.rev)return frReviewHtml();if(FR.chk)return chkView(L);
 return `${CON.open&&CON.from===location.hash?consultPanel():''}<div class="row frtop"><button onclick="frMenu()">🍳 この中身で献立を相談</button></div>
 <div class="card"><b>手で入れる</b><div class="row"><input id="fr_name" placeholder="品名"><input id="fr_amt2" placeholder="量" style="flex:0 0 80px"></div>
 <div class="row"><select id="fr_zone" aria-label="しまう場所">${ZONES.map(z=>`<option>${z}</option>`).join('')}</select><input id="fr_until" type="date" lang="ja" aria-label="期限"></div><div class="row"><button onclick="addFr()">しまう</button></div></div>
 <div class="row chkopen"><button onclick="chkOpen()">✅ 冷蔵庫点検（まとめて消す）</button></div>
${whView(L)}
 <h2>🧊 冷蔵庫と保存棚（${WD[S.settings.fridgeDay]}曜に点検）</h2>
 <div class="fridge">${frZone('冷蔵室',L)}${frZone('チルド',L)}${frZone('野菜室',L)}${frZone('冷凍室',L)}</div><div class="fdoorbar">${frZone('ドアポケット',L)}</div>
 <h2>🪵 保存棚</h2><div class="shelves">${SHELVES.map(z=>frZone(z,L)).join('')}</div>
 <div class="muted">品物をタップすると、場所の移動・量・リストへ・消すができます。⚠️は期限が近いもの。</div>${(()=>{const f=S.fridge.find(x=>x.id===FR.sel);return(f&&f.zone===WH)?'':frSelHtml()})()}
 <div class="card"><div class="row"><button onclick="frPhoto()">📷 冷蔵庫の写真をアキラちゃんに読んでもらう</button></div>
 <div class="row"><button class="sub" onclick="frMissing()">🛒 足りない物をリストに</button></div>
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
function frMenu(){CON.open=true;CON.from=location.hash;CON.type='menu';CON.stage='form';CON.status='';CON.q='冷蔵庫の中身（場所・量つき）を見て、使い切れる献立を考えて。期限が近いものから先に使ってね。足りない材料があれば買い物リストの形でも教えて。\n'+kitchenNote();render();scrollTo(0,0)}
function frPhoto(){CON.open=true;CON.from=location.hash;CON.type='fridge';CON.stage='form';CON.status='';CON.q='冷蔵庫の写真です。中身を読み取って fridge の形で返してください。';render();scrollTo(0,0);const f=document.getElementById('rc_file');if(f&&secret().url)f.click()}
// --- 読み取り結果の確認画面 ---
AISHAPE.fridge=r=>isArr(r.items)&&r.items.length>0&&r.items.length<=200&&r.items.every(i=>isObj(i)&&isStr(i.name)&&i.name.length>0&&i.name.length<=200&&(i.zone===undefined||isStr(i.zone))&&(i.amount===undefined||isStr(i.amount))&&(i.note===undefined||isStr(i.note))&&(i.until===undefined||i.until===''||isDate(i.until)));
if(typeof KLABEL==='object')KLABEL.fridge='🧊 冷蔵庫';
function frReview(r,key){FR.rev={key,mode:'merge',items:r.items.map(i=>({on:true,name:i.name.slice(0,200),zone:zoneOk(i.zone)?i.zone:'冷蔵室',amt:String(i.amount||'').slice(0,50),note:String(i.note||'').slice(0,100),until:isDate(i.until)?i.until:''}))};FR.sel=null;CON.open=false;location.hash='#stock';render();scrollTo(0,0)}
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

// --- v48 📦 倉庫：レシートの食材をいったん倉庫へ → ここから冷蔵庫・冷凍室・保存棚へ振り分け ---
const WH='倉庫',FOODCAT=['食材','おやつ・飲み物','惣菜'],NOFOOD_CAT=['日用品','雑費','たばこ','酒','子ども'];
// v53：ガソリン・洗車・たばこ・酒・日用品などは倉庫に出さない（AIが食材と付けても除外）
const NOFOOD_NM=/ガソリン|レギュラー(?!コーヒー)|ハイオク|軽油|灯油|燃料|給油|洗車|カーウォッシュ|駐車場|駐車料|通行料|有料道路|\bETC\b|たばこ|タバコ|煙草|ビール|日本酒|焼酎|酎ハイ|チューハイ|ワイン|ウイスキー|洗剤|柔軟剤|トイレットペーパー|ティッシュ|おむつ|電池/;
const NOFOOD_STORE=/ENEOS|エネオス|出光|コスモ石油|コスモSS|シェル|Shell|JOMO|キグナス|宇佐美|アポロステーション|apollostation|ガソリンスタンド|洗車/;
const isFood=i=>{const nm=String(i.std||'')+' '+String(i.name||'');if(NOFOOD_NM.test(nm))return false;const c=i.category!==undefined?rcCat(i.category):'';if(c&&NOFOOD_CAT.includes(c))return false;if(i.type)return i.type==='食材';return FOODCAT.includes(c)}; // 古い形は費目で判断
const hasWhFood=r=>isArr(r&&r.items)&&!NOFOOD_STORE.test(String(r.store||''))&&r.items.some(isFood)
const whSet=()=>{if(!isArr(S.whrc))S.whrc=[];return S.whrc};
const whDone=r=>whSet().includes(rcKey(r));
let WHS=new Set(); // 倉庫で選んだ品
function whOpen(r){if(!hasWhFood(r))return alert('このレシートには倉庫に入れる食材がありません（食材以外は倉庫に出ません）');const rc=rcKey(r);const its=r.items.filter(i=>isFood(i)&&Math.round(i.price)>=0&&!/値引|割引|クーポン/.test(i.name));
 if(!its.length)return alert('このレシートには倉庫に入れる食材が見つかりませんでした');
 FR.wh={rc,dup:whDone(r),store:String(r.store).slice(0,40),date:r.date,items:its.map(i=>{const n=String(i.std||i.name).slice(0,200),d=Number.isInteger(i.days)&&isDate(r.date)?ymd(addDays(new Date(r.date+'T12:00'),i.days)):'';const same=S.fridge.some(f=>f.name===n);return {on:true,name:n,raw:i.std&&i.std!==i.name?String(i.name).slice(0,60):'',sug:zoneOk(i.zone)&&i.zone!==WH?i.zone:'',until:d,amt:isStr(i.qty)?i.qty.slice(0,50):'',same,how:'add'}})};
 FR.sel=null;CON.open=false;location.hash='#stock';render();scrollTo(0,0)}
function whReviewHtml(){const R=FR.wh,n=R.items.filter(i=>i.on).length,all=R.items.length>0&&n===R.items.length;
 return `<h2>📦 倉庫に入れる食材を確認</h2><div class="card wh"><div class="muted">${esc(R.store)}（${md(R.date)}）・食材のみ。外した物は入れない。期限は目安。</div>
 ${R.dup?'<div class="err">このレシートはもう倉庫に入れています。もう一度入れると二重になります。</div>':''}
 <div class="row"><button class="sub" onclick="whRevAll()">${all?'ぜんぶ外す':'ぜんぶ選ぶ'}</button></div>
 <ul class="chk frrev whlist">${R.items.map((i,k)=>`<li><label class="lrow"><input type="checkbox" ${i.on?'checked':''} onchange="FR.wh.items[${k}].on=this.checked;render()"><span class="whnm">${emoOf(i.name)} ${esc(i.name)}${i.raw?` <span class="muted">（${esc(i.raw)}）</span>`:''}${i.amt?` <span class="muted">${esc(i.amt)}</span>`:''}</span></label>${i.sug?`<span class="tag">おすすめ：${esc(i.sug)}</span>`:''}${i.until?`<span class="tag">期限 ${md(i.until)}</span>`:''}${i.same?`<select aria-label="同じ名前の品" onchange="FR.wh.items[${k}].how=this.value"><option value="add"${i.how==='add'?' selected':''}>同名あり：足す</option><option value="over"${i.how==='over'?' selected':''}>同名あり：上書き</option></select>`:''}</li>`).join('')}</ul>
 <div class="row"><button class="sub" onclick="FR.wh=null;render()">入れない</button><button onclick="whApply()" ${n?'':'disabled'}>${R.dup?'それでも':''}📦 倉庫に入れる（${n}品）</button></div></div>`}
function whRevAll(){const R=FR.wh;if(!R)return;const all=R.items.length>0&&R.items.every(i=>i.on);R.items.forEach(i=>i.on=!all);render()}
function whApply(){const R=FR.wh;if(!R)return;const prev=S.fridge.map(f=>Object.assign({},f)),prevRc=whSet().slice();let n=0;
 R.items.filter(i=>i.on).forEach(i=>{const f={id:uid(),name:i.name,until:i.until,zone:WH,kind:'食材',rc:R.rc};if(i.until)f.est=true;if(i.amt)f.amt=i.amt;if(i.sug)f.sug=i.sug;
  const o=i.how==='over'&&S.fridge.find(x=>x.name===i.name);if(o)Object.assign(o,f,{id:o.id});else S.fridge.push(f);n++});
 if(!whSet().includes(R.rc))S.whrc.push(R.rc);if(S.whrc.length>1000)S.whrc=S.whrc.slice(-1000);
 FR.wh=null;save();render();scrollTo(0,0);undo1(`📦 倉庫に${n}品入れました`,()=>{S.fridge=prev;S.whrc=prevRc;save();render()},n)}
document.addEventListener('change',e=>{const c=e.target.closest&&e.target.closest('input[data-whid]');if(!c)return;const id=c.dataset.whid;if(c.checked)WHS.add(id);else WHS.delete(id);render()});
// 倉庫の一覧：複数えらんで移動・おすすめどおり移動
function whView(L){const its=L.filter(f=>f.zone===WH);if(!its.length)return '';[...WHS].forEach(id=>{if(!its.some(f=>f.id===id))WHS.delete(id)});
 const all=its.length>0&&its.every(f=>WHS.has(f.id)),n=WHS.size,selWh=!!(FR.sel&&its.some(f=>f.id===FR.sel));
 return `<h2>📦 倉庫 <span class="muted">${its.length}品</span></h2><div class="card wh"><div class="muted">チェックして好きな場所へうつす／消す。品名タップで1品ずつ・一部移動も可。</div>
 <ul class="chk whlist">${its.map(f=>`<li><label class="lrow"><input type="checkbox" ${WHS.has(f.id)?'checked':''} data-whid="${esc(f.id)}"></label>${frChip(f)}${f.sug?`<span class="tag">おすすめ：${esc(f.sug)}</span>`:''}</li>`).join('')}</ul>
 <div class="row"><button class="sub" onclick="its_all()">${all?'ぜんぶ外す':'ぜんぶ選ぶ'}</button><button class="sub" onclick="whDel()" ${n?'':'disabled'}>✕ 倉庫から消す${n?`（${n}品）`:''}</button></div>
 <div class="muted">${n?`選んだ${n}品を好きな場所へうつす`:'下のボタンで好きな場所へ（先にチェック）'}</div>
 <div class="frmv">${ZONES.filter(x=>x!==WH).map(x=>`<button class="sub" onclick="whMove('${x}')" ${n?'':'disabled'}>${ZICON[x]} ${x}</button>`).join('')}</div>
 <div class="row"><button class="sub" onclick="whSug()">おすすめの場所へうつす（任意・${n||its.filter(f=>f.sug).length}品）</button></div>
 ${selWh?frSelHtml():''}</div>`}
function its_all(){const its=S.fridge.filter(f=>f.zone===WH);if(its.length&&its.every(f=>WHS.has(f.id)))WHS.clear();else its.forEach(f=>WHS.add(f.id));render()}
function whMove(z){if(!WHS.size)return;const prev=S.fridge.map(f=>Object.assign({},f));let n=0;S.fridge.forEach(f=>{if(f.zone===WH&&WHS.has(f.id)){f.zone=z;n++}});if(FR.sel&&WHS.has(FR.sel))FR.sel=null;WHS.clear();save();render();undo1(`${n}品を${z}へうつしました`,()=>{S.fridge=prev;save();render()},n)}
function whDel(){if(!WHS.size)return;const n=WHS.size;if(!confirm(`選んだ${n}品を倉庫から消しますか？（あとで元に戻せます）`))return;const prev=S.fridge.map(f=>Object.assign({},f));S.fridge=S.fridge.filter(f=>!(f.zone===WH&&WHS.has(f.id)));if(FR.sel&&WHS.has(FR.sel))FR.sel=null;WHS.clear();save();render();undo1(`${n}品を倉庫から消しました`,()=>{S.fridge=prev;save();render()},n)}
function whSug(){const prev=S.fridge.map(f=>Object.assign({},f));let n=0;S.fridge.forEach(f=>{if(f.zone===WH&&f.sug&&(!WHS.size||WHS.has(f.id))){f.zone=f.sug;n++}});if(!n)return toast('おすすめの場所がついた品がありません');WHS.clear();save();render();undo1(`${n}品をおすすめの場所へうつしました`,()=>{S.fridge=prev;save();render()},n)}
// 量の一部だけうつす（例：「4個」のうち「1個」→ 残り「3個」）
function frPart(z){const f=S.fridge.find(x=>x.id===FR.sel);if(!f)return;const p=val('fr_part').trim().slice(0,50);if(!p)return toast('うつす量を入れてね');
 const a=String(f.amt||'').match(/^(\d+(?:\.\d+)?)(.*)$/),b=p.match(/^(\d+(?:\.\d+)?)(.*)$/);let rest;
 if(a&&b&&a[2].trim()===b[2].trim()){const r=+a[1]-+b[1];if(r<=0)return toast('今ある量より少なく入れてね（ぜんぶなら上の場所ボタン）');rest=(Math.round(r*100)/100)+a[2]}
 else{rest=prompt(`残る量を入れてね（いま：${f.amt||'量なし'}）`,'');if(rest===null)return;rest=rest.trim().slice(0,50)}
 const prev=S.fridge.map(x=>Object.assign({},x));const g=Object.assign({},f,{id:uid(),zone:z,amt:p});if(rest)f.amt=rest;else delete f.amt;S.fridge.push(g);save();render();undo1(`${f.name.slice(0,12)} を${p}だけ${z}へうつしました`,()=>{S.fridge=prev;save();render()})}

// v66 冷蔵庫点検：場所ごとに並べ、タップで複数選択（色と枠で表示・チェックボックスなし）→ まとめて消す
function chkOpen(){FR.chk=new Set();FR.sel=null;CON.open=false;render();scrollTo(0,0)}
function chkClose(){FR.chk=null;render();scrollTo(0,0)}
function chkView(L){const C=FR.chk;[...C].forEach(id=>{if(!L.some(f=>f.id===id))C.delete(id)});const n=C.size,all=L.length>0&&L.every(f=>C.has(f.id));
 const grp=z=>{const its=L.filter(f=>f.zone===z);if(!its.length)return '';const k=its.filter(f=>C.has(f.id)).length,za=k===its.length;
  return `<div class="ckz"><div class="ckzh"><b>${ZICON[z]} ${esc(z)}</b><span class="muted">${k?k+'／':''}${its.length}品</span><button class="sub ckall" data-ckz="${esc(z)}" aria-label="${esc(z)}を${za?'ぜんぶ外す':'ぜんぶ選ぶ'}">${za?'ぜんぶ外す':'ぜんぶ選ぶ'}</button></div>
  <div class="ckc">${its.map(f=>{const on=C.has(f.id);return `<button class="ckit${on?' on':''}" data-ck="${esc(f.id)}" aria-pressed="${on}"><span class="ckm" aria-hidden="true">${on?'✓':''}</span>${emoOf(f.name)} ${esc(f.name)}${f.amt?`<small>${esc(f.amt)}</small>`:''}</button>`}).join('')}</div></div>`};
 return `<h2>✅ 冷蔵庫点検</h2><div class="card ckhelp muted">食べた・使った物をタップして選んでね（もう一度タップで外す）。選んだ物は色が変わります。</div>
 <div class="ckbar" role="region" aria-label="点検の操作"><div class="ckcount" aria-live="polite">${n?`<b>${n}品</b> 選んでいます`:'まだ選んでいません'}</div>
 <div class="row"><button class="sub" onclick="chkAll()">${all?'ぜんぶ外す':'ぜんぶ選ぶ'}</button><button class="ckdel" onclick="chkDel()" ${n?'':'disabled'}>🗑 まとめて消す（食べた・使った）${n?`（${n}品）`:''}</button></div>
 <div class="row"><button class="sub" onclick="chkClose()">やめる（変えずにもどる）</button></div></div>
 ${L.length?ZONES.map(grp).join(''):'<div class="card muted">冷蔵庫も保存棚もからっぽです。</div>'}`}
function chkKeep(f){const y=scrollY;f();render();scrollTo(0,y)}
function chkAll(){const C=FR.chk;if(!C)return;const L=frItems();chkKeep(()=>{if(L.length&&L.every(f=>C.has(f.id)))C.clear();else L.forEach(f=>C.add(f.id))})}
function chkDel(){const C=FR.chk;if(!C||!C.size)return;const g=S.fridge.filter(f=>C.has(f.id));if(!g.length)return;
 const nm=g.slice(0,5).map(f=>f.name.slice(0,12)).join('、')+(g.length>5?` ほか${g.length-5}品`:'');
 if(!confirm(`食べた・使った物として${g.length}品を消しますか？\n${nm}\n（消したあと「元に戻す」もできます）`))return;
 const prev=S.fridge.map(f=>Object.assign({},f));S.fridge=S.fridge.filter(f=>!C.has(f.id));g.forEach(f=>WHS.delete(f.id));if(FR.sel&&C.has(FR.sel))FR.sel=null;FR.chk=null;save();render();scrollTo(0,0);
 undo1(`${g.length}品を消しました（食べた・使った）`,()=>{S.fridge=prev;save();render()},g.length)}
document.addEventListener('click',e=>{if(!FR.chk)return;const b=e.target.closest&&e.target.closest('[data-ck],[data-ckz]');if(!b)return;const C=FR.chk;
 if(b.dataset.ck!==undefined){const id=b.dataset.ck;chkKeep(()=>{if(C.has(id))C.delete(id);else C.add(id)});return}
 const z=b.dataset.ckz,its=frItems().filter(f=>f.zone===z);chkKeep(()=>{if(its.every(f=>C.has(f.id)))its.forEach(f=>C.delete(f.id));else its.forEach(f=>C.add(f.id))})});
window.addEventListener('hashchange',()=>{if(FR.chk&&location.hash!=='#stock')FR.chk=null});
