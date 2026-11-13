# v67：返事待ちの数え方（返事が届いた分・1日たった分は数えない／取り消し／つながらなかった送信は待ちにしない）
import sys,os,subprocess,time,socket,json
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(sys.argv[1]);_s=socket.socket();_s.bind(('127.0.0.1',0));PORT=_s.getsockname()[1];_s.close();U=f'http://127.0.0.1:{PORT}/'
srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'-b','127.0.0.1','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
ng=0
def ok(c,m):
  global ng;print(('OK ' if c else 'NG ')+m);ng+=0 if c else 1
H=3600e3;now=time.time()*1000
P=[{'id':'cbotpush1','type':'bot','at':now},
   {'id':'cfresh00001','type':'receipt','at':now-1*H},
   {'id':'cgot000001','type':'receipt','at':now-3*H,'got':now-2*H},
   {'id':'ctaken00001','type':'chat','at':now-20*H,'taken':1,'tk':now-19*H},
   {'id':'cday2000001','type':'chat','at':now-30*H},
   {'id':'cold4000001','type':'menu','at':now-4*24*H},
   {'id':'ctk3000001','type':'receipt','at':now-80*H,'taken':2,'tk':now-60*H}]
SPEND=[{'id':'s1','date':'2026-11-13','store':'ローソン','cat':'おやつ・飲み物','amount':730,'memo':'レシート','rc':'x'}]
st={'version':2,'settings':{'shopDays':[1,4],'fridgeDay':0,'perTrip':9000,'monthly':100000,'region':'mukonoso','aiRelay':''},'list':[],'spend':SPEND,'fridge':[],'menu':['']*7,'prep':'','userStores':[]}
REPLIES={'replies':[]};POST={'status':200,'body':{'ok':True}};posted=[]
def relay(route):
  u=route.request.url
  if '/replies' in u:return route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body=json.dumps(REPLIES))
  if '/ack' in u or '/ledger' in u:return route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body='{"ok":true}')
  posted.append(u);return route.fulfill(status=POST['status'],headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body=json.dumps(POST['body']))
pend=lambda pg:pg.evaluate("()=>JSON.parse(localStorage.getItem('okaimono_pending')||'[]')")
def btn(pg):
  e=pg.query_selector('text=/返事を確かめる/');return e.inner_text() if e else ''
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.route('https://relay.example/**',relay)
  pg.goto(U);pg.evaluate("([d,p])=>{localStorage.clear();localStorage.setItem('okaimono_v1',JSON.stringify(d));localStorage.setItem('okaimono_secret',JSON.stringify({url:'https://relay.example/',key:'k',header:'X-App-Pass'}));localStorage.setItem('okaimono_pending',JSON.stringify(p))}",[st,P]);pg.goto(U+'#home');pg.reload();pg.wait_for_timeout(1200)
  ids=[x['id'] for x in pend(pg)]
  ok('cold4000001' not in ids and 'ctk3000001' not in ids,'3日以上前の返事なし・2日以上前に受け取った分は自動で消える '+str(ids))
  ok('cfresh00001' in ids and 'cday2000001' in ids and 'cgot000001' in ids and 'cbotpush1' in ids,'残すべき分（新しい・受け取り直後・差し入れ箱）は残る')
  pg.click('[data-act=consult]');pg.wait_for_timeout(300)
  t=btn(pg);ok('返事待ち 1件' in t,'数えるのは本当に待っている1件だけ: '+t)
  pg.click('summary:has-text("返事待ちの中身")');pg.wait_for_timeout(200);v=pg.inner_text('#view')
  ok('レシート読み取り' in v and '送信' in v,'中身（種類・送った時刻）が見える')
  REPLIES['replies']=[{'id':'cfresh00001','off':0,'items':[{'kind':'receipt','store':'テスト店','date':'2026-11-13','items':[{'name':'牛乳','price':200,'category':'食材・米'}],'total':200}]}]
  pg.click('text=/返事を確かめる/');pg.wait_for_timeout(800)
  pe=[x for x in pend(pg) if x['id']=='cfresh00001'][0]
  ok(pe.get('got',0)>0,'返事が届いたら got が付く')
  ok('返事待ち' not in btn(pg),'返事が届いたら返事待ちに数えない: '+btn(pg))
  ok('テスト店' in pg.inner_text('#view'),'届いた返事は返事の箱に出る')
  # 取り消し
  REPLIES['replies']=[]
  pg.evaluate("()=>{const a=JSON.parse(localStorage.getItem('okaimono_pending'));a.push({id:'cnew0000001',type:'chat',at:Date.now()},{id:'cnew0000002',type:'menu',at:Date.now()});localStorage.setItem('okaimono_pending',JSON.stringify(a));render()}");pg.wait_for_timeout(200)
  ok('返事待ち 2件' in btn(pg),'新しく2件待ち: '+btn(pg))
  pg.click('summary:has-text("返事待ちの中身")');pg.wait_for_timeout(200)
  pg.click('.waitlist button:has-text("取り消す") >> nth=0');pg.wait_for_timeout(200)
  ok('返事待ち 1件' in btn(pg),'1件取り消せる: '+btn(pg))
  pg.evaluate("()=>{const a=JSON.parse(localStorage.getItem('okaimono_pending'));a.push({id:'cnew0000003',type:'chat',at:Date.now()});localStorage.setItem('okaimono_pending',JSON.stringify(a));render()}");pg.wait_for_timeout(200)
  pg.on('dialog',lambda d:d.accept())
  if not pg.query_selector('.waitlist[open]'):pg.click('summary:has-text("返事待ちの中身")')
  pg.click('text=全部取り消す');pg.wait_for_timeout(200)
  ids=[x['id'] for x in pend(pg)]
  ok('返事待ち' not in btn(pg) and 'cbotpush1' in ids and 'cfresh00001' in ids,'全部取り消しても差し入れ箱と受け取り済みは残る '+str(ids))
  sp=pg.evaluate("()=>JSON.parse(localStorage.getItem('okaimono_v1')).spend.length");ok(sp==1,'家計簿は消えない')
  # 送信：つながらなかった504は待ちにしない
  def send(q):
    if pg.query_selector('#c_qe'):pg.fill('#c_qe',q)
    else:pg.fill('#c_q',q);pg.select_option('#c_type','chat');pg.click('button:has-text("送る")');pg.wait_for_timeout(300)
    pg.click('text=この内容で送信');pg.wait_for_timeout(1200)
  n0=len(pend(pg));POST.update(status=504,body={'ok':False,'error':'hook down','message':'受け取り先につながりませんでした','id':''})
  send('テストその1');v=pg.inner_text('#view')
  ok(len(pend(pg))==n0 and 'つながりませんでした' in v,'受け取り側につながらなかった送信は返事待ちに入れない')
  POST.update(status=504,body={'ok':False,'error':'hook timeout','message':'時間内に応答しませんでした','id':''})
  send('テストその2');v=pg.inner_text('#view');ok(len(pend(pg))==n0+1 and '届いたか確認中' in v,'時間切れ（届いたかも）は返事待ちに入れる %d→%d'%(n0,len(pend(pg))))
  pg.click('text=もどる');pg.wait_for_timeout(200);ok('返事待ち 1件' in btn(pg),'入力画面に戻ると返事待ち1件: '+btn(pg))
  POST.update(status=200,body={'ok':True})
  ok(not errs,'ページのエラーなし '+str(errs))
  b.close()
finally:srv.kill()
print('NG',ng);sys.exit(1 if ng else 0)
