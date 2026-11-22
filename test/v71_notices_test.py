# v71：期間限定のお知らせ（from・until）。python3 tests/v71_notices_test.py [公開フォルダ] [画像の置き場] [保存キー]
import sys,os,subprocess,time,socket,json
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),'..','out','akira'))
SHOT=sys.argv[2] if len(sys.argv)>2 else '/tmp/v71'
KEY=sys.argv[3] if len(sys.argv)>3 else 'okaimono_v1'
os.makedirs(SHOT,exist_ok=True)
_s=socket.socket();_s.bind(('127.0.0.1',0));PORT=_s.getsockname()[1];_s.close();U=f'http://127.0.0.1:{PORT}/'
srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'-b','127.0.0.1','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
ng=0
def ok(c,m):
  global ng;print(('OK ' if c else 'NG ')+m);ng+=0 if c else 1
def st(region='mukonoso'):
  return {'version':2,'settings':{'shopDays':[1,4],'fridgeDay':0,'perTrip':9000,'monthly':100000,'region':region,'aiRelay':''},'list':[],'spend':[],'fridge':[],'menu':['']*7,'prep':'','userStores':[]}
def open_stores(pg,day,region='mukonoso'):
  pg.goto(U+f'?today={day}');pg.evaluate("({d,k})=>{localStorage.clear();localStorage.setItem(k,JSON.stringify(d))}",{'d':st(region),'k':KEY})
  pg.goto(U+f'?today={day}#stores');pg.reload();pg.wait_for_timeout(900)
  return pg.inner_text('#view')
def card(pg,name):
  return pg.eval_on_selector_all('.card',"""(els,name)=>{const e=els.find(x=>x.innerText.includes(name));return e?e.innerText:''}""",name)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto(U+'?today=2026-11-22');pg.wait_for_timeout(700)
  # 関数：日付の前後で出る・消える
  r=pg.evaluate("""()=>{
    const d=t=>new Date(t+'T12:00');
    const h=(x,t)=>noticeHit(x,d(t));
    const badUntil=h({text:'x',until:'あとで'},'2026-12-01');
    return {
      always: h({text:'常時'},'2026-01-01') && h({text:'常時'},'2027-12-31'),
      noText: noticeHit({until:'2026-11-30'},d('2026-11-30')),
      untilOn: h({text:'x',until:'2026-11-30'},'2026-11-30'),
      untilAfter: h({text:'x',until:'2026-11-30'},'2026-12-01'),
      untilBefore: h({text:'x',until:'2026-11-30'},'2026-11-29'),
      fromBefore: h({text:'x',from:'2026-11-20'},'2026-11-19'),
      fromOn: h({text:'x',from:'2026-11-20'},'2026-11-20'),
      rangeIn: h({text:'x',from:'2026-11-20',until:'2026-11-30'},'2026-11-20') && h({text:'x',from:'2026-11-20',until:'2026-11-30'},'2026-11-25') && h({text:'x',from:'2026-11-20',until:'2026-11-30'},'2026-11-30'),
      rangeOut: h({text:'x',from:'2026-11-20',until:'2026-11-30'},'2026-11-19') || h({text:'x',from:'2026-11-20',until:'2026-11-30'},'2026-12-01'),
      badUntil,
      listOn: noticeList({note:'常設',notices:[{text:'期限',until:'2026-11-30'},{text:'開始前',from:'2026-12-01'}]},d('2026-11-30')),
      listAfter: noticeList({note:'常設',notices:[{text:'期限',until:'2026-11-30'},{text:'開始前',from:'2026-12-01'}]},d('2026-12-01')),
      empty: noticeList({note:'',notices:[]},d('2026-11-22')),
      noField: noticeList({},d('2026-11-22'))
    }
  }""")
  ok(r['always'] and r['noText'] is False,'日付なしは出す・textのないものは出さない')
  ok(r['untilOn'] and r['untilBefore'] and r['untilAfter'] is False,'until の当日までは出し、翌日は出さない')
  ok(r['fromOn'] and r['fromBefore'] is False,'from の当日からは出し、前日は出さない')
  ok(r['rangeIn'] and r['rangeOut'] is False,'from〜until の範囲（両端含む）だけ出す')
  ok(r['badUntil'] is True,'until が日付として読めないときは、終了日なしと同じく出す')
  ok(r['listOn']==['常設','期限'] and r['listAfter']==['常設','開始前'],'常設noteは残り、期間ものは日付で入れ替わる '+str(r['listOn'])+' / '+str(r['listAfter']))
  ok(r['empty']==[] and r['noField']==[],'note も notices もないときは空')

  stores=pg.evaluate('()=> (BASE.stores||[]).map(s=>({id:s.id,name:s.name,note:s.note||"",notices:s.notices||[]}))')
  builtin= {s['id']:s for s in stores}
  has_data= 's15' in builtin and 'x028' in builtin and 'x132' in builtin and 's02' in builtin
  ok(True if KEY!='okaimono_v1' or has_data else has_data, '組み込み店のデータがある（アキラ版）' if KEY=='okaimono_v1' else 'ライフハック版は組み込み店なしでも関数試験は実施')

  if has_data:
    # 実データ：お店カードの表示
    open_stores(pg,'2026-11-30','nishinomiya')
    t=card(pg,'万代 西宮熊野店')
    ok('11/30(月)は棚卸のため全店20:00閉店' in t,'万代：11/30（until当日）は棚卸のお知らせを出す')
    sw=pg.evaluate('document.documentElement.scrollWidth');ok(sw<=390,f'お店欄 11/30 横にはみ出さない（{sw}px）')
    pg.screenshot(path=f'{SHOT}/stores_1130_mandai.png',full_page=False)
    el=pg.query_selector('.card'); 
    # 熊野店 is first by dist in nishinomiya supers
    if el: el.screenshot(path=f'{SHOT}/card_mandai_1130.png')

    open_stores(pg,'2026-12-01','nishinomiya')
    t=card(pg,'万代 西宮熊野店')
    ok('棚卸' not in t and '20:00閉店' not in t,'万代：12/1（untilの翌日）はお知らせを出さない')
    pg.screenshot(path=f'{SHOT}/stores_1201_mandai.png',full_page=False)

    open_stores(pg,'2026-12-01','itami')
    t=card(pg,'万代 伊丹野間店')
    ok('伊丹寄り。' in t or '伊丹寄り' in t,'万代伊丹野間店：常設の「伊丹寄り。」は期限後も残る')
    ok('棚卸' not in t and '20:00閉店' not in t,'万代伊丹野間店：12/1 は棚卸のお知らせを出さない')

    open_stores(pg,'2026-11-30','itami')
    t=card(pg,'万代 伊丹野間店')
    ok('伊丹寄り' in t and '11/30(月)は棚卸のため全店20:00閉店' in t,'万代伊丹野間店：11/30 は常設と棚卸の両方を出す')

    t=card(pg,'万代 伊丹荒牧店')
    # may need scroll; card() searches all .card
    if not t:
      # 荒牧 is farther; still in 15 supers, should be on page
      pass
    t=card(pg,'万代 伊丹荒牧店')
    ok('公式ページで確認' in t and '11/30(月)は棚卸のため全店20:00閉店' in t,'万代伊丹荒牧店：常設メモと棚卸の両方')

    open_stores(pg,'2026-12-03','amagasaki')
    t=card(pg,'オーケー 南武庫之荘店')
    ok('12/3(木)は棚卸のため20:00閉店' in t,'オーケー南武庫之荘店：12/3（until当日）は出す')
    sw=pg.evaluate('document.documentElement.scrollWidth');ok(sw<=390,f'お店欄 12/3 横にはみ出さない（{sw}px）')
    pg.screenshot(path=f'{SHOT}/stores_1203_ok.png',full_page=False)

    open_stores(pg,'2026-12-04','amagasaki')
    t=card(pg,'オーケー 南武庫之荘店')
    ok('棚卸' not in t and '20:00閉店' not in t,'オーケー南武庫之荘店：12/4 は出さない')

    open_stores(pg,'2026-11-24','nishinomiya')
    t=card(pg,'業務スーパー 西宮越水店')
    ok('11/24(火)は棚卸のため9:00〜18:00' in t,'業務スーパー西宮越水店：11/24（until当日）は出す')

    open_stores(pg,'2026-11-25','nishinomiya')
    t=card(pg,'業務スーパー 西宮越水店')
    ok('棚卸' not in t and '9:00〜18:00' not in t,'業務スーパー西宮越水店：11/25 は出さない')

    open_stores(pg,'2026-12-31','mukonoso')
    t=card(pg,'サンディ 武庫之荘店')
    ok('ディスカウント' in t,'常設の備考（サンディ）は日付に関係なく出す')

  # 自分で足した店の note（終了日なし）は今までどおり出す
  open_stores(pg,'2026-12-31','mukonoso' if has_data else '')
  if not has_data:
    # ライフハックは地域が空のことがあるので、お店追加だけ試す
    pg.goto(U+'?today=2026-12-31#stores');pg.evaluate("({d,k})=>{localStorage.clear();localStorage.setItem(k,JSON.stringify(d))}",{'d':st(''),'k':KEY})
    pg.goto(U+'?today=2026-12-31#stores');pg.reload();pg.wait_for_timeout(900)
  # add user store with notices via localStorage to test userStores path
  pg.evaluate("""k=>{
    const raw=JSON.parse(localStorage.getItem(k)||'{}');
    raw.userStores=[{id:'u_n1',name:'テスト商店',user:true,type:'super',region:raw.settings&&raw.settings.region||'',note:'いつもの備考',notices:[{text:'明日までのお知らせ',until:'2026-12-01'},{text:'これから',from:'2027-01-01'}]}];
    localStorage.setItem(k,JSON.stringify(raw));
  }""",KEY)
  pg.goto(U+'?today=2026-12-01#stores');pg.reload();pg.wait_for_timeout(900)
  t=card(pg,'テスト商店')
  ok('いつもの備考' in t and '明日までのお知らせ' in t and 'これから' not in t,'自分の店：until当日は出し、from前は出さない')
  pg.goto(U+'?today=2026-12-02#stores');pg.reload();pg.wait_for_timeout(900)
  t=card(pg,'テスト商店')
  ok('いつもの備考' in t and '明日までのお知らせ' not in t,'自分の店：until翌日は期間お知らせを消す')
  sw=pg.evaluate('document.documentElement.scrollWidth');ok(sw<=390,f'自分の店の表示も横にはみ出さない（{sw}px）')
  pg.screenshot(path=f'{SHOT}/stores_user.png',full_page=False)

  ok(not errs,'ページのエラーなし '+str(errs[:3]))
  b.close()
finally:
 srv.terminate()
print('NG',ng);sys.exit(1 if ng else 0)
