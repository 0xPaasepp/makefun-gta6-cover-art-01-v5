#!/usr/bin/env python3
"""Generate the 9 sample photos for Velvet Heat — Cover Studio.

Flat-illustration GTA-style scenes, drawn with Pillow only (stdlib + Pillow).
No text, no logos, no real people: every figure is a stylised silhouette.
Each scene is 1080x1080, JPEG quality 88, with a distinct dominant hue.
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter

W = H = 1080
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "samples")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(size, top, bottom):
    """Vertical gradient image."""
    w, h = size
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        c = lerp(top, bottom, y / max(1, h - 1))
        for x in range(w):
            px[x, y] = c
    return img


def sun(img, cx, cy, r, color, glow=0.35):
    """Sun disc with a soft glow halo."""
    halo = Image.new("RGB", img.size, (0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([cx - r * 2, cy - r * 2, cx + r * 2, cy + r * 2], fill=color)
    halo = halo.filter(ImageFilter.GaussianBlur(r * 0.7))
    img.paste(Image.blend(img, halo, glow), (0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    return img


def palm(draw, x, y, s, color, lean=0.0):
    """A palm tree: curved trunk + 6 fronds. (x, y) is the base."""
    top_x = x + lean * s
    top_y = y - s
    # trunk: tapered polygon, slightly curved
    draw.polygon([
        (x - 0.06 * s, y), (x + 0.06 * s, y),
        (top_x + 0.035 * s, top_y), (top_x - 0.035 * s, top_y),
    ], fill=color)
    for k in range(6):
        # Alternate fronds left/right, fanning upward from the crown.
        side = 1 if k % 2 == 0 else -1
        a2 = math.pi * (0.15 + 0.12 * (k // 2))
        ex = top_x + side * math.cos(a2) * 0.5 * s
        ey = top_y - math.sin(a2) * 0.28 * s + 0.12 * s
        draw.line([top_x, top_y, ex, ey], fill=color, width=max(4, int(0.05 * s)))
        draw.ellipse([min(top_x, ex) - 4, min(top_y, ey) - 4,
                      max(top_x, ex) + 4, max(top_y, ey) + 4], fill=color)
    draw.ellipse([top_x - 0.09 * s, top_y - 0.09 * s,
                  top_x + 0.09 * s, top_y + 0.09 * s], fill=color)


def birds(draw, n, y0, color, seed=7):
    rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.randint(80, 1000)
        y = rnd.randint(y0, y0 + 160)
        s = rnd.randint(14, 30)
        draw.arc([x - s, y - s // 2, x, y + s // 2], 200, 340, fill=color, width=4)
        draw.arc([x, y - s // 2, x + s, y + s // 2], 200, 340, fill=color, width=4)


def scene_boombox():
    img = vgrad((W, H), (255, 122, 89), (255, 61, 129))
    img = sun(img, 540, 300, 130, (255, 214, 130))
    d = ImageDraw.Draw(img)
    # sea band
    d.rectangle([0, 700, W, 860], fill=(214, 48, 120))
    d.rectangle([0, 860, W, H], fill=(242, 196, 120))
    # towel
    d.polygon([(180, 900), (900, 900), (960, 1060), (120, 1060)], fill=(255, 240, 200))
    d.polygon([(180, 900), (900, 900), (930, 990), (150, 990)], fill=(38, 194, 192))
    # boombox
    d.rounded_rectangle([330, 620, 750, 830], radius=28, fill=(30, 24, 40))
    d.rounded_rectangle([350, 640, 730, 810], radius=18, fill=(58, 44, 74))
    d.ellipse([390, 670, 500, 780], fill=(20, 16, 28))
    d.ellipse([580, 670, 690, 780], fill=(20, 16, 28))
    d.ellipse([410, 690, 480, 760], fill=(255, 122, 89))
    d.ellipse([600, 690, 670, 760], fill=(255, 122, 89))
    d.rectangle([510, 690, 570, 760], fill=(255, 214, 130))
    for i, xx in enumerate((520, 540, 560)):
        d.rectangle([xx, 700, xx + 8, 750], fill=(30, 24, 40))
    d.rectangle([400, 640, 680, 662], fill=(20, 16, 28))
    # handle
    d.arc([430, 560, 650, 660], 180, 360, fill=(30, 24, 40), width=16)
    # palm shadow
    d.polygon([(120, 1060), (300, 860), (330, 880), (220, 1060)], fill=(120, 60, 60))
    birds(d, 5, 120, (90, 30, 60))
    return img


def scene_convertible():
    img = vgrad((W, H), (255, 190, 90), (255, 110, 90))
    img = sun(img, 800, 330, 150, (255, 236, 170))
    d = ImageDraw.Draw(img)
    # road
    d.polygon([(0, 1080), (0, 760), (1080, 760), (1080, 1080)], fill=(64, 48, 66))
    d.polygon([(470, 760), (610, 760), (760, 1080), (320, 1080)], fill=(240, 200, 120))
    for i in range(4):
        y0 = 800 + i * 70
        d.polygon([(520 + i * 6, y0), (560 + i * 6, y0), (580 + i * 14, y0 + 34), (500 + i * 14, y0 + 34)],
                  fill=(255, 240, 190))
    # palms lining the road
    palm(d, 130, 780, 260, (46, 90, 60), lean=30)
    palm(d, 950, 780, 260, (46, 90, 60), lean=-30)
    palm(d, 60, 700, 180, (40, 80, 54), lean=20)
    palm(d, 1020, 700, 180, (40, 80, 54), lean=-20)
    # convertible body
    d.rounded_rectangle([250, 800, 830, 950], radius=40, fill=(214, 32, 48))
    d.polygon([(330, 800), (420, 700), (660, 700), (720, 800)], fill=(150, 18, 34))
    d.polygon([(360, 790), (430, 720), (650, 720), (690, 790)], fill=(180, 230, 240))
    d.rounded_rectangle([250, 880, 830, 950], radius=30, fill=(160, 20, 36))
    d.rectangle([270, 900, 810, 916], fill=(255, 214, 130))
    # wheels
    for cx in (360, 720):
        d.ellipse([cx - 62, 920, cx + 62, 1044], fill=(20, 18, 24))
        d.ellipse([cx - 30, 952, cx + 30, 1012], fill=(220, 220, 220))
    # driver silhouette
    d.ellipse([500, 640, 580, 720], fill=(30, 22, 30))
    d.polygon([(490, 720), (590, 720), (610, 800), (470, 800)], fill=(30, 22, 30))
    birds(d, 4, 130, (120, 50, 40))
    return img


def scene_jetski():
    img = vgrad((W, H), (120, 220, 255), (0, 150, 190))
    img = sun(img, 220, 180, 110, (255, 250, 200))
    d = ImageDraw.Draw(img)
    # sea
    d.rectangle([0, 560, W, H], fill=(0, 170, 205))
    for y, c in ((600, (0, 190, 220)), (700, (0, 160, 195)), (820, (0, 140, 175))):
        d.polygon([(0, y), (1080, y - 40), (1080, y + 30), (0, y + 70)], fill=c)
    # spray
    rnd = random.Random(3)
    for _ in range(90):
        x = rnd.randint(560, 900)
        y = rnd.randint(560, 760)
        r = rnd.randint(3, 12)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    # jetski
    d.polygon([(380, 760), (760, 700), (820, 760), (700, 820), (420, 830)], fill=(255, 90, 90))
    d.polygon([(420, 760), (700, 720), (740, 760), (460, 790)], fill=(255, 255, 255))
    d.rectangle([560, 660, 640, 720], fill=(30, 30, 44))
    # rider
    d.ellipse([560, 560, 630, 630], fill=(40, 30, 40))
    d.polygon([(540, 630), (650, 630), (680, 730), (520, 730)], fill=(255, 200, 60))
    d.polygon([(640, 640), (700, 700), (680, 720), (630, 670)], fill=(40, 30, 40))
    # wake
    d.polygon([(380, 830), (820, 800), (980, 900), (300, 950)], fill=(255, 255, 255))
    birds(d, 4, 100, (20, 80, 120))
    return img


def scene_marina():
    img = vgrad((W, H), (90, 50, 120), (255, 120, 80))
    img = sun(img, 540, 420, 120, (255, 190, 120))
    d = ImageDraw.Draw(img)
    # water
    d.rectangle([0, 640, W, H], fill=(50, 30, 90))
    for y in range(660, 1080, 46):
        d.rectangle([0, y, W, y + 10], fill=(255, 140, 90))
    # boats
    for bx, bw, mast_h in ((140, 260, 260), (480, 300, 320), (830, 220, 230)):
        d.polygon([(bx, 700), (bx + bw, 700), (bx + bw - 40, 780), (bx + 40, 780)], fill=(255, 250, 240))
        d.rectangle([bx + bw // 2 - 6, 700 - mast_h, bx + bw // 2 + 6, 700], fill=(40, 30, 50))
        d.polygon([(bx + bw // 2 + 8, 700 - mast_h + 20), (bx + bw // 2 + 8, 690),
                   (bx + bw - 30, 690)], fill=(255, 214, 130))
        # reflection
        d.polygon([(bx + 20, 800), (bx + bw - 20, 800), (bx + bw - 60, 900), (bx + 60, 900)],
                  fill=(255, 160, 110))
    # pier posts
    for px in (60, 1020):
        d.rectangle([px, 620, px + 26, 760], fill=(30, 22, 40))
    birds(d, 5, 110, (40, 20, 60))
    return img


def scene_neonstreet():
    img = vgrad((W, H), (16, 8, 34), (40, 10, 60))
    d = ImageDraw.Draw(img)
    # buildings
    for bx, bw, bh, c in ((0, 220, 620, (24, 14, 44)), (220, 200, 760, (30, 18, 52)),
                          (420, 240, 560, (22, 12, 40)), (660, 200, 700, (28, 16, 50)),
                          (860, 220, 600, (24, 14, 44))):
        d.rectangle([bx, H - bh - 260, bx + bw, H - 260], fill=c)
    # neon signs: abstract glowing shapes, no readable words
    neon = [((60, 220), (255, 45, 149)), ((260, 300), (45, 226, 230)),
            ((480, 180), (255, 45, 149)), ((700, 260), (255, 200, 60)),
            ((900, 200), (45, 226, 230))]
    for (sx, sy), col in neon:
        glow = Image.new("RGB", img.size, (0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.rounded_rectangle([sx, sy, sx + 130, sy + 200], radius=16, fill=col)
        glow = glow.filter(ImageFilter.GaussianBlur(18))
        img.paste(Image.blend(img, glow, 0.55), (0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([sx, sy, sx + 130, sy + 200], radius=16, outline=col, width=6)
        d.rounded_rectangle([sx + 22, sy + 30, sx + 108, sy + 70], radius=8, fill=col)
        d.rounded_rectangle([sx + 22, sy + 90, sx + 108, sy + 110], radius=6, fill=col)
        d.rounded_rectangle([sx + 22, sy + 130, sx + 70, sy + 170], radius=8, fill=col)
    # wet pavement + reflections
    d.rectangle([0, 820, W, H], fill=(12, 8, 26))
    for (sx, _), col in neon:
        d.polygon([(sx + 10, 830), (sx + 120, 830), (sx + 150, 1060), (sx - 20, 1060)], fill=col)
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 820, W, H], fill=(10, 6, 20, 120))
    # figure silhouette crossing
    d = ImageDraw.Draw(img)
    d.ellipse([500, 700, 560, 760], fill=(8, 6, 14))
    d.polygon([(490, 760), (570, 760), (590, 900), (470, 900)], fill=(8, 6, 14))
    d.polygon([(500, 900), (520, 900), (530, 1000), (500, 1000)], fill=(8, 6, 14))
    d.polygon([(540, 900), (560, 900), (570, 1000), (545, 1000)], fill=(8, 6, 14))
    return img


def scene_palmroad():
    img = vgrad((W, H), (255, 150, 80), (255, 80, 110))
    img = sun(img, 540, 430, 190, (255, 226, 150))
    d = ImageDraw.Draw(img)
    # road receding to the sun
    d.polygon([(0, 1080), (430, 560), (650, 560), (1080, 1080)], fill=(52, 40, 60))
    d.polygon([(520, 560), (560, 560), (640, 1080), (440, 1080)], fill=(255, 220, 130))
    # sand verges
    d.polygon([(0, 760), (430, 560), (0, 560)], fill=(240, 180, 120))
    d.polygon([(1080, 760), (650, 560), (1080, 560)], fill=(240, 180, 120))
    # palms receding both sides
    for i, (px, s) in enumerate(((150, 300), (930, 300), (260, 210), (820, 210), (350, 140), (730, 140))):
        palm(d, px, 1080 - i * 0, s, (40, 80, 52), lean=(-20 if px < 540 else 20))
    birds(d, 6, 120, (110, 40, 50))
    return img


def scene_portrait():
    """Stylised portrait, face CENTRED so the ink engine's face window finds it."""
    img = vgrad((W, H), (255, 140, 90), (255, 80, 130))
    img = sun(img, 540, 300, 170, (255, 220, 140))
    d = ImageDraw.Draw(img)
    # palm silhouettes at the edges
    palm(d, 90, 1080, 420, (90, 40, 60), lean=40)
    palm(d, 990, 1080, 420, (90, 40, 60), lean=-40)
    # shoulders / open shirt
    d.polygon([(240, 1080), (330, 830), (470, 780), (610, 780), (750, 830), (840, 1080)],
              fill=(20, 140, 150))
    # chest skin (open shirt V)
    d.polygon([(470, 780), (610, 780), (560, 960), (520, 960)], fill=(232, 176, 138))
    # neck
    d.rectangle([500, 660, 580, 800], fill=(232, 176, 138))
    # face: centred ellipse (centre third of the frame)
    d.ellipse([390, 330, 690, 660], fill=(232, 176, 138))
    # ears
    d.ellipse([372, 460, 400, 540], fill=(232, 176, 138))
    d.ellipse([680, 460, 708, 540], fill=(232, 176, 138))
    # hair
    d.pieslice([380, 300, 700, 560], 180, 360, fill=(28, 18, 24))
    d.polygon([(380, 420), (420, 330), (470, 380), (520, 330), (580, 380), (640, 330),
               (700, 420), (690, 330), (390, 330)], fill=(28, 18, 24))
    # gold hoops
    for cx in (388, 692):
        d.ellipse([cx - 22, 540, cx + 22, 584], outline=(255, 200, 60), width=7)
    # big sunglasses
    d.rounded_rectangle([410, 460, 520, 530], radius=18, fill=(18, 14, 22))
    d.rounded_rectangle([560, 460, 670, 530], radius=18, fill=(18, 14, 22))
    d.rectangle([520, 486, 560, 500], fill=(18, 14, 22))
    d.line([410, 490, 386, 480], fill=(18, 14, 22), width=8)
    d.line([670, 490, 694, 480], fill=(18, 14, 22), width=8)
    # sunglass glints
    d.line([430, 470, 470, 520], fill=(255, 255, 255), width=6)
    d.line([580, 470, 620, 520], fill=(255, 255, 255), width=6)
    # smile
    d.arc([490, 570, 590, 640], 20, 160, fill=(150, 70, 60), width=7)
    # shirt collar + chain
    d.polygon([(470, 780), (520, 830), (470, 900)], fill=(16, 110, 120))
    d.polygon([(610, 780), (560, 830), (610, 900)], fill=(16, 110, 120))
    d.arc([470, 800, 610, 920], 20, 160, fill=(255, 200, 60), width=6)
    birds(d, 3, 110, (120, 50, 60))
    return img


def scene_rooftop():
    img = vgrad((W, H), (70, 50, 110), (255, 120, 90))
    img = sun(img, 760, 380, 120, (255, 200, 130))
    d = ImageDraw.Draw(img)
    # hazy skyline
    for bx, bw, bh in ((0, 130, 300), (130, 100, 420), (230, 150, 260), (380, 110, 380),
                       (490, 140, 300), (630, 120, 440), (750, 150, 320), (900, 180, 380)):
        d.rectangle([bx, 640 - bh, bx + bw, 640], fill=(60, 42, 90))
        for wy in range(640 - bh + 30, 620, 44):
            d.rectangle([bx + 18, wy, bx + 34, wy + 18], fill=(255, 200, 120))
    # rooftop floor
    d.rectangle([0, 640, W, H], fill=(40, 30, 56))
    d.rectangle([0, 640, W, 664], fill=(255, 150, 100))
    # palms behind
    palm(d, 120, 660, 200, (30, 60, 50), lean=20)
    palm(d, 980, 660, 200, (30, 60, 50), lean=-20)
    # figure on the rooftop edge, back to viewer
    d.ellipse([500, 380, 580, 460], fill=(16, 12, 22))
    d.polygon([(490, 460), (590, 460), (610, 620), (470, 620)], fill=(16, 12, 22))
    d.polygon([(500, 620), (525, 620), (530, 720), (495, 720)], fill=(16, 12, 22))
    d.polygon([(555, 620), (580, 620), (585, 720), (550, 720)], fill=(16, 12, 22))
    d.polygon([(590, 470), (660, 520), (650, 540), (585, 500)], fill=(16, 12, 22))
    # string lights
    for i in range(9):
        x = 120 + i * 105
        y = 700 + int(30 * math.sin(i * 0.9))
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(255, 210, 120))
    birds(d, 4, 100, (50, 30, 70))
    return img


def scene_skate():
    img = vgrad((W, H), (140, 200, 255), (255, 220, 160))
    img = sun(img, 880, 200, 120, (255, 246, 200))
    d = ImageDraw.Draw(img)
    # street
    d.polygon([(0, 1080), (0, 700), (1080, 640), (1080, 1080)], fill=(90, 90, 100))
    d.polygon([(0, 860), (1080, 800), (1080, 840), (0, 900)], fill=(255, 240, 180))
    # buildings, diagonal
    d.polygon([(0, 0), (420, 0), (420, 620), (0, 700)], fill=(255, 140, 110))
    d.polygon([(700, 0), (1080, 0), (1080, 560), (700, 640)], fill=(45, 190, 190))
    for wx in range(40, 400, 80):
        d.rectangle([wx, 120, wx + 44, 220], fill=(255, 240, 200))
    for wx in range(740, 1040, 80):
        d.rectangle([wx, 120, wx + 44, 220], fill=(255, 240, 200))
    # skateboarder mid-trick, diagonal composition
    d.ellipse([520, 380, 600, 460], fill=(24, 20, 30))          # head
    d.polygon([(500, 460), (610, 460), (640, 600), (480, 600)], fill=(255, 90, 90))  # torso
    d.polygon([(480, 600), (540, 600), (470, 760), (430, 750)], fill=(24, 20, 30))  # leg 1
    d.polygon([(580, 600), (630, 600), (700, 730), (660, 750)], fill=(24, 20, 30))  # leg 2
    d.polygon([(610, 470), (700, 420), (720, 440), (620, 500)], fill=(24, 20, 30))  # arm
    # board, tilted
    board = Image.new("RGBA", (260, 60), (0, 0, 0, 0))
    bd = ImageDraw.Draw(board)
    bd.rounded_rectangle([0, 18, 260, 42], radius=12, fill=(30, 30, 44, 255))
    bd.ellipse([30, 40, 60, 58], fill=(255, 255, 255, 255))
    bd.ellipse([200, 40, 230, 58], fill=(255, 255, 255, 255))
    board = board.rotate(-24, expand=True, resample=Image.BICUBIC)
    img.paste(board, (480, 700), board)
    d = ImageDraw.Draw(img)
    # motion lines
    for i, yy in enumerate((500, 560, 620)):
        d.line([300 + i * 40, yy, 430 + i * 40, yy - 30], fill=(255, 255, 255), width=6)
    birds(d, 3, 90, (40, 80, 120))
    return img


SCENES = {
    "boombox": scene_boombox,
    "convertible": scene_convertible,
    "jetski": scene_jetski,
    "marina": scene_marina,
    "neonstreet": scene_neonstreet,
    "palmroad": scene_palmroad,
    "portrait": scene_portrait,
    "rooftop": scene_rooftop,
    "skate": scene_skate,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SCENES.items():
        img = fn()
        path = os.path.join(OUT, name + ".jpg")
        img.convert("RGB").save(path, "JPEG", quality=88)
        print("wrote", path, img.size)


if __name__ == "__main__":
    main()
