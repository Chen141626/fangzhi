"""Render the two battle result prefab states for quick layout inspection."""

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PREFAB = ROOT / "assets/battle/prefab/battle.prefab"
OUTPUT = ROOT / "temp"
FONT = Path("C:/Windows/Fonts/msyh.ttc")

data = json.loads(PREFAB.read_text(encoding="utf-8"))
sprites = {}
for folder in [
    ROOT / "assets/battleResult/texture",
    ROOT / "assets/resources/gui/common/texture",
    ROOT / "assets/resources/gui/common/home_popups",
]:
    for meta_path in folder.glob("*.png.meta"):
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        frame_uuid = meta.get("subMetas", {}).get("f9941", {}).get("uuid")
        if frame_uuid:
            sprites[frame_uuid] = meta_path.with_suffix("")


def find_node(name):
    return next(i for i, item in enumerate(data) if item.get("__type__") == "cc.Node" and item.get("_name") == name)


def components(node):
    return [data[part["__id__"]] for part in node.get("_components", [])]


def text_font(size):
    return ImageFont.truetype(str(FONT), size)


def render_node(canvas, index, origin_x=375, origin_y=800):
    node = data[index]
    if not node.get("_active", True):
        return
    pos = node.get("_lpos", {})
    x = origin_x + pos.get("x", 0)
    y = origin_y - pos.get("y", 0)
    parts = components(node)
    transform = next((part for part in parts if part["__type__"] == "cc.UITransform"), None)
    width = round(transform["_contentSize"]["width"]) if transform else 0
    height = round(transform["_contentSize"]["height"]) if transform else 0
    sprite = next((part for part in parts if part["__type__"] == "cc.Sprite"), None)
    if sprite:
        uuid = sprite.get("_spriteFrame", {}).get("__uuid__")
        path = sprites.get(uuid)
        if path and path.exists():
            with Image.open(path) as source:
                art = source.convert("RGBA").resize((width, height), Image.Resampling.LANCZOS)
                canvas.alpha_composite(art, (round(x - width / 2), round(y - height / 2)))
    label = next((part for part in parts if part["__type__"] == "cc.Label"), None)
    if label and label.get("_string"):
        lines = label["_string"].split("\n")
        draw = ImageDraw.Draw(canvas)
        font = text_font(round(label.get("_fontSize", 24)))
        fill = label["_color"]
        rgba = (fill["r"], fill["g"], fill["b"], fill["a"])
        line_height = label.get("_lineHeight", font.size)
        top = y - len(lines) * line_height / 2
        for line in lines:
            if label.get("_horizontalAlign", 1) == 0:
                left = x - width / 2
            else:
                measured = draw.textlength(line, font=font)
                left = x - measured / 2
            draw.text((left, top), line, font=font, fill=rgba, stroke_width=1, stroke_fill=(42, 28, 21))
            top += line_height
    for child in node.get("_children", []):
        render_node(canvas, child["__id__"], x, y)


OUTPUT.mkdir(exist_ok=True)
for state_name in ["victoryState", "defeatState"]:
    index = find_node(state_name)
    data[index]["_active"] = True
    image = Image.new("RGBA", (750, 1600))
    render_node(image, index)
    target = OUTPUT / f"battle-result-{state_name}-preview.png"
    image.save(target)
    print(target)
