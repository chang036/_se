"""產生 PWA 圖示（深色背景 + 藍色圓形 + 白色「安」字）。

用法：
    python tools/make_icons.py

需要 Pillow。Windows 使用微軟正黑體；其他系統會依序尋找可用的
中文字型，找不到時仍會產生圖示（只差文字）。
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"

INK = "#111111"
BLUE = "#0b3d91"
WHITE = "#ffffff"

FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\msjhbd.ttc"),
    Path(r"C:\Windows\Fonts\msjh.ttc"),
    Path("/System/Library/Fonts/PingFang.ttc"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"),
]


def find_font():
    for path in FONT_CANDIDATES:
        if path.exists():
            return path
    return None


def draw_icon(size: int, circle_ratio: float, text_ratio: float) -> Image.Image:
    scale = 4
    canvas = size * scale
    image = Image.new("RGB", (canvas, canvas), INK)
    draw = ImageDraw.Draw(image)

    radius = canvas * circle_ratio / 2
    center = canvas / 2
    draw.ellipse(
        (center - radius, center - radius, center + radius, center + radius),
        fill=BLUE,
    )

    font_path = find_font()
    if font_path:
        font = ImageFont.truetype(str(font_path), int(canvas * text_ratio))
        draw.text((center, center + canvas * 0.015), "安", font=font, fill=WHITE, anchor="mm")

    return image.resize((size, size), Image.LANCZOS)


def main():
    ICONS.mkdir(exist_ok=True)

    draw_icon(512, circle_ratio=0.70, text_ratio=0.40).save(ICONS / "icon-512.png")
    draw_icon(192, circle_ratio=0.70, text_ratio=0.40).save(ICONS / "icon-192.png")
    draw_icon(180, circle_ratio=0.70, text_ratio=0.40).save(ICONS / "apple-touch-icon.png")
    # maskable：內容要留在中央安全區內，所以圓形小一點。
    draw_icon(512, circle_ratio=0.58, text_ratio=0.34).save(
        ICONS / "icon-maskable-512.png"
    )

    print(f"已產生圖示：{ICONS}")


if __name__ == "__main__":
    main()
