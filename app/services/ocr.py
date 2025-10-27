import base64
from io import BytesIO
from pathlib import Path

import cv2
from PIL import Image, ImageOps
from openai import OpenAI

MODEL = "gpt-4o-mini"
TEMPERATURE = 0

# preprocess image for ocr via grayscale, denoise, binarize, resize
def preprocess(path: Path) -> bytes:
    img = cv2.imread(str(path))
    if img is None:
        raise FileNotFoundError(path)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, d=5, sigmaColor=30, sigmaSpace=30)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    bw = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv2.THRESH_BINARY, 31, 10
    )

    pil = Image.fromarray(bw)
    pil = ImageOps.exif_transpose(pil)
    pil.thumbnail((1600, 1600))

    buf = BytesIO()
    pil.save(buf, format="JPEG", quality=85)
    return buf.getvalue()

def _image_to_data_url(jpeg_bytes: bytes) -> str:
    b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"

# send image bytes to openai model
def ocr_bytes(client: OpenAI, jpeg_bytes: bytes) -> str:
    data_url = _image_to_data_url(jpeg_bytes)
    user_prompt = (
        "Extract ONLY the handwritten/printed text from this image.\n"
        "- Keep original line breaks.\n"
        "- If a word is unclear, write '(?)'.\n"
        "- Do not describe the image; return text only."
    )
    resp = client.chat.completions.create(
        model=MODEL,
        temperature=TEMPERATURE,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }],
    )
    return (resp.choices[0].message.content or "").strip()
