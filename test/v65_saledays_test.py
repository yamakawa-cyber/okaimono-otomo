# v65：決まった特売日（お店欄）と、ホームの「きょうの特売日」  python3 test/v65_saledays_test.py [公開フォルダ] [画像の置き場]
import sys,os,subprocess,time,socket
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__))));SHOT=sys.argv[2] if len(sys.argv)>2 else '/tmp/v65'
os.makedirs(SHOT,exist_ok=True)
_s=socket.socket();_s.bind(('127.0.0.1',0));PORT=_s.getsockname()[1];_s.close();U=f'http://127.0.0.1:{PORT}/'
srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'-b','127.0.0.1','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
ng=0
def ok(c,m):
  global ng;print(('OK ' if c else 'NG ')+m);ng+=0 if c else 1
def home(pg,day,region='mukonoso',extra=None):
  st={'version':2,'settings':{'shopDays':[1,4],'fridgeDay':0,'perTrip':9000,'monthly':100000,'region':region,'aiRelay':''},'list':extra or [],'spend':[],'fridge':[],'menu':['']*7,'prep':'','userStores':[]}
  pg.goto(U+f'?today={day}');pg.evaluate("d=>{localStorage.clear();localStorage.setItem('okaimono_v1',JSON.stringify(d))}",st);pg.goto(U+f'?today={day}#home');pg.reload();pg.wait_for_timeout(900)
  return pg.inner_text('#view')
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  # 木曜 11/12：オオジ（パン大特価・青果均一祭）、マルハチ（商品限定ポイント5倍）、近くの関西スーパー（木金市）
  t=home(pg,'2026-11-12',extra=[{'name':'玉子','store':'スーパーオオジ 武庫之荘北店','done':False}])
  ok('きょうの特売日' in t and '11/12（木）' in t,'ホームに「きょうの特売日（11/12（木））」')
  ok('スーパーオオジ 武庫之荘北店' in t and 'パン大特価・青果均一祭' in t,'木曜：オオジのパン大特価・青果均一祭')
  ok('商品限定ポイント5倍' in t,'木曜：マルハチの商品限定ポイント5倍')
  ok('たまご特売日' not in t.split('あした')[0],'木曜にはたまご特売日（月・金）を出さない')
  ok('関西スーパー 稲野店' in t and '木金市' in t,'近くのほかの地域：関西スーパー稲野店の木金市')
  ok('🛒きょう行く' in t,'買い物リストの店に「きょう行く」')
  first=pg.eval_on_selector('.tsale','e=>e.innerText');ok('オオジ' in first,'きょう行く店がいちばん上')
  ok('あした（11/13（金））' in t and 'スーパーオオジ' in t.split('あした')[1],'あしたの予告（金曜：オオジのたまご特売日）')
  ok(pg.eval_on_selector_all('.tsale a.src','a=>a.length>0 && a.every(x=>x.href.startsWith("https://"))'),'出典リンクつき')
  sw=pg.evaluate('document.documentElement.scrollWidth');ok(sw<=390,f'横にはみ出さない（{sw}px）')
  pg.screenshot(path=f'{SHOT}/home_1112_thu.png',full_page=True)
  # 月曜 11/16：関西スーパー10%引（伊丹地域で表示）、オオジたまご
  t=home(pg,'2026-11-16')
  ok('たまご特売日・鮮魚よりどりセール' in t and 'パンの日' in t,'月曜：オオジのたまご・マルハチのパンの日')
  t=home(pg,'2026-11-16','itami');ok('関西スーパー 稲野店' in t and '本体価格より10%引' in t,'月曜（伊丹）：関西スーパー10%引')
  # 土曜：関西スーパーのSポイント4倍（2027/3/27まで）→ 4/3 は出ない
  t=home(pg,'2026-11-14','itami');ok('Sポイント4倍' in t,'土曜：Sポイント4倍')
  t=home(pg,'2027-04-03','itami');ok('Sポイント4倍' not in t,'期限（2027/3/27）を過ぎた土曜は出さない')
  # 毎月の日付：8日（マルハチ5倍）・15日（オオジ2倍）・1日
  t=home(pg,'2026-12-08');ok('ポイント5倍デー' in t,'毎月8日：マルハチのポイント5倍デー')
  t=home(pg,'2026-11-15');ok('ポイント2倍DAY' in t,'毎月15日：オオジのポイント2倍DAY')
  # 20日：ドラッグストアはまとめて1枚
  t=home(pg,'2026-11-20');ok('💊 ドラッグストア' in t and 'お客様感謝デー' in t,'20日：ドラッグストアはまとめて表示')
  pg.screenshot(path=f'{SHOT}/home_1120_fri.png',full_page=True)
  # 第n曜・月末のルール（ページ内の関数で確かめる）
  r=pg.evaluate("""()=>{const s={sales:[{wd:6,nth:[2,4],text:'第2・4土'},{wd:0,nth:[-1],text:'最終日曜'},{md:[-1],text:'月末'}]};
   const on=d=>salesOn(s,new Date(d+'T12:00')).map(x=>x.text).join(',');
   return {a:on('2026-11-14'),b:on('2026-11-21'),c:on('2026-11-28'),d:on('2026-11-29'),e:on('2026-11-30'),f:on('2027-02-28'),lab:saleText(s)}}""")
  ok(r['a']=='第2・4土' and r['b']=='' and r['c']=='第2・4土','第2・第4土曜の判定 '+str(r))
  ok(r['d']=='最終日曜' and r['e']=='月末' and r['f']=='最終日曜,月末','最終日曜・月末（2月も）の判定')
  ok(r['lab']==['第2・第4土曜：第2・4土','最終日曜：最終日曜','毎月末日：月末'],'ルールの表示名 '+str(r['lab']))
  # 日本時間：端末の時計が UTC 15:30（=日本 0:30 翌日）でも日本の日付
  r=pg.evaluate("""()=>{const R=Date;const fake=new R('2026-11-12T15:30:00Z').getTime();window.Date=class extends R{constructor(...a){a.length?super(...a):super(fake)}static now(){return fake}};const v=jstYmd();window.Date=R;return v}""")
  ok(r=='2026-11-13','日本時間で日付を出す（UTC 11/12 15:30 → 11/13） '+str(r))
  # お店欄
  pg.goto(U+'?today=2026-11-12#stores');pg.wait_for_timeout(700);t=pg.inner_text('#view')
  ok('🏷 決まった特売日' in t and '毎週木曜' in t and '毎月1・15日' in t,'お店欄：曜日・日付と内容の一覧')
  c=pg.eval_on_selector_all('.card','els=>{const e=els.find(x=>x.innerText.includes("スーパーオオジ 武庫之荘北店"));return e?e.innerText:""}')
  ok('きょう' in c and 'トクバイ店舗ページ' in c and '公式「青果ビックリ市」' in c,'オオジのカードに「きょう」印と出典')
  ok('要確認' in t,'確かめられない特売日（フレスコ）は「要確認」')
  ok('まだ確認できていません' in t,'特売日が未確認のスーパーはそう書く')
  sw=pg.evaluate('document.documentElement.scrollWidth');ok(sw<=390,f'お店欄も横にはみ出さない（{sw}px）')
  pg.screenshot(path=f'{SHOT}/stores_1112.png',full_page=False)
  el=pg.query_selector('.card.sale');el.scroll_into_view_if_needed();el.screenshot(path=f'{SHOT}/store_card_oozi.png')
  # 店の追加（ユーザーの店・曜日1つ）が今まで通り
  pg.fill('#ns_name','テスト商店');pg.select_option('#ns_wd','4');pg.fill('#ns_sale','卵');pg.evaluate('addStore()');pg.wait_for_timeout(300)
  pg.goto(U+'?today=2026-11-12#home');pg.wait_for_timeout(700);ok('テスト商店' in pg.inner_text('#view'),'自分で足した店の特売日もホームに出る')
  ok(not errs,'ページのエラーなし '+str(errs[:3]))
  b.close()
finally:
 srv.terminate()
print('NG',ng);sys.exit(1 if ng else 0)
