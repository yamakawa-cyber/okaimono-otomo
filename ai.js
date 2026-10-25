'use strict';
// AIの提供元（差し替え可能）。アプリにAPIキーは置かない。
// MockProvider：見本の答え。RelayProvider：中継サーバー（Cloudflare Workers等）にPOSTするだけ。
// 返す形（JSON）は共通：{kind, title, ...}。Googleドライブ経由の答えファイルも同じ形で読める。
const MockProvider={name:'見本',async ask(kind,ctx){await new Promise(r=>setTimeout(r,150));return MOCK[kind](ctx)}};
const RelayProvider=url=>({name:'中継サーバー',async ask(kind,ctx){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,ctx})});if(!r.ok)throw new Error('中継サーバーのエラー '+r.status);return r.json()}});
function aiProvider(){const u=(S.settings.aiRelay||'').trim();return u?RelayProvider(u):MockProvider}
// 機能ごとに送る要約だけを作る（全データは送らない）
function aiContext(kind){const d=today();
 const sale=regStores().filter(s=>salesOn(s,d).length).map(s=>({store:s.name,items:salesOn(s,d).map(x=>x.text)}));
 const mo=ymd(d).slice(0,8);const sp=S.spend.filter(r=>r.date.startsWith(mo.slice(0,7)));const byCat={};sp.forEach(r=>byCat[r.cat]=(byCat[r.cat]||0)+Number(r.amount));
 return {today:ymd(d),fridge:S.fridge.map(f=>({name:f.name,until:f.until})),menu:menuArr(),sale,perTrip:S.settings.perTrip,monthly:S.settings.monthly,
  spendTotal:sp.reduce((t,r)=>t+Number(r.amount),0),byCat,recent:S.spend.slice(-10).map(r=>r.memo||r.cat),list:S.list.map(i=>i.name)}}
const MOCK={
 menu:c=>{const f=c.fridge.map(x=>x.name);const a=f[0]||'にんじん',b=f[1]||'豚こま';
  return {kind:'menu',title:'冷蔵庫からの献立案',plan:[`月：${b}と${a}の甘辛炒め`,'火：鶏むね肉の塩レモン焼き','水：作り置きのきんぴら＋具だくさん味噌汁','木：豚汁と焼き魚','金：カレー（2日分）'],
   prep:[`${a}のきんぴら（日曜に作る・水曜まで）`,'ゆで卵（日曜・3日以内）','鶏むね肉の下味冷凍（日曜・2週間）'],
   recipe:{name:`${b}と${a}の甘辛炒め`,serves:'2人分',time:'約15分',ingredients:[`${b} 200g`,`${a} 1本`,'玉ねぎ 1/2個','しょうゆ・みりん 各大さじ2','砂糖 小さじ1','サラダ油 小さじ2'],
    steps:[{t:'野菜を切る',d:`${a}は皮をむいて細切り（4〜5cm）。玉ねぎは薄切り。`,tip:'太さをそろえると火の通りが同じになります。',min:4},
     {t:'たれを合わせる',d:'しょうゆ・みりん・砂糖を小さな器で混ぜておく。',tip:'先に作っておくと炒めながら慌てません。',min:1},
     {t:'肉を炒める',d:`フライパンに油を中火で熱し、${b}を広げて焼く。色が変わったら一度取り出す。`,tip:'さわりすぎないのが、かたくしないこつ。',min:3},
     {t:'野菜を炒める',d:`同じフライパンで${a}と玉ねぎを2〜3分炒める。`,tip:'しんなりして、玉ねぎが透き通ればOK。',min:3},
     {t:'合わせて味付け',d:'肉を戻し、たれを回し入れて、汁気が少なくなるまで1〜2分からめる。',tip:'最後は強火にすると照りが出ます。',min:2},
     {t:'盛り付け・保存',d:'お皿に盛る。余りは冷めてから保存容器へ。冷蔵で2日が目安。',tip:'作り置きにするなら、汁気をしっかり飛ばします。',min:2}]}}},
 shop:c=>({kind:'shop',title:'特売に合わせた買い物リスト',note:c.sale.length?'きょうの特売：'+c.sale.map(s=>s.store+'（'+s.items.join('・')+'）').join('、'):'きょう決まった特売日のお店はありません',
   items:[{name:'玉子',store:'スーパーマルハチ 武庫之荘店',why:'火曜は玉子の特売',yen:230},{name:'牛乳',store:'フレスコ 武庫之荘店',why:'金曜は牛乳の日',yen:200},{name:'鶏むね肉 2枚',store:'KOHYO 武庫之荘店',why:'献立の火曜分',yen:600},{name:'玉ねぎ 3個',store:'KOHYO 武庫之荘店',why:'在庫なし',yen:200},{name:'冷凍ブロッコリー',store:'業務スーパー 南武庫之荘店',why:'作り置きの付け合わせ',yen:250}],budget:c.perTrip}),
 money:c=>({kind:'money',title:'今月の出費まとめ',total:c.spendTotal,monthly:c.monthly,byCat:c.byCat,tips:['食料品は週2回の買い物にまとめ、間の買い足しを減らすと月3,000円ほど下がる見込み','日用品は、ツルハの1日・10日・20日やウエルシアの20日など、感謝デーにまとめて買う','米や調味料は、月1回の大容量でまとめ買い（業務スーパーなど）']}),
 hacks:c=>({kind:'hacks',title:'買ったものの節約術・ライフハック',items:[{about:'玉子',tip:'とがった方を下にして冷蔵庫へ。ゆで卵は殻付きで3日が目安。'},{about:'鶏むね肉',tip:'買った日に、そぎ切り＋下味（塩・酒）で冷凍。2週間もち、やわらかく仕上がります。'},{about:'玉ねぎ',tip:'ネットに入れて風通しのよい場所へ。半分残ったらラップして冷蔵で3〜4日。'},{about:'牛乳',tip:'期限が近いものは、シチューやフレンチトーストで使い切る。'}]}),
 advise:c=>({kind:'advise',title:'相談への答え',summary:`「${c.q}」について整理しました。`,needs:['まず、何のために・いつまでに・予算いくらかを決める','いまある物で代わりにならないか確認','買うなら、特売日やポイントデーに合わせる'],steps:['1週間ためしてみて、困った点を書き出す','必要なものを3つまでにしぼる','次の買い物日のリストに入れる'],cost:'目安は、内容が決まってから計算します'}),
 chat:c=>({kind:'chat',reply:`見本の返事です。「${c.q}」ですね。本物のAIにつながると、冷蔵庫や特売、家計のデータをふまえて答えます。`})};
// --- 画面 ---
let AI={mode:'menu',res:null,step:0,chat:[]};
const AIMODES=[['menu','献立'],['shop','買い物'],['money','家計'],['hacks','こつ'],['advise','相談'],['chat','チャット']];
V.ai=function(){const p=aiProvider();
 let h=`<div class="card sample">${p===MockProvider?'🧪 <b>見本モード</b>：いまの答えは、AIではなく<b>見本</b>です。設定で中継サーバーのURLを入れると、本物のAIにつながります。':'🔗 中継サーバーにつながります'}</div>
 <div class="seg wrap">${AIMODES.map(([k,l])=>`<button class="${AI.mode===k?'on':''}" onclick="AI.mode='${k}';AI.res=null;AI.step=0;render()">${l}</button>`).join('')}</div>`;
 const m=AI.mode;
 if(m==='advise'||m==='chat'){h+= m==='chat'?`<div class="card">${AI.chat.map(x=>`<div class="bub ${x.me?'me':''}">${esc(x.t)}</div>`).join('')||'<div class="muted">何でも聞いてね（例：あした冷蔵庫の物で何作れる？）</div>'}</div>`:'';
  h+=`<div class="card"><textarea id="aiq" rows="3" style="width:100%" placeholder="${m==='advise'?'やりたいこと・困っていること（例：お弁当を毎日作りたい）':'メッセージ'}"></textarea><div class="row"><button onclick="aiAsk()">${m==='advise'?'相談する':'送る'}</button></div></div>`}
 else h+=`<div class="row"><button onclick="aiAsk()">${{menu:'冷蔵庫から献立を提案してもらう',shop:'特売に合わせてリストを作る',money:'出費をまとめて助言をもらう',hacks:'買ったものの節約術を聞く'}[m]}</button></div>`;
 const r=AI.res;if(r&&r.kind===m)h+=aiView(r);return h};
function badge(){return aiProvider()===MockProvider?'<span class="tag sampletag">見本</span>':''}
function aiView(r){
 if(r.kind==='menu'){if(AI.lesson)return lessonView(r.recipe);
  return `<div class="card">${badge()}<b>${esc(r.title)}</b><ul>${r.plan.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><b>作り置き</b><ul>${r.prep.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <div class="row"><button class="sub" onclick="aiToMenu()">献立と買い物をまとめて入れる</button></div></div>
  <div class="card">${badge()}<b>🍳 ${esc(r.recipe.name)}</b> <span class="muted">${esc(r.recipe.serves)}・${esc(r.recipe.time)}</span><div class="row"><button onclick="AI.lesson=true;AI.step=0;render()">レッスンを始める（${r.recipe.steps.length}ステップ）</button></div></div>`}
 if(r.kind==='shop'){const t=r.items.reduce((a,i)=>a+i.yen,0);return `<div class="card">${badge()}<b>${esc(r.title)}</b><div class="muted">${esc(r.note)}</div><table>${r.items.map(i=>`<tr><td>${esc(i.name)}<div class="muted">${esc(i.store)}・${esc(i.why)}</div></td><td>${yen(i.yen)}</td></tr>`).join('')}</table>
  <div>合計の目安 ${yen(t)} / 予算 ${yen(r.budget)} ${t<=r.budget?'✅':'⚠️'}</div><div class="row"><button onclick="aiToList()">買い物リストに入れる</button></div></div>`}
 if(r.kind==='money')return `<div class="card">${badge()}<b>${esc(r.title)}</b><div>合計 ${yen(r.total)} / ${yen(r.monthly)}</div>${bar(r.total,r.monthly)}<table>${Object.entries(r.byCat).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${yen(v)}</td></tr>`).join('')}</table><b>節約のアドバイス</b><ol>${r.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`;
 if(r.kind==='hacks')return `<div class="card">${badge()}<b>${esc(r.title)}</b>${r.items.map(i=>`<div class="hack"><span class="tag">${esc(i.about)}</span> ${esc(i.tip)}</div>`).join('')}</div>`;
 if(r.kind==='advise')return `<div class="card">${badge()}<b>${esc(r.title)}</b><p>${esc(r.summary)}</p><b>必要なこと</b><ul>${r.needs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><b>進め方</b><ol>${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="muted">費用：${esc(r.cost)}</div></div>`;
 return ''}
var lessonView=function(rc){const n=rc.steps.length,i=AI.step;
 if(i<0)return '';const head=`<div class="card">${badge()}<b>🍳 ${esc(rc.name)}</b> <span class="muted">${esc(rc.serves)}・${esc(rc.time)}</span><div class="bar"><div style="width:${(i+1)/(n+1)*100}%"></div></div></div>`;
 if(i===0&&!AI.started)return head+`<div class="card lesson"><h2>まずは材料をそろえよう</h2><ul class="chk">${rc.ingredients.map(x=>`<li><input type="checkbox"><span>${esc(x)}</span></li>`).join('')}</ul><div class="row"><button class="sub" onclick="AI.lesson=false;render()">もどる</button><button onclick="AI.started=true;render()">そろった！始める</button></div></div>`;
 const s=rc.steps[i];
 return head+`<div class="card lesson"><div class="muted">ステップ ${i+1} / ${n}（約${esc(s.min)}分）</div><h2>${esc(s.t)}</h2><p class="big">${esc(s.d)}</p><div class="tip">💡 ${esc(s.tip)}</div>
 <div class="row"><button class="sub" onclick="${i===0?'AI.started=false':'AI.step--'};render()">← もどる</button>${i<n-1?`<button onclick="AI.step++;render()">つぎへ →</button>`:`<button onclick="AI.lesson=false;AI.started=false;AI.step=0;alert('できあがり！おつかれさま');render()">できあがり 🎉</button>`}</div></div>`}
async function aiAsk(){const m=AI.mode;const ctx=aiContext(m);const q=document.getElementById('aiq');if(q){ctx.q=q.value.trim();if(!ctx.q)return}
 try{const r=checkAI(await aiProvider().ask(m,ctx));if(m==='chat'){AI.chat.push({me:true,t:ctx.q},{t:r.reply});}else{AI.res=r;AI.lesson=false;AI.started=false;AI.step=0}render()}catch(e){alert('AIにつながりませんでした：'+e.message)}}
function aiExport(){const all={};AIMODES.forEach(([k])=>all[k]=aiContext(k));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({app:'okaimono',made:ymd(today()),ctx:all},null,1)],{type:'application/json'}));a.download='AI依頼_'+ymd(today())+'.json';a.click()}
// AIの答えファイルの形を確かめる（足りなければ表示しない）
const AISHAPE={menu:r=>isArr(r.plan)&&r.plan.every(isStr)&&isArr(r.prep)&&r.prep.every(isStr)&&isObj(r.recipe)&&isStr(r.recipe.name)&&isArr(r.recipe.ingredients)&&isArr(r.recipe.steps)&&r.recipe.steps.length>0&&r.recipe.steps.every(x=>isObj(x)&&isStr(x.t)&&isStr(x.d)),
 shop:r=>isArr(r.items)&&r.items.every(i=>isObj(i)&&isStr(i.name)&&Number.isFinite(i.yen))&&Number.isFinite(r.budget),
 money:r=>Number.isFinite(r.total)&&Number.isFinite(r.monthly)&&isObj(r.byCat)&&isArr(r.tips)&&r.tips.every(isStr),
 hacks:r=>isArr(r.items)&&r.items.every(i=>isObj(i)&&isStr(i.about)&&isStr(i.tip)),
 receipt:r=>isStr(r.store)&&r.store.length<=200&&isDate(r.date)&&isArr(r.items)&&r.items.length>0&&r.items.length<=200&&r.items.every(i=>isObj(i)&&isStr(i.name)&&Number.isFinite(i.price)&&Math.abs(i.price)<1e7&&(i.category===undefined||isStr(i.category)))&&Number.isFinite(r.total)&&r.total>=1&&r.total<1e7,
 advise:r=>isStr(r.summary)&&isArr(r.needs)&&isArr(r.steps),chat:r=>isStr(r.reply)};
function checkAI(r){if(!isObj(r)||!isStr(r.kind)||!AISHAPE[r.kind])throw new Error('答えの種類（kind）がわかりません');if(!AISHAPE[r.kind](r))throw new Error('「'+r.kind+'」の答えに足りない項目があります');if(!isStr(r.title))r.title='AIの答え';return r}
function aiImport(ev){const inp=ev.target,f=inp.files[0];if(!f)return;f.text().then(t=>{let r;try{r=JSON.parse(t)}catch(e){throw new Error('JSONではありません')}checkAI(r);
 const hid=histAdd(r,'file');if(r.kind==='receipt'||r.kind==='fridge')return rcImport([r]);AT.open=hid;AT.lesson=null;location.hash='#ai';render()})
 .catch(e=>alert('読めませんでした：'+e.message)).finally(()=>{inp.value=''})}
// ===== v14：AIタブ（ワンタップ相談・返事の保管庫・料理レッスン）。見本は ?demo=1 のときだけ =====
AISHAPE.recipe=r=>isStr(r.name)&&isArr(r.ingredients)&&r.ingredients.every(isStr)&&isArr(r.steps)&&r.steps.length>0&&r.steps.every(x=>isObj(x)&&isStr(x.t)&&isStr(x.d));
const HK=IS_DEMO?'okaimono_hist_demo':'okaimono_hist',HIST_MAX=150,HIST_BYTES=1500000;
const KLABEL={menu:'🍳 献立',recipe:'🥘 レシピ',shop:'🛒 買い物',money:'💰 家計',hacks:'💡 こつ',advise:'🧭 相談',chat:'💬 ひとこと',receipt:'🧾 レシート'};
function hist(){try{const a=JSON.parse(localStorage.getItem(HK)||'[]');return isArr(a)?a.filter(e=>isObj(e)&&isStr(e.id)&&isObj(e.item)&&AISHAPE[e.item.kind]):[]}catch(e){return []}}
function saveHist(a){a=a.slice(0,HIST_MAX);while(a.length>1&&new Blob([JSON.stringify(a)]).size>HIST_BYTES)a.pop();try{localStorage.setItem(HK,JSON.stringify(a))}catch(e){a.splice(Math.floor(a.length/2));localStorage.setItem(HK,JSON.stringify(a))}}
function histTitle(r){return r.kind==='receipt'?`${r.store}（${yen(r.total)}）`:r.kind==='recipe'?r.name:r.kind==='chat'?String(r.reply).slice(0,40):(r.title||KLABEL[r.kind])}
function histAdd(item,src){if(!isObj(item)||!AISHAPE[item.kind])return null;const sig=JSON.stringify(item);const a=hist();const old=a.find(e=>e.sig===sig);if(old)return old.id;
 const e={id:'h'+uid(),at:new Date().toISOString(),src:src||'',sig,item};a.unshift(e);saveHist(a);try{if(typeof linkMenu==='function')setTimeout(linkMenu,0)}catch(x){}return e.id}
let AT={filter:'',open:null,lesson:null,step:0,checked:{},timer:null};
const QUICK=[['menu','🍳 冷蔵庫で今夜の献立','冷蔵庫にあるもので、今夜の献立を考えて。作り方（レシピ）も1品つけてね。'],
 ['menu','🥡 作り置きプラン','今週の作り置きプランを考えて。日持ちの目安と、1品は作り方（レシピ）もつけてね。'],
 ['shop','🛒 特売で買い物リスト','きょう・次の買い物日の特売に合わせて、予算内の買い物リストを作って。'],
 ['money','💰 今週の出費どう？','今週と今月の出費を見て、使いすぎていないか、来週どうすればいいか教えて。'],
 ['hacks','💡 節約ワザ','最近買ったものや冷蔵庫のもので使える、節約のこつ・ライフハックを教えて。'],
 ['receipt','🧾 レシート読み取り','']];
function quickAsk(i){const [t,,q]=QUICK[i];
 if(IS_DEMO){if(t==='receipt')return alert('見本モードではレシートを送りません');AI.mode=t;return aiAsk().then(()=>{if(AI.res){AT.open='demo';render()}})}
 CON.open=true;CON.from=location.hash||'#ai';CON.type=t;CON.q=q;CON.status='';
 if(t==='receipt'){CON.stage='form';render();scrollTo(0,0);const f=document.getElementById('rc_file');if(f&&secret().url)f.click();return}
 CON.stage='confirm';render();scrollTo(0,0)}
function histOpen(id){AT.open=id;AT.lesson=null;render();scrollTo(0,0)}
function histDel(id){if(!confirm('この答えを保管庫から消しますか？'))return;saveHist(hist().filter(e=>e.id!==id));if(AT.open===id)AT.open=null;render()}
function receiptView(r){const g=rcGroups(r);return `<div class="card"><b>🧾 ${esc(r.store)}</b> <span class="muted">${esc(r.date)}・合計 ${yen(r.total)}</span><table>${r.items.map(i=>`<tr><td>${esc(i.name)}<div class="muted">${esc(rcCat(i.category))}</div></td><td>${yen(i.price)}</td></tr>`).join('')}</table>
 <b>費目別</b><table>${g.map(([c,v])=>`<tr><td>${esc(c)}</td><td>${yen(v)}</td></tr>`).join('')}</table>${rcDup(r)?'<div class="muted">家計簿に取り込み済み</div>':`<div class="row"><button onclick="histToSpend()">家計簿に入れる</button></div>`}</div>`}
function histToSpend(){const e=hist().find(x=>x.id===AT.open);if(!e)return;const k='hist'+uid();INBOX.push({key:k,id:null,item:e.item,err:''});rcApply([k])}
function curItem(){if(AT.open==='demo')return AI.res;const e=hist().find(x=>x.id===AT.open);return e?e.item:null}
function recipeOf(r){return r.kind==='recipe'?r:r.kind==='menu'?r.recipe:null}
function startLesson(){const r=curItem(),rc=r&&recipeOf(r);if(!rc)return;AT.lesson=rc;AT.step=-1;AT.checked={};timerStop();wakeOn();render();scrollTo(0,0)}
function endLesson(){AT.lesson=null;timerStop();wakeOff();render()}
// 画面を消さない（Wake Lock）
let WAKE=null;async function wakeOn(){try{if('wakeLock' in navigator&&!WAKE){WAKE=await navigator.wakeLock.request('screen');WAKE.addEventListener('release',()=>{WAKE=null})}}catch(e){}}
function wakeOff(){try{if(WAKE)WAKE.release()}catch(e){}WAKE=null}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&AT.lesson)wakeOn()});
// タイマー
let TM={left:0,run:false,h:null,step:-2};
function timerStop(){clearInterval(TM.h);TM.run=false;TM.h=null}
function fmt(s){return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function timerShow(){const el=document.getElementById('lt_time');if(el)el.textContent=fmt(TM.left);const b=document.getElementById('lt_btn');if(b)b.textContent=TM.run?'⏸ 止める':'▶ スタート'}
function timerToggle(){if(TM.run){timerStop();return timerShow()}if(TM.left<=0)return;TM.run=true;const end=Date.now()+TM.left*1000;
 TM.h=setInterval(()=>{TM.left=Math.max(0,Math.round((end-Date.now())/1000));timerShow();if(TM.left<=0){timerStop();timerShow();ding()}},250);timerShow()}
function timerReset(){timerStop();const s=AT.lesson&&AT.lesson.steps[AT.step];TM.left=Math.round((s&&Number(s.min)>0?Number(s.min):0)*60);timerShow()}
function ding(){try{navigator.vibrate&&navigator.vibrate([400,200,400,200,400])}catch(e){}
 try{const C=window.AudioContext||window.webkitAudioContext;const c=new C();[0,0.5,1].forEach(t=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(0.3,c.currentTime+t);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+t+0.4);o.start(c.currentTime+t);o.stop(c.currentTime+t+0.45)})}catch(e){}
 const el=document.getElementById('lt_time');if(el)el.textContent='⏰ 時間です！'}
function goStep(n){const rc=AT.lesson;AT.step=Math.max(-1,Math.min(rc.steps.length-1,n));timerStop();TM.step=-2;render();scrollTo(0,0)}
lessonView=function(rc){const n=rc.steps.length,i=AT.step;
 const head=`<div class="card"><b>🍳 ${esc(rc.name)}</b> <span class="muted">${esc(rc.serves||'')}${rc.time?'・'+esc(rc.time):''}</span><div class="bar"><div style="width:${(i+1)/n*100}%"></div></div><div class="muted">${WAKE?'💡 画面がつきっぱなしになります':''}</div></div>`;
 if(i<0)return head+`<div class="card lesson"><h2>材料をそろえよう</h2><ul class="chk">${rc.ingredients.map((x,k)=>`<li><input type="checkbox" ${AT.checked[k]?'checked':''} onchange="AT.checked[${k}]=this.checked"><span class="big">${esc(x)}</span></li>`).join('')}</ul>
  <div class="row"><button class="sub" onclick="endLesson()">やめる</button><button onclick="goStep(0)">はじめる →</button></div></div>`;
 const s=rc.steps[i];if(TM.step!==i){TM.step=i;TM.left=Math.round((Number(s.min)>0?Number(s.min):0)*60)}
 return head+`<div class="card lesson"><div class="muted">ステップ ${i+1} / ${n}</div><h2>${esc(s.t)}</h2><p class="big">${esc(s.d)}</p>${s.tip?`<div class="tip">💡 ${esc(s.tip)}</div>`:''}
 ${Number(s.min)>0?`<div class="timer"><span id="lt_time" class="tbig">${fmt(TM.left)}</span><div class="row"><button id="lt_btn" onclick="timerToggle()">${TM.run?'⏸ 止める':'▶ スタート'}</button><button class="sub" onclick="timerReset()">↺</button></div></div>`:''}
 <div class="row"><button class="sub" onclick="goStep(${i-1})">← もどる</button>${i<n-1?`<button onclick="goStep(${i+1})">つぎへ →</button>`:`<button onclick="endLesson();alert('できあがり！おつかれさま')">できあがり 🎉</button>`}</div></div>`};
V.ai=function(){
 if(AT.lesson)return lessonView(AT.lesson);
 let h='';
 if(IS_DEMO)h+=`<div class="card sample">🧪 見本モード：ここに出る答えは見本です（保管庫は本データと別）。</div>`;
 if(AT.open){const r=curItem();if(r){const rc=recipeOf(r);
  h+=`<div class="row"><button class="sub" onclick="AT.open=null;render()">← 保管庫にもどる</button>${AT.open!=='demo'?`<button class="sub" data-x="hdel" data-k="${esc(AT.open)}">🗑 消す</button>`:''}</div>`;
  h+=r.kind==='receipt'?receiptView(r):r.kind==='recipe'?`<div class="card"><b>🥘 ${esc(r.name)}</b><ul>${(r.ingredients||[]).map(x=>`<li>${esc(typeof x==='string'?x:(x&&x.name)||'')}</li>`).join('')}</ul><div class="row"><button class="sub" onclick="aiIngToList()">材料を買い物リストに入れる</button></div></div>`:r.kind==='chat'?`<div class="card"><div class="bub">${esc(r.reply)}</div></div>`:aiView(r).replace(/<div class="row"><button onclick="AI\.lesson=true[^]*?<\/div>/,'');
  if(rc)h+=`<div class="row"><button onclick="startLesson()">👩‍🍳 料理レッスンを始める（${rc.steps.length}ステップ）</button></div>`;return h}AT.open=null}
 h+=`<h2>ワンタップ相談</h2><div class="qgrid">${QUICK.map(([,l],i)=>`<button class="qbtn" onclick="quickAsk(${i})">${l}</button>`).join('')}</div>
 <div class="muted">押すと、送る内容の確認画面が開きます。</div>`;
 const all=hist(),kinds=[...new Set(all.map(e=>e.item.kind))],list=all.filter(e=>!AT.filter||e.item.kind===AT.filter);
 h+=`<h2>返事の保管庫 <span class="muted">${all.length}件</span></h2>`;
 if(kinds.length>1)h+=`<div class="seg wrap"><button class="${AT.filter?'':'on'}" onclick="AT.filter='';render()">すべて</button>${kinds.map(k=>`<button class="${AT.filter===k?'on':''}" data-x="hfilter" data-k="${esc(k)}">${esc(KLABEL[k]||k)}</button>`).join('')}</div>`;
 h+=list.length?list.map(e=>`<div class="card hrow"><div style="flex:1" data-x="hopen" data-k="${esc(e.id)}"><div class="muted">${esc(KLABEL[e.item.kind]||'')}・${esc(e.at.slice(5,16).replace('T',' '))}</div><b>${esc(histTitle(e.item))}</b></div><button class="sub" data-x="hopen" data-k="${esc(e.id)}">ひらく</button><button class="sub" data-x="hdel" data-k="${esc(e.id)}" aria-label="消す">🗑</button></div>`).join('')
  :`<div class="card muted empty"><img src="img/chibi_sleep.webp" alt="" width="120">まだ返事はありません。上のボタンからアキラちゃんに相談すると、届いた返事がここにたまります。</div>`;
 h+=`<div class="row"><button class="sub" onclick="aiExport()">AIに頼む用に書き出す</button><label class="btnlike sub">答えのファイルを読み込む<input type="file" accept=".json" hidden onchange="aiImport(event)"></label></div>`;
 return h};

// v16: 開いている答え（保管庫・返事・見本）に対して動くボタン
function aiCur(){return (typeof AT!=='undefined'&&AT.open&&curItem())||AI.res||null}
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.hidden=true;t.setAttribute('role','status');t.style.cssText='position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:#333;color:#fff;padding:10px 16px;border-radius:20px;z-index:9999;font-size:15px;max-width:90%;text-align:center';document.body.appendChild(t)}const bad=/ません|失敗|エラー/.test(msg);t.innerHTML='';const im=document.createElement('img');im.src='img/chibi_'+(bad?'sorry':'happy')+'.webp';im.alt='';const sp=document.createElement('span');sp.textContent=msg;t.append(im,sp);t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,2600)}
function usesOf(i){const out=[];const add=(d,dish)=>{if(typeof d==='string')d=WD.indexOf(d.replace(/曜日?$/,''));if(okWd(d)&&!out.some(u=>u.d===d&&u.dish===dish))out.push({d,dish:String(dish||'').slice(0,100)})};
 const L=i.uses||i.for||i.days;if(isArr(L))L.forEach(u=>isObj(u)?add(u.d!==undefined?u.d:u.day,u.dish||u.name):add(u,i.dish||''));
 if(!out.length&&isStr(i.why))i.why.split(/[・、,]/).forEach(p=>{const m=p.trim().match(/^([日月火水木金土])(?:曜日?)?\s*[：:]\s*(.*)$/);if(m)add(WD.indexOf(m[1]),m[2])});
 return out.slice(0,14)}
function tripForDay(d){const sd=(S.settings.shopDays.length?S.settings.shopDays:[1]).slice().sort((a,b)=>((a+6)%7)-((b+6)%7));const k=(d+6)%7;let t=sd[sd.length-1];sd.forEach(x=>{if((x+6)%7<=k)t=x});return((t+6)%7)<=k?t:sd[sd.length-1]}
function listItemsOf(r){if(!r)return[];let a=r.items||r.list||r.shopping||r.ingredients||[];if(isObj(a))a=Object.values(a).flat();if(!isArr(a))return[];
 return a.map(i=>typeof i==='string'?{name:i}:isObj(i)?i:null).filter(Boolean).map(i=>{const name=String(i.name||i.item||i.title||'').trim().slice(0,200);const uses=usesOf(i);
  return {name,qty:isStr(i.qty)?i.qty.slice(0,50):'',store:String(i.store||i.shop||'').trim().slice(0,100),uses,trip:okWd(i.trip)?i.trip:uses.length?tripForDay(Math.min(...uses.map(u=>u.d),9)===9?uses[0].d:uses.slice().sort((x,y)=>(x.d+6)%7-(y.d+6)%7)[0].d):undefined}}).filter(i=>i.name).map((i,_,all)=>{if(i.trip===undefined){const c={};all.forEach(x=>{if(x.trip!==undefined)c[x.trip]=(c[x.trip]||0)+1});const k=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];if(k!==undefined)i.trip=+k}return i})}
function pushList(items){let ct;try{ct=curTrip(today()).wd}catch(e){}let n=0,sk=0;
 items.forEach(i=>{const trip=i.trip!==undefined?i.trip:ct;const ex=S.list.find(x=>!x.done&&x.name===i.name&&x.trip===trip);
  if(ex){const u=ex.uses||[];let add=0;(i.uses||[]).forEach(v=>{if(!u.some(w=>w.d===v.d&&w.dish===v.dish)&&u.length<14){u.push(v);add++}});if(u.length)ex.uses=u;sk++;return}
  const o={name:i.name,store:i.store||'',done:false};if(i.qty)o.qty=i.qty;if(trip!==undefined)o.trip=trip;if(i.uses&&i.uses.length)o.uses=i.uses;S.list.push(o);n++});save();return[n,sk]}
function aiToList(){try{const it=listItemsOf(aiCur());if(!it.length)return toast('入れられる品物が見つかりませんでした');const[n,sk]=pushList(it);toast(`買い物リストに${n}品入れました`+(sk?`（すでにある${sk}品は除外）`:''));render()}catch(e){alert('リストに入れられませんでした：'+e.message)}}
function aiIngToList(){try{const r=aiCur(),rc=r&&(r.kind==='recipe'?r:r.recipe);const it=listItemsOf(rc&&{items:rc.ingredients});const ds=[];menuArr().forEach((m,d)=>{if(rc&&findRecipe&&String(m).split(/[・、,]/).some(x=>findRecipe(x.trim())&&x.includes(rc.name.replace(/[（(].*$/,''))))ds.push(d)});if(ds.length)it.forEach(i=>{i.uses=ds.map(d=>({d,dish:rc.name.slice(0,100)}));i.trip=tripForDay(ds[0])});if(!it.length)return toast('材料が見つかりませんでした');const[n,sk]=pushList(it);toast(`材料を${n}品リストに入れました`+(sk?`（すでにある${sk}品は除外）`:''));render()}catch(e){alert('リストに入れられませんでした：'+e.message)}}
function aiToMenu(){try{const r=aiCur();if(!r||!isArr(r.plan))return toast('献立が見つかりませんでした');let n=0;r.plan.forEach(l=>{const m=String(l).match(/^\s*([日月火水木金土])(?:曜日?)?\s*[：:]\s*(.*)$/);if(m){setMenu(WD.indexOf(m[1]),m[2]);n++}});
 if(isArr(r.days))r.days.forEach(x=>{if(isObj(x)){const d=typeof x.d==='string'?WD.indexOf(x.d):x.d;if(okWd(d)&&isArr(x.dishes)){setMenu(d,x.dishes.map(y=>isObj(y)?y.name:y).filter(isStr).join('・'));n++}}});
 if(isArr(r.prep))S.prep=r.prep.join('\n');
 let items=[];const sh=r.shop||r.items;(isArr(sh)?sh:[sh]).forEach(x=>{if(isObj(x)&&!x.name)items=items.concat(listItemsOf(x));else if(x)items=items.concat(listItemsOf({items:[x]}))});
 if(isArr(r.days))r.days.forEach(x=>isObj(x)&&isArr(x.dishes)&&x.dishes.forEach(y=>{if(isObj(y)&&isArr(y.buy)){const d=typeof x.d==='string'?WD.indexOf(x.d):x.d;items=items.concat(listItemsOf({items:y.buy.map(b=>Object.assign(isObj(b)?b:{name:b},{uses:[{d,dish:y.name}]}))}))}}));
 if(!items.length&&AT.open&&AT.open!=='demo'){const me=hist().find(e=>e.id===AT.open);if(me){const t0=Date.parse(me.at);hist().filter(e=>e.item.kind==='shop'&&Math.abs(Date.parse(e.at)-t0)<600000).reverse().forEach(e=>items=items.concat(listItemsOf(e.item)))}}
 if(!items.length&&typeof INBOX!=='undefined'){const ks=[];INBOX.forEach(e=>{if(!e.err&&isObj(e.item)&&e.item.kind==='shop'){items=items.concat(listItemsOf(e.item));histAdd(e.item,'reply');ks.push(e.key)}});if(ks.length&&typeof dropInbox==='function')setTimeout(()=>dropInbox(ks),0)}
 try{linkMenu()}catch(x){}save();let msg=`献立タブに${n}日分入れました`;if(items.length){const[k,sk]=pushList(items);msg+=`・買い物リストに${k}品`+(sk?`（${sk}品は既存にまとめ）`:'')}toast(msg);render()}catch(e){alert('献立に入れられませんでした：'+e.message)}}
