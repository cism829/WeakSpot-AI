import base64, time 
from io import BytesIO
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps
import cv2
from dotenv import load_dotenv
from openai import OpenAI

INPUT_DIR  = r"C:\Users\trevo\OneDrive\Desktop\490\notes\pages"
OUTPUT_DIR = r"C:\Users\trevo\OneDrive\Desktop\490\WeakSpot-AI\ocr_out"
MODEL = "gpt-4o-mini"  
TEMPERATURE = 0


def preprocess(path: Path) -> bytes:
    img = cv2.imread(str(path))
    if img is None:
        raise FileNotFoundError(path)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, d=5, sigmaColor=30, sigmaSpace=30)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # slight adaptive binarization
    bw = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31, 10
    )

    pil = Image.fromarray(bw)
    pil = ImageOps.exif_transpose(pil)   
    pil.thumbnail((1600, 1600))          
    buf = BytesIO()
    pil.save(buf, format="JPEG", quality=85)
    return buf.getvalue()

def image_to_data_url(jpeg_bytes: bytes) -> str:
    b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"

def iter_images(folder: Path) -> Iterable[Path]:
    exts = ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.tif", "*.tiff", "*.webp")
    for pat in exts:
        yield from folder.glob(pat)

def ocr_one_image(client: OpenAI, image_path: Path) -> str:
    jpeg_bytes = preprocess(image_path)
    data_url = image_to_data_url(jpeg_bytes)

    user_prompt = (
        "Extract ONLY the handwritten text from this image.\n"
        "- Keep original line breaks.\n"
        "- If a word is unclear, write '(?)'.\n"
        "- Do not describe the image, just return text."
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

def main():
    load_dotenv()  
    client = OpenAI()

    in_dir = Path(INPUT_DIR)
    out_dir = Path(OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(iter_images(in_dir))
    if not images:
        print(f"No images found in: {in_dir}")
        return

    print(f"Found {len(images)} images. Writing .txt files to {out_dir}")
    failures = []

    for i, img_path in enumerate(images, 1):
        base = img_path.stem
        out_txt = out_dir / f"{base}.txt"
        try:
            # Simple retry loop for transient API hiccups/rate limits
            backoff = 1.5
            for attempt in range(4):
                try:
                    text = ocr_one_image(client, img_path)
                    with open(out_txt, "w", encoding="utf-8") as f:
                        f.write(text)
                    print(f"[{i}/{len(images)}] OK  -> {out_txt.name}")
                    break
                except Exception as e:
                    if attempt == 3:
                        raise
                    time.sleep(backoff)
                    backoff *= 2
            # small delay for the API
            time.sleep(0.2)
        except Exception as e:
            print(f"[{i}/{len(images)}] FAIL -> {img_path.name}: {e}")
            failures.append((img_path.name, str(e)))

    if failures:
        log = out_dir / "_failures.log"
        with open(log, "w", encoding="utf-8") as f:
            for name, err in failures:
                f.write(f"{name}\t{err}\n")
        print(f"Completed with {len(failures)} failures. See {log}")
    else:
        print("All pages processed successfully.")

if __name__ == "__main__":
    main()
