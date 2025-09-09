from pathlib import Path
import re
from typing import List

# try to reuse  existing loader first
USING_EXTERNAL_LOADER = False
try:
    from workers.ocr_worker import _load_model, _processor, _model, _device
    USING_EXTERNAL_LOADER = True
except Exception:
    # set up later
    _load_model = None
    _processor = None
    _model = None
    _device = None

import torch
from PIL import Image, UnidentifiedImageError

# for local init if external loader fails to populate globals
def _ensure_model():
    """Guarantee _processor/_model/_device are set and usable."""
    global _processor, _model, _device

    # try external loader
    if USING_EXTERNAL_LOADER and callable(_load_model):
        try:
            _load_model()
        except Exception as e:
            print(f"[model] external _load_model() raised: {e}")

    
    if _processor is None or _model is None or _device is None:
        print("[model] falling back to local TrOCR init")
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        model_name = "microsoft/trocr-base-handwritten"
        _processor = TrOCRProcessor.from_pretrained(model_name)
        _model = VisionEncoderDecoderModel.from_pretrained(model_name).to(_device)
        _model.eval()

    # ensure stability
    ok = (_processor is not None) and (_model is not None) and (_device is not None)
    print(f"[model] ready: processor={type(_processor).__name__ if _processor else None}, "
          f"model={type(_model).__name__ if _model else None}, device={_device}")
    if not ok:
        raise RuntimeError("Model initialization failed: _processor/_model/_device not set.")

# find order of snippets
_num_at_end = re.compile(r"(\d+)(?=(?:\.[^.]+)?$)")

# sorting
def _numeric_key(p: Path):
    m = _num_at_end.search(p.name)
    if m:
        return (int(m.group(1)), p.name.lower())
    return (float("inf"), p.name.lower())

# ensure file is an image
def _is_image_file(p: Path) -> bool:
    try:
        with Image.open(p) as im:
            im.verify()
        return True
    except (UnidentifiedImageError, OSError):
        return False

def _collect_images(sdir: Path, exts: List[str]) -> List[Path]:
    # normalize extensions
    norm_exts = []
    for e in exts:
        e = e.lower()
        if not e.startswith("."):
            e = "." + e
        norm_exts.append(e)

    # collect files with given extensions
    imgs = [p for p in sdir.iterdir() if p.is_file() and p.suffix.lower() in norm_exts]

    # ensure no missing images with weird extensions
    if not imgs:
        candidates = [p for p in sdir.iterdir() if p.is_file()]
        imgs = [p for p in candidates if _is_image_file(p)]

    imgs.sort(key=_numeric_key)
    return imgs

def _ocr_line(img_path: Path) -> str:
    # rgb needed for trocr
    image = Image.open(img_path).convert("RGB")
    with torch.inference_mode():
        # _processor is callable; ensure it's initialized
        inputs = _processor(images=image, return_tensors="pt")
        # move tensors to device
        for k, v in inputs.items():
            if hasattr(v, "to"):
                inputs[k] = v.to(_device)
        generated_ids = _model.generate(inputs["pixel_values"])
        text = _processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return text.strip()

def process_sample_folder(sample_dir: str, output_dir: str, exts: List[str], overwrite: bool = False) -> dict:
    """
    RQ job: given a folder with single-line images, produce one .txt in output_dir
    with lines ordered by numeric suffix in filenames.
    """
    _ensure_model()

    sdir = Path(sample_dir)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_txt = out_dir / f"{sdir.name}.txt"

    imgs = _collect_images(sdir, exts)
    print(f"[info] {sdir} -> found {len(imgs)} image(s)")

    if not imgs:
        if out_txt.exists() and not overwrite:
            return {"status": "skipped_no_images_existing_out", "sample": sdir.name, "out_path": str(out_txt), "num_images": 0}
        if overwrite or not out_txt.exists():
            out_txt.write_text("", encoding="utf-8")
        return {"status": "no_images", "sample": sdir.name, "out_path": str(out_txt), "num_images": 0}

    if out_txt.exists() and not overwrite:
        return {"status": "skipped_exists", "sample": sdir.name, "out_path": str(out_txt), "num_images": len(imgs)}

    lines_out, failures = [], []
    for p in imgs:
        try:
            lines_out.append(_ocr_line(p))
        except Exception as e:
            print(f"[warn] OCR failed for {p}: {e}")
            failures.append(str(p))
            lines_out.append("")

    with out_txt.open("w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines_out) + "\n")

    return {
        "status": "ok",
        "sample": sdir.name,
        "out_path": str(out_txt),
        "num_lines": len(lines_out),
        "num_images": len(imgs),
        "failures": failures,
        "used_external_loader": USING_EXTERNAL_LOADER,
    }
