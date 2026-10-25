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
  <div class="row"><button class="sub" onclick="AI.res.plan.forEach(l=>{const m=l.match(/^([日月火水木金土])：(.*)$/);if(m)setMenu(WD.indexOf(m[1]),m[2])});S.prep=AI.res.prep.join('\\n');save();alert('献立タブに入れました')">献立タブに入れる</button></div></div>
  <div class="card">${badge()}<b>🍳 ${esc(r.recipe.name)}</b> <span class="muted">${esc(r.recipe.serves)}・${esc(r.recipe.time)}</span><div class="row"><button onclick="AI.lesson=true;AI.step=0;render()">レッスンを始める（${r.recipe.steps.length}ステップ）</button></div></div>`}
 if(r.kind==='shop'){const t=r.items.reduce((a,i)=>a+i.yen,0);return `<div class="card">${badge()}<b>${esc(r.title)}</b><div class="muted">${esc(r.note)}</div><table>${r.items.map(i=>`<tr><td>${esc(i.name)}<div class="muted">${esc(i.store)}・${esc(i.why)}</div></td><td>${yen(i.yen)}</td></tr>`).join('')}</table>
  <div>合計の目安 ${yen(t)} / 予算 ${yen(r.budget)} ${t<=r.budget?'✅':'⚠️'}</div><div class="row"><button onclick="AI.res.items.forEach(i=>S.list.push({name:i.name,store:i.store,done:false}));save();alert('買い物リストに入れました')">買い物リストに入れる</button></div></div>`}
 if(r.kind==='money')return `<div class="card">${badge()}<b>${esc(r.title)}</b><div>合計 ${yen(r.total)} / ${yen(r.monthly)}</div>${bar(r.total,r.monthly)}<table>${Object.entries(r.byCat).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${yen(v)}</td></tr>`).join('')}</table><b>節約のアドバイス</b><ol>${r.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`;
 if(r.kind==='hacks')return `<div class="card">${badge()}<b>${esc(r.title)}</b>${r.items.map(i=>`<div class="hack"><span class="tag">${esc(i.about)}</span> ${esc(i.tip)}</div>`).join('')}</div>`;
 if(r.kind==='advise')return `<div class="card">${badge()}<b>${esc(r.title)}</b><p>${esc(r.summary)}</p><b>必要なこと</b><ul>${r.needs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><b>進め方</b><ol>${r.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="muted">費用：${esc(r.cost)}</div></div>`;
 return ''}
function lessonView(rc){const n=rc.steps.length,i=AI.step;
 if(i<0)return '';const head=`<div class="card">${badge()}<b>🍳 ${esc(rc.name)}</b> <span class="muted">${esc(rc.serves)}・${esc(rc.time)}</span><div class="bar"><div style="width:${(i+1)/(n+1)*100}%"></div></div></div>`;
 if(i===0&&!AI.started)return head+`<div class="card lesson"><h2>まずは材料をそろえよう</h2><ul class="chk">${rc.ingredients.map(x=>`<li><input type="checkbox"><span>${esc(x)}</span></li>`).join('')}</ul><div class="row"><button class="sub" onclick="AI.lesson=false;render()">もどる</button><button onclick="AI.started=true;render()">そろった！始める</button></div></div>`;
 const s=rc.steps[i];
 return head+`<div class="card lesson"><div class="muted">ステップ ${i+1} / ${n}（約${s.min}分）</div><h2>${esc(s.t)}</h2><p class="big">${esc(s.d)}</p><div class="tip">💡 ${esc(s.tip)}</div>
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
 if(r.kind==='receipt')return rcImport(r);if(r.kind==='chat'){AI.mode='chat';AI.chat.push({t:r.reply})}else{AI.res=r;AI.mode=r.kind;AI.lesson=false;AI.started=false;AI.step=0}location.hash='#ai';render()})
 .catch(e=>alert('読めませんでした：'+e.message)).finally(()=>{inp.value=''})}
