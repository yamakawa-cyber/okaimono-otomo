'use strict';
// v29 🚚 宅配・ネットスーパー（浩二さんの地域専用。ライフハック！には入れない）。データは data/delivery.json（週1回のお店情報の見直しで更新）
let DLV=null,DLVO=null;
fetch('data/delivery.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{if(isObj(j)&&isArr(j.services)){DLV=j;dlvLinks();if(/^#(stores|list|fridge)?$/.test(location.hash||''))render()}}).catch(()=>{});
const unk=v=>isStr(v)&&v.trim()?v:'不明';
const dlvOk=s=>/^○/.test(s.covers_home||'')?'ok':/^×/.test(s.covers_home||'')?'ng':'unk';
function dlvCard(s){const st=dlvOk(s),u=(s.urls||[]).map(shopUrl).find(Boolean)||(s.urls||[]).map(safeUrl).find(Boolean),op=DLVO===s.id;
 return `<div class="card dlv ${st}"><div class="dlvh" data-dlv="${esc(s.id)}">${s.rank?`<span class="tag rk">おすすめ${s.rank}</span> `:''}<b>${esc(s.name)}</b> <span class="tag">${st==='ok'?'✅ 武庫之荘駅の近くに届く':st==='ng'?'✖ エリア外':'❓ 要確認'}</span> ${op?'▲':'▼'}</div>
 <div class="muted">送料：${esc(unk(s.fee))}</div><div class="muted">送料無料：${esc(unk(s.free_threshold))}</div>
 ${op?`<table class="dlvt">${[['最低注文',s.min_order],['届く早さ',s.cutoff_to_delivery],['支払い',s.payment],['会員',s.membership],['ほかの料金',s.other_fees],['キャンペーン',s.campaign],['届く範囲',s.covers_home],['近くのお店',(s.related_stores||[]).join('、')]].filter(([k,v])=>k!=='キャンペーン'||v).map(([k,v])=>`<tr><th>${k}</th><td>${esc(unk(v))}</td></tr>`).join('')}</table>`:`<div class="muted">最低注文：${esc(unk(s.min_order))}／届く早さ：${esc(unk(s.cutoff_to_delivery)).slice(0,60)}</div>`}
 <div class="muted">確認日：${esc(unk(s.checked_at))}</div>${u?`<div class="row"><a class="chip" target="_blank" rel="noopener" href="${esc(u)}">公式ページ</a></div>`:''}</div>`}
function dlvHtml(){if(!DLV)return '';const ok=DLV.services.filter(s=>dlvOk(s)==='ok'),un=DLV.services.filter(s=>dlvOk(s)==='unk'),ng=DLV.services.filter(s=>dlvOk(s)==='ng');
 return `<h2>🚚 宅配・ネットスーパー（武庫之荘駅の近く）</h2><div class="muted">${esc(DLV.note||'')}（確認日 ${esc(DLV.checked_at||'不明')}）。タップでくわしく。</div>
 ${ok.map(dlvCard).join('')}${un.length?`<details class="card"><summary>❓ 届くか要確認（${un.length}）</summary>${un.map(dlvCard).join('')}</details>`:''}
 ${ng.length||(DLV.not_available||[]).length?`<details class="card"><summary>✖ 使えない・エリア外</summary>${ng.map(dlvCard).join('')}${(DLV.not_available||[]).filter(x=>isObj(x)&&!ng.some(s=>s.name===x.name)).map(x=>`<div class="muted">・${esc(x.name)}：${esc(unk(x.reason))}</div>`).join('')}</details>`:''}
 ${(DLV.no_official_info||[]).length?`<details class="card"><summary>宅配の情報がないお店</summary>${DLV.no_official_info.filter(isObj).map(x=>`<div class="muted">・${esc(x.name)}：${esc(unk(x.note))}</div>`).join('')}</details>`:''}`}
// 「📦 通販で頼む」「ネットで探す」の候補に、武庫之荘駅の近くに届く宅配（おすすめ順）を足す。検索リンクがないのでトップを開く
function dlvLinks(){if(DLV.services.some(s=>s.id==='seiyu-rakuten'&&dlvOk(s)==='ng')){const i=NETS.findIndex(([l])=>l==='楽天西友ネットスーパー');if(i>=0)NETS.splice(i,1)} // 武庫之荘はエリア外
 DLV.services.filter(s=>dlvOk(s)==='ok').sort((a,b)=>(a.rank||99)-(b.rank||99)).forEach(s=>{const u=(s.urls||[]).map(shopUrl).find(Boolean);const nm=s.name.replace(/（.*?）/g,'').replace(/^おうちでイオン /,'').slice(0,16);if(u&&!NETS.some(([l])=>l===nm))NETS.push([nm,()=>u])})}
{const f=V.stores;V.stores=function(){return f.apply(this,arguments)+dlvHtml()}}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-dlv]');if(!t)return;const y=scrollY;DLVO=DLVO===t.dataset.dlv?null:t.dataset.dlv;render();scrollTo(0,y)});
