'use strict';
// v27 ネットで探す・出前・3つ比べる（安い／豪華／ベター）・アキラちゃんに注文を頼む。
// 支払いはかならず浩二さんが自分の手で。アキラちゃんはカートに入れて決済の直前まで進めるだけ。形は docs/比較と注文の形.md
const SHOP_AI=true,ORDER_OK=true; // ライフハック！では port.py が false にする
const OK_='okaimono_orders';
const enc=encodeURIComponent;
const NETS=[['Amazon',q=>'https://www.amazon.co.jp/s?k='+enc(q)],['楽天市場',q=>'https://search.rakuten.co.jp/search/mall/'+enc(q)+'/'],['イオンネットスーパー',q=>'https://shop.aeon.com/netsuper/search/?q='+enc(q)],['楽天西友ネットスーパー',q=>'https://netsuper.rakuten.co.jp/seiyu/search/?keyword='+enc(q)]];
const DELIS=[['Uber Eats',q=>'https://www.ubereats.com/jp/search?q='+enc(q)],['出前館',()=>'https://demae-can.com/'],['menu',()=>'https://menu.jp/']];
const RANKS=[['cheap','安い','💴'],['better','ベター','👍'],['luxury','豪華','✨']];
let NS=null,NSF=false; // 開いている「ネットで探す」の品名
function orders(){try{const a=JSON.parse(localStorage.getItem(OK_)||'[]');return isArr(a)?a.filter(o=>isObj(o)&&isStr(o.id)):[]}catch(e){return []}}
function saveOrders(a){localStorage.setItem(OK_,JSON.stringify(a.slice(-30)))}
// アプリが持っている値段（特売・レシート・リストの金額）
function knownPrices(name){const n=normDish(baseName(name));if(!n)return [];const hit=x=>{const m=normDish(baseName(String(x||'')));return m&&(m===n||m.includes(n)||n.includes(m))};const out=[];
 try{hist().forEach(e=>{const r=e.item;if(r.kind==='receipt')(r.items||[]).forEach(i=>{if(hit(i.name)&&Number.isFinite(i.price))out.push({src:'レシート',store:r.store,price:i.price,date:r.date})})})}catch(e){}
 S.list.forEach(i=>{if(hit(i.name)&&(i.price||i.yen))out.push({src:'買い物リスト',store:i.store||'',price:+(i.price||i.yen),date:''})});
 try{regStores().forEach(s=>saleText(s).forEach(t=>{if(t.includes(n))out.push({src:'特売',store:s.name,text:t})}))}catch(e){}
 return out.slice(-6)}
function knownHtml(name){const k=knownPrices(name);return k.length?`<div class="muted">📒 アプリの記録：${k.map(x=>esc(x.store+' '+(x.text||yen(x.price))+(x.date?'（'+md(x.date)+' '+x.src+'）':'（'+x.src+'）'))).join('／')}</div>`:''}
function netBtn(name){return `<button class="sub nsb" data-ns="${esc(baseName(name)||name)}" aria-label="ネットで探す">🔎</button>`}
function openAll(list,q){list.forEach(([,f])=>window.open(f(q),'_blank','noopener'))}
function netMenu(name,qty){const q=baseName(name)||name;return `<div class="card nsbox"><b>🔎 ネットで探す：${esc(q)}</b>
 <div class="nslinks">${NETS.map(([l,f])=>`<a class="chip" target="_blank" rel="noopener" href="${esc(f(q))}">${esc(l)}</a>`).join('')}</div>${knownHtml(q)}
 ${SHOP_AI?`<div class="row"><input id="cp_amt" placeholder="量（例：1L×2）" value="${esc(qty||'')}"><input id="cp_cond" placeholder="条件（銘柄など）"></div><div class="row"><input id="cp_bud" type="number" inputmode="numeric" placeholder="予算（円・なくてもOK）"></div>
 <div class="row"><button data-cmp="goods" data-n="${esc(q)}">⚖️ 安い・ベター・豪華の3つを比べてもらう</button></div>`:`<div class="row"><button class="sub" data-openall="goods" data-n="${esc(q)}">比較用のリンクをまとめて開く</button></div>`}
 ${ORDER_OK?`<div class="row"><button class="sub" data-ord="${esc(q)}">🛍 アキラちゃんに注文を頼む</button></div>`:''}${ORDER_OK?payNote():''}</div>`}
const payNote=()=>`<div class="muted">※アキラちゃんはカートに入れて決済の直前まで進めるだけです。支払いは浩二さんご自身でお願いします。</div>`;
function deliRow(dish){return `<div class="row"><button class="sub" data-deli="${esc(dish)}">🛵 出前にする</button></div>${NS==='🛵'+dish?deliMenu(dish):''}`}
function deliMenu(dish){return `<div class="card nsbox"><b>🛵 出前：${esc(dish)}</b><div class="nslinks">${DELIS.map(([l,f])=>`<a class="chip" target="_blank" rel="noopener" href="${esc(f(dish))}">${esc(l)}</a>`).join('')}</div><div class="muted">出前館・menu はトップを開きます（料理名での検索リンクがないため）。</div>
 ${SHOP_AI?`<div class="row"><input id="cp_bud" type="number" inputmode="numeric" placeholder="予算（円・なくてもOK）"><button data-cmp="delivery" data-n="${esc(dish)}">⚖️ 3つ比べてもらう</button></div>`:`<div class="row"><button class="sub" data-openall="delivery" data-n="${esc(dish)}">比較用のリンクをまとめて開く</button></div>`}
 ${ORDER_OK?`<div class="row"><button class="sub" data-ord="${esc(dish)}" data-mode="delivery">🛍 アキラちゃんに注文を頼む</button></div>${payNote()}`:''}</div>`}
function goConsult(type,q,extra){CON.open=true;CON.from=location.hash;CON.type=type;CON.q=q;CON.extra=extra;CON.inc={fridge:false,list:false,spend:'off',memo:false};CON.incType=type;CON.stage='confirm';CON.status='';render();scrollTo(0,0)}
function askCompare(mode,name){const amount=val('cp_amt'),conditions=val('cp_cond'),b=+val('cp_bud');const budget=Number.isFinite(b)&&b>0?b:null;
 goConsult('compare',mode==='delivery'?`「${name}」の出前を、安い・ベター・豪華の3つで比べて。配達料と届く目安も。`:`「${name}」${amount?'（'+amount+'）':''}を、安い・ベター・豪華の3つで比べて。送料こみの実質価格も。`,
  {compare:{mode,name,amount,conditions,budget,area:'兵庫県尼崎市 武庫之荘',known:knownPrices(name).map(x=>({source:x.src,store:x.store,price:x.price||null,text:x.text||'',date:x.date||''}))}})}
function askOrder(items,mode){if(!ORDER_OK)return;const id='o'+uid();items=items.slice(0,30);
 goConsult('order',`注文の準備をお願い：${items.map(i=>i.name+(i.qty?' '+i.qty:'')).join('、')}。カートに入れて決済の直前まで。支払いは自分でします。`,{order:{orderId:id,mode,items,payment:'self'}})}
function onSent(type,extra){if(type==='order'&&extra&&extra.order){const a=orders();a.push({id:extra.order.orderId,at:new Date().toISOString(),items:extra.order.items,mode:extra.order.mode});saveOrders(a)}}
// 返事 kind:"order"（状況）を探す
function orderState(id){let s=null;try{hist().forEach(e=>{if(e.item.kind==='order'&&e.item.orderId===id){if(!s||e.at>=s.at)s={at:e.at,r:e.item}}})}catch(e){}return s&&s.r}
const OST={requested:'依頼中',cart:'カート投入済み・決済待ち',done:'完了',ng:'できませんでした'};
function ordersHtml(){if(!ORDER_OK)return '';const a=orders().filter(o=>{const r=orderState(o.id);return !(r&&r.status==='done'&&Date.now()-Date.parse(o.at)>7*864e5)});if(!a.length)return '';
 return `<h2>🛍 注文の依頼</h2>${a.slice().reverse().map(o=>{const r=orderState(o.id),st=r?r.status:'requested',u=r&&safeUrl(r.checkoutUrl);return `<div class="card ord ${esc(st)}"><div><span class="tag">${esc(OST[st]||st)}</span> <span class="muted">${esc(o.at.slice(5,16).replace('T',' '))}</span></div>
 <b>${esc(o.items.map(i=>i.name+(i.price?'（'+yen(i.price)+'）':'')).join('、'))}</b>${r&&r.note?`<div class="muted">${esc(r.note)}</div>`:''}${r&&Number.isFinite(r.total)?`<div>合計 ${yen(r.total)}</div>`:''}
 ${st==='cart'&&u?`<div class="row"><a class="btnlink" target="_blank" rel="noopener" href="${esc(u)}">💳 決済画面へ（支払いはご自身で）</a></div>`:''}
 <div class="row"><button class="sub" data-odel="${esc(o.id)}">一覧から消す</button></div></div>`}).join('')}`}
// 比較の返事 kind:"compare"
const okOpt=o=>isObj(o)&&RANKS.some(r=>r[0]===o.rank)&&isStr(o.name)&&o.name.length>0&&o.name.length<=200&&(o.price===undefined||Number.isFinite(o.price))&&(o.total===undefined||Number.isFinite(o.total));
AISHAPE.compare=r=>isObj(r.target)&&isStr(r.target.name)&&isArr(r.options)&&r.options.length>0&&r.options.length<=3&&r.options.every(okOpt);
AISHAPE.order=r=>isStr(r.orderId)&&['requested','cart','done','ng'].includes(r.status)&&(r.checkoutUrl===undefined||isStr(r.checkoutUrl));
KLABEL.compare='⚖️ くらべる';KLABEL.order='🛍 注文';
let CMP_SHOWN=null;
function compareView(r){CMP_SHOWN=r;const opts=RANKS.map(([k])=>r.options.find(o=>o.rank===k)).filter(Boolean);const dv=r.target.mode==='delivery';
 return `<div class="card"><b>⚖️ ${esc(r.title||r.target.name)}</b><div class="muted">${esc(r.target.name)}${r.target.amount?'・'+esc(r.target.amount):''}</div>${knownHtml(r.target.name)}</div>
 <div class="cmp3">${opts.map(o=>{const R=RANKS.find(x=>x[0]===o.rank),u=safeUrl(o.url),i=r.options.indexOf(o);return `<div class="card cmpc ${o.rank}"><div class="cmpr">${R[2]}【${R[1]}】</div><b>${esc(o.name)}</b><div class="muted">${esc(o.store||'')}</div>
  ${Number.isFinite(o.price)?`<div>${yen(o.price)}${o.unitPrice?` <span class="muted">${esc(o.unitPrice)}</span>`:''}</div>`:''}
  ${Number.isFinite(o.total)?`<div><b>実質 ${yen(o.total)}</b> <span class="muted">${dv?'配達料':'送料'}${Number.isFinite(o.shipping)?yen(o.shipping):'こみ'}</span></div>`:''}${o.eta?`<div class="muted">🕒 ${esc(o.eta)}</div>`:''}
  ${o.reason?`<div>${esc(o.reason)}</div>`:''}<div class="muted">出典：${esc(o.source||'不明')}${o.checkedAt?'・'+esc(String(o.checkedAt).slice(5,16).replace('T',' '))+'確認':''}</div>
  <div class="row">${u?`<a class="chip" target="_blank" rel="noopener" href="${esc(u)}">ページを開く</a>`:''}${ORDER_OK?`<button data-pick="${i}">これにする</button>`:''}</div></div>`}).join('')}</div>
 ${ORDER_OK?payNote():''}<div class="muted">値段はAIが調べた時点のものです。買う前にページで確かめてください。</div>`}
{const f=aiView;aiView=function(r){return r.kind==='compare'?compareView(r):r.kind==='order'?`<div class="card"><b>🛍 ${esc(OST[r.status]||r.status)}</b>${r.note?`<div>${esc(r.note)}</div>`:''}${r.status==='cart'&&safeUrl(r.checkoutUrl)?`<div class="row"><a class="btnlink" target="_blank" rel="noopener" href="${esc(safeUrl(r.checkoutUrl))}">💳 決済画面へ</a></div>`:''}</div>`:f(r)}}
{const f=dishPanel;dishPanel=function(w,dish){return f(w,dish).replace(/<\/div>$/,deliRow(dish)+'</div>')}}
{const f=V.list;V.list=function(){return ordersHtml()+f.apply(this,arguments)}}
if(SHOP_AI)CTYPES.push(['compare','くらべる（安い・ベター・豪華）']);if(ORDER_OK)CTYPES.push(['order','注文の準備']);
QUICK.push(['money','🏪 スーパーとネット、どっちが安い？','買い物リストの品を、近くのスーパー（特売）とネット通販でくらべて、どっちで買うのが安いか教えて。送料も考えてね。']);
QUICK.push(['menu','🛵 今夜は作る？出前？','冷蔵庫の中身と今月の家計を見て、今夜は作るのと出前にするのと、どっちがいいか教えて。作るなら献立、出前なら料理の案も。']);
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-ns],[data-deli],[data-cmp],[data-ord],[data-openall],[data-pick],[data-odel]');if(!t)return;const d=t.dataset,y=scrollY;
 if(d.ns!==undefined){NSF=!!t.closest('.often');NS=NS===d.ns?null:d.ns;render();scrollTo(0,y);return}
 if(d.deli!==undefined){NS=NS==='🛵'+d.deli?null:'🛵'+d.deli;render();scrollTo(0,y);return}
 if(d.cmp)return askCompare(d.cmp,d.n);
 if(d.openall)return openAll(d.openall==='delivery'?DELIS:NETS,d.n);
 if(d.ord!==undefined){const it=S.list.filter(i=>!i.done&&baseName(i.name)===d.ord).map(i=>({name:i.name,qty:i.qty||''}));return askOrder(it.length?it:[{name:d.ord}],d.mode||'goods')}
 if(d.pick!==undefined){const r=CMP_SHOWN,o=r&&r.options[+d.pick];if(!o)return;return askOrder([{name:o.name,qty:r.target.amount||'',store:o.store||'',price:Number.isFinite(o.price)?o.price:null,total:Number.isFinite(o.total)?o.total:null,url:safeUrl(o.url),rank:o.rank}],r.target.mode==='delivery'?'delivery':'goods')}
 if(d.odel){saveOrders(orders().filter(o=>o.id!==d.odel));render();scrollTo(0,y)}});
