'use strict';
// v27 ネットで探す・出前・3つ比べる（安い／豪華／ベター）・アキラちゃんに注文を頼む。
// 支払いはかならず浩二さんが自分の手で。アキラちゃんはカートに入れて決済の直前まで進めるだけ。形は docs/比較と注文の形.md
const SHOP_AI=true,ORDER_OK=true; // ライフハック！では port.py が false にする
const OK_='okaimono_orders';
const enc=encodeURIComponent;
// ボタンにしてよいURL：https で、許可したドメインそのもの か その正しいサブドメインだけ
const SHOP_HOSTS=['amazon.co.jp','amazon.jp','rakuten.co.jp','aeon.com','aeon.co.jp','seiyu.co.jp','ubereats.com','demae-can.com','menu.jp','super-fresco.co.jp','life-netsuper.jp','lifecorp.jp','heiwado.jp','coop-kobe.net','kansai-super.co.jp','kansaisuper.co.jp','yodobashi.com','lohaco.yahoo.co.jp','shopping.yahoo.co.jp','paypaymall.yahoo.co.jp','costco.co.jp','itoyokado.co.jp','iy-net.jp','muji.com','nitori-net.jp','askul.co.jp'];
function shopUrl(u){try{const x=new URL(String(u));if(x.protocol!=='https:'||x.username||x.password||x.port)return '';const h=x.hostname.toLowerCase().replace(/\.$/,'');return SHOP_HOSTS.some(d=>h===d||h.endsWith('.'+d))?x.href:''}catch(e){return ''}}
const NETS=[['Amazon',q=>'https://www.amazon.co.jp/s?k='+enc(q)],['楽天市場',q=>'https://search.rakuten.co.jp/search/mall/'+enc(q)+'/'],['イオンネットスーパー',q=>'https://shop.aeon.com/netsuper/search/?q='+enc(q)],['楽天西友ネットスーパー',q=>'https://netsuper.rakuten.co.jp/seiyu/search/?keyword='+enc(q)]];
const DELIS=[['Uber Eats',q=>'https://www.ubereats.com/jp/search?q='+enc(q)],['出前館',()=>'https://demae-can.com/'],['menu',()=>'https://menu.jp/']];
const RANKS=[['cheap','安い','💴'],['better','ベター','👍'],['luxury','豪華','✨']];
let NS=null,NSF=false; // 開いている「ネットで探す」の品名
function orders(){try{const a=JSON.parse(localStorage.getItem(OK_)||'[]');return isArr(a)?a.filter(o=>isObj(o)&&isStr(o.id)):[]}catch(e){return []}}
function saveOrders(a){setLS(OK_,JSON.stringify(a.slice(-30)))}
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
 <div class="row"><button data-cmp="goods" data-n="${esc(q)}">⚖️ 安い・ベター・豪華の3つを比べてもらう</button></div>`:`<div class="muted">上のリンクを1つずつ開いて、送料こみの値段をくらべてください。</div>`}
 ${ORDER_OK?`<div class="row"><button class="sub" data-ord="${esc(q)}">🛍 アキラちゃんに注文を頼む</button></div>`:''}${ORDER_OK?payNote():''}</div>`}
const payNote=()=>`<div class="muted">※アキラちゃんはカートに入れて決済の直前まで進めるだけです。支払いは浩二さんご自身でお願いします。</div>`;
function deliRow(dish){return `<div class="row"><button class="sub" data-deli="${esc(dish)}">🛵 出前にする</button></div>${NS==='🛵'+dish?deliMenu(dish):''}`}
function deliMenu(dish){return `<div class="card nsbox"><b>🛵 出前：${esc(dish)}</b><div class="nslinks">${DELIS.map(([l,f])=>`<a class="chip" target="_blank" rel="noopener" href="${esc(f(dish))}">${esc(l)}</a>`).join('')}</div><div class="muted">出前館・menu はトップを開きます（料理名での検索リンクがないため）。</div>
 ${SHOP_AI?`<div class="row"><input id="cp_bud" type="number" inputmode="numeric" placeholder="予算（円・なくてもOK）"><button data-cmp="delivery" data-n="${esc(dish)}">⚖️ 3つ比べてもらう</button></div>`:`<div class="muted">上のリンクを1つずつ開いて、配達料こみの値段をくらべてください。</div>`}
 ${ORDER_OK?`<div class="row"><button class="sub" data-ord="${esc(dish)}" data-mode="delivery">🛍 アキラちゃんに注文を頼む</button></div>${payNote()}`:''}</div>`}
function goConsult(type,q,extra){CON.open=true;CON.from=location.hash;CON.type=type;CON.q=q;CON.extra=extra;CON.inc={fridge:false,list:false,spend:'off',memo:false};CON.incType=type;CON.stage='confirm';CON.status='';render();scrollTo(0,0)}
function askCompare(mode,name){const amount=val('cp_amt'),conditions=val('cp_cond'),b=+val('cp_bud');const budget=Number.isFinite(b)&&b>0?b:null;
 goConsult('compare',mode==='delivery'?`「${name}」の出前を、安い・ベター・豪華の3つで比べて。配達料と届く目安も。`:`「${name}」${amount?'（'+amount+'）':''}を、安い・ベター・豪華の3つで比べて。送料こみの実質価格も。`,
  {compare:{mode,name,amount,conditions,budget,people:mode==='delivery'?4:null,time:'',area:'兵庫県尼崎市 武庫之荘',known:knownPrices(name).map(x=>({source:x.src,store:x.store,price:x.price||null,text:x.text||'',date:x.date||''}))}})}
function askOrder(items,mode){if(!ORDER_OK)return;const id='o'+uid();items=items.slice(0,30);
 const nk=x=>normDish(baseName(x||''));const dup=items.filter(i=>orders().some(o=>{const r=orderState(o.id);return !(r&&(r.status==='ng'||r.status==='done'&&Date.now()-Date.parse(o.at)>3*864e5))&&o.items.some(x=>nk(x.name)===nk(i.name))}));
 if(dup.length&&!confirm('「'+dup.map(i=>i.name).join('、')+'」は、すでに注文を頼んでいます（依頼中・決済待ち・最近完了）。もう一度頼みますか？'))return;
 goConsult('order',`注文の準備をお願い：${items.map(i=>i.name+(i.qty?' '+i.qty:'')).join('、')}。カートに入れて決済の直前まで。支払いは自分でします。`,{order:{orderId:id,mode,items,payment:'self'}})}
function onSent(type,extra){if(type==='order'&&extra&&extra.order){const a=orders();a.push({id:extra.order.orderId,at:new Date().toISOString(),items:extra.order.items,mode:extra.order.mode});saveOrders(a)}}
// 返事 kind:"order"（状況）を探す
function orderState(id){let s=null;try{hist().forEach(e=>{if(e.item.kind==='order'&&e.item.orderId===id){if(!s||e.at>=s.at)s={at:e.at,r:e.item}}})}catch(e){}return s&&s.r}
const OST={requested:'依頼中',cart:'カート投入済み・決済待ち',done:'完了',ng:'できませんでした'};
function ordersHtml(){if(!ORDER_OK)return '';const a=orders().filter(o=>{const r=orderState(o.id);return !(r&&r.status==='done'&&Date.now()-Date.parse(o.at)>7*864e5)});if(!a.length)return '';
 return `<h2>🛍 注文の依頼</h2>${a.slice().reverse().map(o=>{const r=orderState(o.id),st=r?r.status:'requested',u=r&&shopUrl(r.checkoutUrl);return `<div class="card ord ${esc(st)}"><div><span class="tag">${esc(OST[st]||st)}</span> <span class="muted">${esc(o.at.slice(5,16).replace('T',' '))}</span></div>
 <b>${esc(o.items.map(i=>i.name+(i.price?'（'+yen(i.price)+'）':'')).join('、'))}</b>${r&&r.note?`<div class="muted">${esc(r.note)}</div>`:''}${r&&Number.isFinite(r.total)?`<div>合計 ${yen(r.total)}</div>`:''}
 ${st==='cart'&&u?`<div class="row"><a class="btnlink" target="_blank" rel="noopener" href="${esc(u)}">💳 決済画面へ（支払いはご自身で）</a></div>`:''}
 ${st==='done'&&!o.logged?`<div class="tip">💴 家計に記録する？<div class="row"><input type="number" inputmode="numeric" id="olog_${esc(o.id)}" value="${Number.isFinite(r&&r.total)?r.total:(o.items.reduce((a,i)=>a+(+i.total||+i.price||0),0)||'')}" placeholder="金額" style="width:110px"><select id="ocat_${esc(o.id)}">${catOpts(o.mode==='delivery'?'惣菜':'食材・米')}</select><button data-olog="${esc(o.id)}">記録する</button><button class="sub" data-onolog="${esc(o.id)}">しない</button></div></div>`:o.logged==='yes'?'<div class="muted">💴 家計に記録ずみ</div>':''}
 <div class="row"><button class="sub" data-odel="${esc(o.id)}">一覧から消す</button></div></div>`}).join('')}`}
// 比較の返事 kind:"compare"
const okOpt=o=>isObj(o)&&RANKS.some(r=>r[0]===o.rank)&&isStr(o.name)&&o.name.length>0&&o.name.length<=200&&(o.price===undefined||Number.isFinite(o.price))&&(o.total===undefined||Number.isFinite(o.total));
AISHAPE.compare=r=>isObj(r.target)&&isStr(r.target.name)&&isArr(r.options)&&r.options.length>0&&r.options.length<=3&&r.options.every(okOpt);
AISHAPE.order=r=>isStr(r.orderId)&&['requested','cart','done','ng'].includes(r.status)&&(r.checkoutUrl===undefined||isStr(r.checkoutUrl));
KLABEL.compare='⚖️ くらべる';KLABEL.order='🛍 注文';
let CMP_SHOWN=null;
function compareView(r){CMP_SHOWN=r;const opts=RANKS.map(([k])=>r.options.find(o=>o.rank===k)).filter(Boolean);const dv=r.target.mode==='delivery';
 return `<div class="card"><b>⚖️ ${esc(r.title||r.target.name)}</b><div class="muted">${esc(r.target.name)}${r.target.amount?'・'+esc(r.target.amount):''}</div>${knownHtml(r.target.name)}</div>
 <div class="cmp3">${opts.map(o=>{const R=RANKS.find(x=>x[0]===o.rank),u=shopUrl(o.url),i=r.options.indexOf(o);return `<div class="card cmpc ${o.rank}"><div class="cmpr">${R[2]}【${R[1]}】</div><b>${esc(o.name)}</b><div class="muted">${esc(o.store||'')}</div>
  ${Number.isFinite(o.price)?`<div>${yen(o.price)}${o.unitPrice?` <span class="muted">${esc(o.unitPrice)}</span>`:''}</div>`:''}
  ${Number.isFinite(o.total)?`<div><b>実質 ${yen(o.total)}</b> <span class="muted">${dv?'配達料':'送料'}${Number.isFinite(o.shipping)?yen(o.shipping):'こみ'}</span></div>`:''}${o.eta?`<div class="muted">🕒 ${esc(o.eta)}</div>`:''}
  ${o.reason?`<div>${esc(o.reason)}</div>`:''}<div class="muted">出典：${esc(o.source||'不明')}${o.checkedAt?'・'+esc(String(o.checkedAt).slice(5,16).replace('T',' '))+'確認':''}</div>
  <div class="row">${u?`<a class="chip" target="_blank" rel="noopener" href="${esc(u)}">ページを開く</a>`:''}${ORDER_OK?`<button data-pick="${i}">これにする</button>`:''}</div></div>`}).join('')}</div>
 ${ORDER_OK?payNote():''}<div class="muted">値段はAIが調べた時点のものです。買う前にページで確かめてください。</div>`}
{const f=aiView;aiView=function(r){return r.kind==='compare'?compareView(r):r.kind==='order'?`<div class="card"><b>🛍 ${esc(OST[r.status]||r.status)}</b>${r.note?`<div>${esc(r.note)}</div>`:''}${r.status==='cart'&&shopUrl(r.checkoutUrl)?`<div class="row"><a class="btnlink" target="_blank" rel="noopener" href="${esc(shopUrl(r.checkoutUrl))}">💳 決済画面へ</a></div>`:r.checkoutUrl?'<div class="muted">⚠️ 決済画面のURLが許可したお店のものではないため、ボタンにしていません。</div>':''}</div>`:f(r)}}
{const f=dishPanel;dishPanel=function(w,dish){return f(w,dish).replace(/<\/div>$/,deliRow(dish)+'</div>')}}
{const f=V.list;V.list=function(){return ordersHtml()+f.apply(this,arguments)}}
if(SHOP_AI)CTYPES.push(['compare','くらべる（安い・ベター・豪華）']);if(ORDER_OK)CTYPES.push(['order','注文の準備']);
QUICK.push(['money','🏪 スーパーとネット、どっちが安い？','買い物リストの品を、近くのスーパー（特売）とネット通販でくらべて、どっちで買うのが安いか教えて。送料も考えてね。']);
QUICK.push(['menu','🛵 今夜は作る？出前？','冷蔵庫の中身と今月の家計を見て、今夜は作るのと出前にするのと、どっちがいいか教えて。作るなら献立、出前なら料理の案も。']);
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-ns],[data-deli],[data-cmp],[data-ord],[data-openall],[data-pick],[data-odel],[data-olog],[data-onolog]');if(!t)return;const d=t.dataset,y=scrollY;
 if(d.ns!==undefined){NSF=!!t.closest('.often');NS=NS===d.ns?null:d.ns;render();scrollTo(0,y);return}
 if(d.deli!==undefined){NS=NS==='🛵'+d.deli?null:'🛵'+d.deli;render();scrollTo(0,y);return}
 if(d.cmp)return askCompare(d.cmp,d.n);
 if(d.openall)return openAll(d.openall==='delivery'?DELIS:NETS,d.n);
 if(d.ord!==undefined){const it=S.list.filter(i=>!i.done&&baseName(i.name)===d.ord).map(i=>({name:i.name,qty:i.qty||''}));return askOrder(it.length?it:[{name:d.ord}],d.mode||'goods')}
 if(d.pick!==undefined){const r=CMP_SHOWN,o=r&&r.options[+d.pick];if(!o)return;return askOrder([{name:o.name,qty:r.target.amount||'',store:o.store||'',price:Number.isFinite(o.price)?o.price:null,total:Number.isFinite(o.total)?o.total:null,url:shopUrl(o.url),rank:o.rank}],r.target.mode==='delivery'?'delivery':'goods')}
 if(d.olog||d.onolog){const id=d.olog||d.onolog,a=orders(),o=a.find(x=>x.id===id);if(!o)return;if(d.olog){const v=+val('olog_'+id);if(!(okAmt1(v)))return alert('金額を入れてください');const r=orderState(id),st=o.items.map(i=>i.store).filter(Boolean)[0]||(o.mode==='delivery'?'出前':'通販');S.spend.push({id:uid(),date:ymd(today()),store:st.slice(0,200),cat:val('ocat_'+id)||'食材・米',amount:v,memo:('注文：'+o.items.map(i=>i.name).join('、')).slice(0,500)});save();o.logged='yes';toast('家計に記録しました')}else o.logged='no';saveOrders(a);render();scrollTo(0,y);return}
 if(d.odel){saveOrders(orders().filter(o=>o.id!==d.odel));render();scrollTo(0,y)}});
// ---- 🛵 出前を頼む ／ 📦 通販で頼む（リストにない物も自由に。頼む＝かならず3つの値段比べ → 「これにする」で注文へ）----
let REQ=null;const RQ={delivery:{},goods:{}};
const RQF={delivery:[['what','食べたいもの','例：ピザとポテト、子ども向けも','ta'],['people','人数','4','num'],['budget','予算（円・任意）','','num'],['time','希望の時間（任意）','例：19時ごろ'],['note','メモ（任意）','例：辛くないもの、アレルギーなど']],
 goods:[['what','ほしいもの','例：子ども用の水筒 500mlくらい','ta'],['qty','数量','1'],['budget','予算（円・任意）','','num'],['cond','条件（任意）','例：メーカー、サイズ、〇日までに届く'],['note','メモ（任意）','']]};
function rqVal(m,k){const v=RQ[m][k];return v===undefined?(k==='people'?'4':k==='qty'?'1':''):v}
document.addEventListener('input',e=>{const t=e.target;if(!REQ||!t||!t.id||t.id.slice(0,3)!=='rq_')return;const k=t.id.slice(3);if(RQF[REQ].some(f=>f[0]===k))RQ[REQ][k]=t.value});
function rqKeep(){if(!REQ)return;RQF[REQ].forEach(([k])=>{const e=document.getElementById('rq_'+k);if(e)RQ[REQ][k]=e.value.trim()})}
function rqLatest(m){let best=null;try{hist().forEach(e=>{if(e.item.kind==='compare'&&(e.item.target.mode||'goods')===m&&(!best||e.at>best.at))best=e})}catch(e){}return best}
function reqHtml(){const tab=(m,l)=>`<button class="${REQ===m?'on':''}" data-rq="${m}">${l}</button>`;let h=`<div class="seg req2">${tab('delivery','🛵 出前を頼む')}${tab('goods','📦 通販で頼む')}</div>`;if(!REQ)return h;const m=REQ,dv=m==='delivery';
 h+=`<div class="card nsbox reqbox">${RQF[m].map(([k,l,ph,t])=>`<label class="rql" for="rq_${k}">${l}</label>`+(t==='ta'?`<textarea id="rq_${k}" rows="2" style="width:100%" placeholder="${esc(ph)}">${esc(rqVal(m,k))}</textarea>`:`<input id="rq_${k}" ${t==='num'?'type="number" inputmode="numeric"':''} value="${esc(rqVal(m,k))}" placeholder="${esc(ph)}" style="width:100%">`)).join('')}`;
 const q=RQ[m].what||'';const L=dv?DELIS:NETS;
 if(SHOP_AI){h+=`<div class="row"><button data-rqgo="${m}">頼む（自動で値段を比べる）</button></div><div class="muted">安い・ベター・豪華の3つが届いたら「これにする」で注文の準備へ。${ORDER_OK?'支払いはご自身で。':''}</div>
  <div class="rqself"><a class="link" href="#" data-rqself="${m}">自分で探す（リンク）</a></div>${NS==='rq'+m&&q?`<div class="nslinks">${L.map(([l,f])=>`<a class="chip" target="_blank" rel="noopener" href="${esc(f(q))}">${esc(l)}</a>`).join('')}</div>`:''}`;
  const e=rqLatest(m);if(e)h+=`<div class="muted">いちばん新しい比べた結果（${esc(e.at.slice(5,16).replace('T',' '))}）</div>`+compareView(e.item)}
 else h+=`<div class="row"><button data-rqself="${m}">比較用のリンクを出す</button></div>${NS==='rq'+m&&q?`<div class="nslinks">${L.map(([l,f])=>`<a class="chip" target="_blank" rel="noopener" href="${esc(f(q))}">${esc(l)}で探す</a>`).join('')}</div><div class="muted">いくつか開いて、送料こみの値段をくらべてください。</div>`:''}`;
 if(dv)h+=`<div class="muted">出前館・menu はトップを開きます（検索リンクがないため）。</div>`;return h+'</div>'}
function rqGo(m){rqKeep();const r=RQ[m];if(!r.what){alert(m==='delivery'?'食べたいものを書いてください':'ほしいものを書いてください');return}
 const b=+r.budget,budget=Number.isFinite(b)&&b>0?b:null;
 if(m==='delivery'){const n=+r.people,people=Number.isInteger(n)&&n>0&&n<100?n:4;
  goConsult('compare',`${r.what}\n（出前・${people}人分${budget?'・予算'+budget+'円':''}${r.time?'・'+r.time:''}${r.note?'・'+r.note:''}）\n安い・ベター・豪華の3つで比べて。配達料こみの実質価格と届く目安も。`,{compare:{mode:'delivery',name:r.what,amount:people+'人分',people,time:r.time||'',conditions:r.note||'',budget,area:'兵庫県尼崎市 武庫之荘',known:[]}})}
 else goConsult('compare',`${r.what}${r.qty?'（'+r.qty+'）':''}${r.cond?'\n条件：'+r.cond:''}${r.note?'\nメモ：'+r.note:''}${budget?'\n予算：'+budget+'円':''}\n安い・ベター・豪華の3つで比べて。送料こみの実質価格も。`,{compare:{mode:'goods',name:r.what,amount:r.qty||'',conditions:[r.cond,r.note].filter(Boolean).join('／'),budget,area:'兵庫県尼崎市 武庫之荘',known:knownPrices(r.what).map(x=>({source:x.src,store:x.store,price:x.price||null,text:x.text||'',date:x.date||''}))}})}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-rq],[data-rqgo],[data-rqself]');if(!t)return;e.preventDefault();const y=scrollY;rqKeep();
 if(t.dataset.rq){REQ=REQ===t.dataset.rq?null:t.dataset.rq;render();scrollTo(0,y);return}
 if(t.dataset.rqgo)return rqGo(t.dataset.rqgo);
 if(t.dataset.rqself){const m=t.dataset.rqself;if(!RQ[m].what){alert('先に何を探すか書いてください');return}NS=NS==='rq'+m?null:'rq'+m;render();scrollTo(0,y)}});
{const f=V.list;V.list=function(){return reqHtml()+f.apply(this,arguments)}}
{const f=V.fridge;V.fridge=function(){const s=f.apply(this,arguments);return s.replace('<h2>今週の献立</h2>',reqHtml()+'<h2>今週の献立</h2>')}}

BKX.orders={get:()=>orders(),check:v=>isArr(v),set:v=>{if(isArr(v))saveOrders(v.filter(o=>isObj(o)&&isStr(o.id)&&/^o[a-z0-9]{4,40}$/.test(o.id)&&isArr(o.items)&&isStr(o.at)).map(o=>({id:o.id,at:o.at.slice(0,40),mode:o.mode==='delivery'?'delivery':'goods',logged:o.logged==='yes'||o.logged==='no'?o.logged:undefined,items:o.items.filter(isObj).slice(0,30).map(i=>({name:String(i.name||'').slice(0,200),qty:String(i.qty||'').slice(0,50),store:String(i.store||'').slice(0,200),price:Number.isFinite(i.price)?i.price:null,total:Number.isFinite(i.total)?i.total:null,url:shopUrl(i.url),rank:String(i.rank||'').slice(0,10)}))})))}};
