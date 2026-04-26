import io
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

ACCEPTED_MIME = {"image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"}
MAX_EDGE = 2048


def normalize_to_jpeg(raw: bytes) -> tuple[bytes, str]:
    """Open arbitrary supported image bytes, downscale longest edge to 2048, return JPEG bytes."""
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    longest = max(w, h)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue(), "image/jpeg"
