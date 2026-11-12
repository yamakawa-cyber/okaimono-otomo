# v66：冷蔵庫点検（タップで複数選択→まとめて消す）  python3 test/v66_fridgecheck_test.py [公開フォルダ] [画像の置き場]
import sys,os,subprocess,time,socket,json
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__))));SHOT=sys.argv[2] if len(sys.argv)>2 else '/tmp/v66'
os.makedirs(SHOT,exist_ok=True)
_s=socket.socket();_s.bind(('127.0.0.1',0));PORT=_s.getsockname()[1];_s.close();U=f'http://127.0.0.1:{PORT}/'
srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'-b','127.0.0.1','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
ng=0
def ok(c,m):
  global ng;print(('OK ' if c else 'NG ')+m);ng+=0 if c else 1
FR=[{'id':'a1','name':'牛乳','zone':'ドアポケット'},{'id':'a2','name':'豚こま','zone':'チルド','amt':'200g'},{'id':'a3','name':'にんじん','zone':'野菜室'},{'id':'a4','name':'キャベツ','zone':'野菜室'},
 {'id':'a5','name':'冷凍うどん','zone':'冷凍室'},{'id':'a6','name':'ツナ缶','zone':'保存棚1'},{'id':'a7','name':'パスタ','zone':'保存棚2'},{'id':'a8','name':'じゃがいも','zone':'倉庫','kind':'食材'},{'id':'a9','name':'玉子','zone':'冷蔵室'}]
st={'version':2,'settings':{'shopDays':[1,4],'fridgeDay':0,'perTrip':9000,'monthly':100000,'region':'mukonoso','aiRelay':''},'list':[],'spend':[],'fridge':FR,'menu':['']*7,'prep':'','userStores':[]}
stored=lambda pg:pg.evaluate("()=>JSON.parse(localStorage.getItem('okaimono_v1')).fridge.map(f=>f.id)")
press=lambda pg,i:pg.get_attribute(f'[data-ck="{i}"]','aria-pressed')
def start(pg):
  pg.goto(U+'?today=2026-11-12');pg.evaluate("d=>{localStorage.clear();localStorage.setItem('okaimono_v1',JSON.stringify(d))}",st);pg.goto(U+'?today=2026-11-12#stock');pg.reload();pg.wait_for_timeout(800)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);pg=b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  start(pg)
  # 位置：「手で入れる」のカードのすぐ下
  pos=pg.evaluate("""()=>{const c=[...document.querySelectorAll('#view .card')].find(x=>x.innerText.includes('手で入れる'));const n=c&&c.nextElementSibling;return n?n.innerText:''}""")
  ok('冷蔵庫点検' in pos,'「手で入れる」のすぐ下に冷蔵庫点検ボタン '+pos[:30])
  ok('📦 倉庫' in pg.inner_text('#view') and pg.query_selector('input[data-whid]') is not None,'倉庫の一覧（チェックで選ぶ既存UI）はそのまま')
  pg.click('text=冷蔵庫点検');pg.wait_for_timeout(300);t=pg.inner_text('#view')
  ok('✅ 冷蔵庫点検' in t,'点検画面がひらく')
  ok(pg.query_selector('#view .ckz input[type=checkbox]') is None,'点検画面にチェックボックスはない')
  zs=pg.eval_on_selector_all('.ckzh b','e=>e.map(x=>x.innerText)');ok(len(zs)==8 and '🚪 ドアポケット' in zs and '🪵 保存棚1' in zs and '📦 倉庫' in zs,'場所ごとに分けて全部出る '+str(zs))
  ok(all(press(pg,i)=='false' for i in ['a1','a3']) and 'まだ選んでいません' in t,'最初はだれも選ばれていない')
  ok(pg.is_disabled('button.ckdel'),'選ぶまで「まとめて消す」は押せない')
  bg0=pg.eval_on_selector('[data-ck="a3"]','e=>getComputedStyle(e).backgroundColor')
  pg.tap('[data-ck="a3"]');pg.tap('[data-ck="a6"]');pg.wait_for_timeout(200)
  bg1=pg.eval_on_selector('[data-ck="a3"]','e=>getComputedStyle(e).backgroundColor');bd=pg.eval_on_selector('[data-ck="a3"]','e=>getComputedStyle(e).borderTopWidth')
  ok(press(pg,'a3')=='true' and press(pg,'a6')=='true','タップで選ぶ（aria-pressed=true）')
  ok(bg0!=bg1 and bd=='3px','選ぶと背景色と枠が変わる '+bg0+'→'+bg1+' 枠'+bd)
  ok('2品' in pg.inner_text('.ckcount'),'選んだ数が出る（2品）')
  pg.tap('[data-ck="a6"]');pg.wait_for_timeout(150);ok(press(pg,'a6')=='false' and '1品' in pg.inner_text('.ckcount'),'もう一度タップで外れる')
  pg.click('[data-ckz="野菜室"]');pg.wait_for_timeout(150);ok(press(pg,'a3')=='true' and press(pg,'a4')=='true','場所ごとに「ぜんぶ選ぶ」')
  pg.click('[data-ckz="野菜室"]');pg.wait_for_timeout(150);ok(press(pg,'a3')=='false' and press(pg,'a4')=='false','場所ごとに「ぜんぶ外す」')
  pg.click('.ckbar >> text=ぜんぶ選ぶ');pg.wait_for_timeout(150);ok('9品' in pg.inner_text('.ckcount'),'全体の「ぜんぶ選ぶ」')
  pg.click('.ckbar >> text=ぜんぶ外す');pg.wait_for_timeout(150);ok('まだ選んでいません' in pg.inner_text('.ckcount'),'全体の「ぜんぶ外す」')
  small=pg.evaluate("()=>[...document.querySelectorAll('#view button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height<44}).map(e=>e.innerText+':'+Math.round(e.getBoundingClientRect().height))")
  ok(not small,'ボタンはすべて高さ44px以上 '+str(small[:3]))
  sw=pg.evaluate('document.documentElement.scrollWidth');ok(sw<=390,f'横にはみ出さない（{sw}px）')
  # やめる → 変化なし
  pg.tap('[data-ck="a1"]');pg.tap('[data-ck="a8"]');pg.click('text=やめる（変えずにもどる）');pg.wait_for_timeout(300)
  ok(len(stored(pg))==9 and pg.query_selector('.ckbar') is None,'やめると何も消えずにもどる')
  # まとめて消す（確認でキャンセル → 消えない）
  pg.click('text=冷蔵庫点検');pg.wait_for_timeout(200);ok('まだ選んでいません' in pg.inner_text('.ckcount'),'もう一度ひらくと選択はリセット')
  for i in ['a1','a2','a7','a8']:pg.tap(f'[data-ck="{i}"]')
  pg.wait_for_timeout(150);pg.screenshot(path=f'{SHOT}/check_selected.png',full_page=True)
  msgs=[];pg.once('dialog',lambda d:(msgs.append(d.message),d.dismiss()));pg.click('button.ckdel');pg.wait_for_timeout(200)
  ok(len(stored(pg))==9 and msgs and '4品' in msgs[0],'確認で「キャンセル」なら消えない '+(msgs[0].split(chr(10))[0] if msgs else ''))
  pg.once('dialog',lambda d:d.accept());pg.click('button.ckdel');pg.wait_for_timeout(300)
  s=stored(pg);ok(sorted(s)==['a3','a4','a5','a6','a9'],'確認でOK → 選んだ4品だけ消える（倉庫の品も）'+str(s))
  ok(pg.query_selector('.ckbar') is None and '4品を消しました' in pg.inner_text('#undos'),'消したあと点検は閉じ、元に戻すのお知らせ '+pg.inner_text('#undos')[:40])
  pg.click('#undos button');pg.wait_for_timeout(300);ok(len(stored(pg))==9,'「元に戻す」で9品にもどる')
  # 点検中にほかのタブへ行くと点検は終わる
  pg.click('text=冷蔵庫点検');pg.tap('[data-ck="a9"]');pg.goto(U+'?today=2026-11-12#home');pg.wait_for_timeout(200);pg.goto(U+'?today=2026-11-12#stock');pg.wait_for_timeout(400)
  ok(pg.query_selector('.ckbar') is None and len(stored(pg))==9,'ほかのタブへ行くと点検は終わる（消えない）')
  # 冷蔵庫の通常の品タップ（移動・消す）はそのまま
  pg.click('[data-fr="a5"]');pg.wait_for_timeout(200);ok(pg.query_selector('.frsel') is not None,'ふだんの品タップ（移動・量・消す）はそのまま')
  pg.screenshot(path=f'{SHOT}/stock_top.png')
  ok(not errs,'ページのエラーなし '+str(errs[:3]))
  b.close()
finally:
 srv.terminate()
print('NG',ng);sys.exit(1 if ng else 0)
