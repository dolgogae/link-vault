#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist', 'screenshots')
os.makedirs(OUT, exist_ok=True)

KF  = '/System/Library/Fonts/AppleSDGothicNeo.ttc'   # Korean + general
BF  = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'  # English bold
RF  = '/System/Library/Fonts/Supplemental/Arial.ttf'

# Colors
BG    = (10, 3, 22)
SURF  = (28, 10, 52)
SURF2 = (42, 16, 72)
ACC   = (138, 43, 226)
ACCL  = (160, 70, 250)
WHT   = (255, 255, 255)
SEC   = (185, 145, 240)
MUT   = (95, 60, 145)
DIV   = (40, 15, 65)
TAB_C = (15, 5, 30)
CARD  = (30, 11, 56)
SURF3 = (22, 8, 45)

FC = [
    (59, 130, 246),   # blue
    (16, 185, 129),   # green
    (239, 68, 68),    # red
    (251, 146, 60),   # orange
    (168, 85, 247),   # purple
    (236, 72, 153),   # pink
]

FOLDERS = [
    ('개발', 23, 0),
    ('뉴스', 12, 1),
    ('레시피', 15, 2),
    ('쇼핑',  8, 3),
    ('영상', 31, 4),
    ('학습',  7, 5),
]

def fnt(which, size):
    if which == 'k':
        return ImageFont.truetype(KF, size)
    if which == 'b':
        return ImageFont.truetype(BF, size)
    return ImageFont.truetype(RF, size)

def rr(draw, bbox, radius, **kw):
    draw.rounded_rectangle(bbox, radius=radius, **kw)

def gradient(w, h):
    img = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=(
            int(10 + 10*t),
            int(3 + 5*t),
            int(22 + 25*t),
        ))
    return img

def status_bar(draw, w, s):
    draw.text((int(40*s), int(28*s)), '9:41', font=fnt('b', int(26*s)), fill=WHT)
    bx = w - int(44*s)
    by = int(32*s)
    bw, bh = int(44*s), int(20*s)
    rr(draw, [bx-bw, by, bx, by+bh], 4, outline=WHT, width=2)
    draw.rectangle([bx, by+int(5*s), bx+int(4*s), by+int(15*s)], fill=WHT)
    draw.rectangle([bx-bw+3, by+3, bx-int(12*s), by+bh-3], fill=ACCL)
    for i in range(3):
        hh = int((7 + i*6)*s)
        bx2 = bx - bw - int(12*s) - int((2-i)*13*s)
        col = WHT if i == 2 else MUT
        draw.rectangle([bx2, by+bh-hh, bx2+int(8*s), by+bh], fill=col)

def tab_bar(draw, w, h, active, s):
    th = int(90*s)
    y0 = h - th
    draw.rectangle([0, y0, w, h], fill=TAB_C)
    draw.line([0, y0, w, y0], fill=DIV, width=1)
    names = ['홈', '검색', '즐겨찾기', '설정']
    tw = w // 4
    f = fnt('k', int(20*s))
    for i, name in enumerate(names):
        cx = tw*i + tw//2
        cy = y0 + int(14*s)
        col = ACCL if i == active else MUT
        if i == active:
            rr(draw, [cx-int(30*s), cy-int(4*s), cx+int(30*s), cy+int(32*s)], int(18*s), fill=SURF)
        bb = draw.textbbox((0,0), name, font=f)
        nw = bb[2]-bb[0]
        draw.text((cx - nw//2, cy + int(32*s)), name, font=f, fill=col)
        if i == active:
            draw.ellipse([cx-3, h-int(14*s), cx+3, h-int(8*s)], fill=ACCL)

def folder_card(draw, x, y, cw, ch, name, count, cidx, s):
    col = FC[cidx]
    r = int(18*s)
    rr(draw, [x, y, x+cw, y+ch], r, fill=CARD)
    # Colored header
    rr(draw, [x, y, x+cw, y+int(70*s)], r, fill=col)
    draw.rectangle([x, y+r, x+cw, y+int(70*s)], fill=col)
    # Icon circle
    cx, cy = x+int(36*s), y+int(35*s)
    cr = int(21*s)
    light = tuple(min(255, c+80) for c in col)
    draw.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=light)
    f_l = fnt('k', int(22*s))
    lb = draw.textbbox((0,0), name[0], font=f_l)
    draw.text((cx-(lb[2]-lb[0])//2, cy-(lb[3]-lb[1])//2-1), name[0], font=f_l, fill=WHT)
    # Name
    draw.text((x+int(16*s), y+int(78*s)), name, font=fnt('k', int(26*s)), fill=WHT)
    # Count
    draw.text((x+int(16*s), y+int(112*s)), f'{count}개', font=fnt('k', int(20*s)), fill=SEC)

def link_card(draw, x, y, w, title, domain, time_str, cidx, letter, s):
    ch = int(96*s)
    rr(draw, [x, y, x+w, y+ch], int(14*s), fill=CARD)
    isize = int(56*s)
    ix, iy = x+int(14*s), y+int(20*s)
    rr(draw, [ix, iy, ix+isize, iy+isize], int(10*s), fill=FC[cidx])
    f_l = fnt('b', int(20*s))
    lb = draw.textbbox((0,0), letter, font=f_l)
    draw.text(
        (ix+(isize-(lb[2]-lb[0]))//2, iy+(isize-(lb[3]-lb[1]))//2-1),
        letter, font=f_l, fill=WHT
    )
    tx = ix + isize + int(14*s)
    disp = title[:19]+'...' if len(title) > 19 else title
    draw.text((tx, y+int(16*s)), disp, font=fnt('k', int(24*s)), fill=WHT)
    draw.text((tx, y+int(50*s)), domain, font=fnt('k', int(19*s)), fill=SEC)
    draw.text((tx, y+int(70*s)), time_str, font=fnt('k', int(19*s)), fill=MUT)
    # Star
    draw.text((x+w-int(38*s), y+int(14*s)), '★', font=fnt('k', int(24*s)), fill=(80, 40, 120))

# ─────────── SCREEN 1: HOME ───────────
RECENT_LINKS = [
    ('React Native 완전 정복 강의',  'youtube.com',   '방금 전',  4, 'Y'),
    ('2024 맥북 프로 M3 리뷰',       'naver.com',     '5분 전',   0, 'N'),
    ('토마토 파스타 레시피',         'cooking.co.kr', '1시간 전', 2, 'C'),
    ('Nike 에어포스1 여름 세일',     'nike.com',      '어제',     3, 'S'),
    ('TypeScript 고급 패턴 가이드',  'velog.io',      '2일 전',   0, 'T'),
]

def make_home(W, H, cols=2, s=1.0):
    img = gradient(W, H)
    draw = ImageDraw.Draw(img)
    status_bar(draw, W, s)

    # Header
    draw.text((int(36*s), int(72*s)), 'LinkVault', font=fnt('b', int(36*s)), fill=WHT)
    av = int(44*s)
    ax, ay = W-int(36*s)-av, int(72*s)
    draw.ellipse([ax, ay, ax+av, ay+av], fill=ACC)
    draw.text((ax+int(12*s), ay+int(10*s)), '오', font=fnt('k', int(20*s)), fill=WHT)

    # Usage bar
    ub_y = int(132*s)
    ub_x, ub_w = int(36*s), W-int(72*s)
    rr(draw, [ub_x, ub_y, ub_x+ub_w, ub_y+int(46*s)], int(12*s), fill=SURF)
    draw.text((ub_x+int(16*s), ub_y+int(13*s)), '이번 달 저장', font=fnt('k', int(20*s)), fill=SEC)
    pb_x = ub_x + int(130*s)
    pb_y = ub_y + int(19*s)
    pb_w = ub_w - int(210*s)
    rr(draw, [pb_x, pb_y, pb_x+pb_w, pb_y+int(8*s)], 4, fill=DIV)
    rr(draw, [pb_x, pb_y, pb_x+int(pb_w*0.6), pb_y+int(8*s)], 4, fill=ACCL)
    draw.text((ub_x+ub_w-int(72*s), ub_y+int(13*s)), '18 / 30', font=fnt('b', int(20*s)), fill=WHT)

    # ── Folder section ──
    draw.text((int(36*s), int(200*s)), '폴더', font=fnt('k', int(26*s)), fill=WHT)

    pad = int(36*s)
    gap = int(14*s)
    cw  = (W - pad*2 - gap*(cols-1)) // cols
    ch  = int(180*s)   # taller cards
    gy  = int(244*s)
    rows = 3 if cols == 2 else 2
    shown = min(len(FOLDERS), cols * rows)

    for i, (name, count, cidx) in enumerate(FOLDERS[:shown]):
        fx = pad + (i % cols)*(cw+gap)
        fy = gy + (i // cols)*(ch+gap)
        folder_card(draw, fx, fy, cw, ch, name, count, cidx, s)

    # ── Recent section ──
    grid_bottom = gy + rows*(ch+gap) - gap
    sec2_y = grid_bottom + int(32*s)
    draw.text((int(36*s), sec2_y), '최근 저장', font=fnt('k', int(26*s)), fill=WHT)

    lx = int(36*s)
    ly = sec2_y + int(44*s)
    lw = W - int(72*s)
    tab_h = int(90*s)
    card_h = int(96*s)
    card_gap = int(12*s)
    bottom_limit = H - tab_h - int(16*s)

    for title, domain, t, cidx, letter in RECENT_LINKS * 3:  # repeat to fill space
        if ly + card_h > bottom_limit:
            break
        link_card(draw, lx, ly, lw, title, domain, t, cidx, letter, s)
        ly += card_h + card_gap

    # FAB
    fr = int(30*s)
    fx2 = W - int(36*s) - fr
    fy2 = H - tab_h - int(76*s)
    draw.ellipse([fx2-fr, fy2-fr, fx2+fr, fy2+fr], fill=ACCL)
    draw.text((fx2-int(10*s), fy2-int(20*s)), '+', font=fnt('b', int(36*s)), fill=WHT)

    tab_bar(draw, W, H, 0, s)
    return img

# ─────────── SCREEN 2: SAVE MODAL ───────────
def make_save(W, H, s=1.0):
    base = make_home(W, H, cols=2, s=s)
    overlay = Image.new('RGB', (W, H), (0, 0, 0))
    img = Image.blend(base, overlay, alpha=0.55)
    draw = ImageDraw.Draw(img)

    sh = int(490*s)
    sy = H - sh
    rr(draw, [0, sy, W, H], int(26*s), fill=SURF3)
    draw.rectangle([0, sy+int(26*s), W, H], fill=SURF3)
    # Handle
    hw = int(48*s)
    hx = (W - hw)//2
    rr(draw, [hx, sy+int(12*s), hx+hw, sy+int(18*s)], 3, fill=MUT)

    draw.text((int(36*s), sy+int(36*s)), '링크 저장', font=fnt('k', int(28*s)), fill=WHT)

    # URL input
    iy0 = sy + int(88*s)
    rr(draw, [int(36*s), iy0, W-int(36*s), iy0+int(54*s)], int(12*s), fill=SURF)
    draw.text((int(52*s), iy0+int(15*s)), 'youtube.com/watch?v=dQw4w9WgXcQ', font=fnt('k', int(21*s)), fill=SEC)

    # AI result card
    ai_y = iy0 + int(70*s)
    rr(draw, [int(36*s), ai_y, W-int(36*s), ai_y+int(168*s)], int(16*s), fill=SURF)
    rr(draw, [int(36*s), ai_y, W-int(36*s), ai_y+int(5*s)], 0, fill=ACCL)
    draw.text((int(52*s), ai_y+int(18*s)), 'AI 분석 결과', font=fnt('k', int(22*s)), fill=ACCL)

    # Category breadcrumb
    cats = [('영상', 4), ('  ›  ', -1), ('개발', 0), ('  ›  ', -1), ('React', 1)]
    cx2 = int(52*s)
    cy2 = ai_y + int(58*s)
    f_cat = fnt('k', int(29*s))
    for label, cidx in cats:
        col = FC[cidx] if cidx >= 0 else MUT
        draw.text((cx2, cy2), label, font=f_cat, fill=col)
        bb = draw.textbbox((0,0), label, font=f_cat)
        cx2 += bb[2]-bb[0]

    draw.text((int(52*s), ai_y+int(108*s)), 'React Native 완전 정복 2024', font=fnt('k', int(23*s)), fill=SEC)

    # Buttons
    by2 = sy + sh - int(84*s)
    # Cancel
    rr(draw, [int(36*s), by2, int(36*s)+int(170*s), by2+int(54*s)], int(12*s), fill=SURF2)
    draw.text((int(68*s), by2+int(14*s)), '취소', font=fnt('k', int(25*s)), fill=SEC)
    # Save
    sx2 = W - int(36*s) - int(260*s)
    rr(draw, [sx2, by2, sx2+int(260*s), by2+int(54*s)], int(12*s), fill=ACCL)
    draw.text((sx2+int(68*s), by2+int(14*s)), '저장하기', font=fnt('k', int(25*s)), fill=WHT)

    return img

# ─────────── SCREEN 3: SEARCH ───────────
def make_search(W, H, s=1.0):
    img = gradient(W, H)
    draw = ImageDraw.Draw(img)
    status_bar(draw, W, s)

    draw.text((int(36*s), int(72*s)), '검색', font=fnt('k', int(38*s)), fill=WHT)

    # Search bar
    sb_y = int(128*s)
    rr(draw, [int(36*s), sb_y, W-int(36*s), sb_y+int(56*s)], int(28*s), fill=SURF)
    # Search icon
    sx3 = int(66*s); sy3 = sb_y+int(18*s)
    draw.ellipse([sx3, sy3, sx3+int(20*s), sy3+int(20*s)], outline=MUT, width=2)
    draw.line([sx3+int(16*s), sy3+int(16*s), sx3+int(26*s), sy3+int(26*s)], fill=MUT, width=2)
    f_q = fnt('k', int(24*s))
    draw.text((int(100*s), sb_y+int(15*s)), '리액트', font=f_q, fill=WHT)
    qbb = draw.textbbox((0,0), '리액트', font=f_q)
    cur_x = int(100*s) + (qbb[2]-qbb[0]) + int(3*s)
    draw.line([cur_x, sb_y+int(13*s), cur_x, sb_y+int(41*s)], fill=ACCL, width=2)

    draw.text((int(36*s), sb_y+int(70*s)), '"리액트" 검색결과 5개', font=fnt('k', int(21*s)), fill=MUT)

    links_data = [
        ('React Native 완전 정복 강의',  'youtube.com',   '방금 전',  4, 'Y'),
        ('리액트 훅 완벽 가이드',        'blog.naver.com','5분 전',   0, 'N'),
        ('React Query 실전 패턴',        'velog.io',      '2시간 전', 4, 'V'),
        ('리액트 네이티브 성능 최적화',  'medium.com',    '어제',     0, 'M'),
        ('React 공식 문서 - Hooks',      'react.dev',     '3일 전',   1, 'R'),
    ]
    lx = int(36*s)
    ly = sb_y + int(108*s)
    lw = W - int(72*s)
    for title, domain, t, cidx, letter in links_data:
        link_card(draw, lx, ly, lw, title, domain, t, cidx, letter, s)
        ly += int(96*s) + int(12*s)

    tab_bar(draw, W, H, 1, s)
    return img

# ─────────── SCREEN 4: FAVORITES ───────────
def make_favorites(W, H, s=1.0):
    img = gradient(W, H)
    draw = ImageDraw.Draw(img)
    status_bar(draw, W, s)

    draw.text((int(36*s), int(72*s)), '즐겨찾기', font=fnt('k', int(38*s)), fill=WHT)

    favs = [
        ('React Native 완전 정복 강의',  'youtube.com',    '방금 전',  4, 'Y'),
        ('2024 맥북 프로 M3 리뷰',       'naver.com',      '어제',     0, 'N'),
        ('토마토 파스타 레시피',         'cooking.co.kr',  '2일 전',   2, 'C'),
        ('TypeScript 고급 패턴 가이드',  'velog.io',       '3일 전',   0, 'T'),
        ('나이키 에어포스1 세일',        'nike.com',       '1주 전',   3, 'S'),
    ]

    lx = int(36*s)
    ly = int(140*s)
    lw = W - int(72*s)
    for title, domain, t, cidx, letter in favs:
        link_card(draw, lx, ly, lw, title, domain, t, cidx, letter, s)
        ly += int(96*s) + int(12*s)

    tab_bar(draw, W, H, 2, s)
    return img

# ─────────── GENERATE ALL ───────────
specs = [
    # (filename_prefix, W, H, cols, scale)
    ('phone',   1080, 1920, 2, 1.0),
    ('tab7',    1200, 1920, 3, 1.1),
    ('tab10',   1600, 2560, 3, 1.48),
]

for prefix, W, H, cols, s in specs:
    print(f'  [{prefix}] home ...')
    make_home(W, H, cols=cols, s=s).save(f'{OUT}/{prefix}_1_home.png')

    if prefix == 'phone':
        print(f'  [{prefix}] save ...')
        make_save(W, H, s=s).save(f'{OUT}/{prefix}_2_save.png')

    print(f'  [{prefix}] search ...')
    make_search(W, H, s=s).save(f'{OUT}/{prefix}_3_search.png')

    print(f'  [{prefix}] favorites ...')
    make_favorites(W, H, s=s).save(f'{OUT}/{prefix}_4_favorites.png')

print('Done →', OUT)
