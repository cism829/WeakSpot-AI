import argparse
from pathlib import Path
import sys
import glob

import cv2
import numpy as np


# img preprocessing

def read_image(path: Path): #read images
    img = cv2.imread(str(path))
    if img is None:
        raise FileNotFoundError(f"Could not read image: {path}")
    return img

def to_gray(img): #greyscale img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img

def enhance_contrast(gray): # enhanced contrast with CLAHE pulls out faint pencil/pen strokes
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)

def binarize_handwriting(gray):
    # Keep strokes while smoothing noise
    gray = cv2.bilateralFilter(gray, d=5, sigmaColor=30, sigmaSpace=30)

    # sauvola binarization 
    bw = None
    try:
        from skimage.filters import threshold_sauvola  # type: ignore
        thr = threshold_sauvola(gray, window_size=31, k=0.2)
        bw = (gray > thr).astype(np.uint8) * 255
    except Exception:
        # If no skimage, use OpenCV
        bw = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31, 10
        )

    # invert handwriting to white on black
    if np.mean(bw) < 127:
        bw = 255 - bw

    # Clean small noise
    bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1)), 1)
    return bw

    #try to remove lines from ruled paper 
def remove_ruled_lines(bw): 
    H, W = bw.shape
    k = max(50, W // 16)  
    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k, 1))
    detected = cv2.morphologyEx(bw, cv2.MORPH_OPEN, horiz_kernel, iterations=1)
    return cv2.subtract(bw, detected)

# try to straighten slightly skewed img
def deskew_small_angle(img_bgr, bw_mask):
    # edge detection on binary mask to highlight handwriting strokes
    edges = cv2.Canny(bw_mask, 50, 150, apertureSize=3)
    # probablisitic hough transform to detect short line segments
    lines = cv2.HoughLinesP(
        edges, 1, np.pi/180,
        threshold=80,
        minLineLength=max(20, bw_mask.shape[1] // 30),
        maxLineGap=10
    )

    #computes angle for line segments, focusing on small angles (near horizontal lines), takes median
    angle = 0.0
    if lines is not None and len(lines) > 0:
        angs = []
        for x1, y1, x2, y2 in lines[:, 0]:
            dx = x2 - x1
            if dx == 0:
                continue
            a = np.degrees(np.arctan2(y2 - y1, dx))
            if -30 <= a <= 30:
                angs.append(a)
        if angs:
            angle = float(np.median(angs))

    # Rotate both color image and binary mask
    h, w = img_bgr.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    rot_img = cv2.warpAffine(img_bgr, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    rot_bw  = cv2.warpAffine(bw_mask, M, (w, h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return rot_img, rot_bw, angle


# Line detection (projection bands)
# maybe still needs tuning

def projection_line_bands(bw_no_lines):
    """
    Finds horizontal text bands via smoothed projection and adaptive thresholding.
    Returns list of (y0, y1) bands.
    """
    # count white pixels (handwriting) in each row, create vector where peaks indicate text rows
    proj = np.sum(bw_no_lines > 0, axis=1).astype(np.float32)

    # smoothing
    ks = max(15, (bw_no_lines.shape[0] // 120) | 1)  # odd kernel size
    proj_s = cv2.blur(proj.reshape(-1, 1), (1, ks)).ravel()

    # any row with smoothed ink count >18% of max is treated as text
    thr = max(10.0, 0.18 * float(np.max(proj_s)))
    text_rows = proj_s > thr

    bands = []
    in_band = False
    start = 0
    for i, v in enumerate(text_rows):
        if v and not in_band:
            in_band = True
            start = i
        elif not v and in_band:
            bands.append((start, i))
            in_band = False
    if in_band:
        bands.append((start, len(text_rows) - 1))

    # Merge close bands and pad a bit
    merged = []
    for s, e in bands:
        if not merged:
            merged.append([s, e])
        else:
            ps, pe = merged[-1]
            if s - pe <= 8:  # small gaps within a single handwritten line
                merged[-1][1] = e
            else:
                merged.append([s, e])

    H = bw_no_lines.shape[0]
    pad = 6
    out = [(max(0, s - pad), min(H, e + pad)) for s, e in merged if (e - s) > 8]
    return out

def crop_lines(img_color, bands, out_dir: Path, base_name: str):
    """
    Crops each band from the full width of the (deskewed) color image.
    Writes PNGs and returns list of (filename, y0, y1).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    H, W = img_color.shape[:2]
    manifest_rows = []
    for i, (y0, y1) in enumerate(bands):
        y0c, y1c = max(0, y0), min(H, y1)
        crop = img_color[y0c:y1c, 0:W]
        fname = f"{base_name}_line_{i:03d}.png"
        cv2.imwrite(str(out_dir / fname), crop)
        manifest_rows.append((fname, int(y0c), int(y1c), 0, int(W)))
    return manifest_rows


def process_image(img_path: Path, out_root: Path, do_deskew: bool):
    img = read_image(img_path)
    gray = enhance_contrast(to_gray(img))
    bw   = binarize_handwriting(gray)
    bw   = remove_ruled_lines(bw)

    if do_deskew:
        img, bw, angle = deskew_small_angle(img, bw)
        # print(f"Deskew: {img_path.name} angle={angle:.2f}°") (#debug deskew angle)

    bands = projection_line_bands(bw)

    # Write crops into a per-image folder
    base = img_path.stem
    out_dir = out_root / base
    rows = crop_lines(img, bands, out_dir, base)

    return len(rows)

def main():
    ap = argparse.ArgumentParser(description="Split handwriting pages into line images.")
    ap.add_argument("-i", "--input_dir", required=True, help="Folder with input images")
    ap.add_argument("-o", "--output_dir", required=True, help="Folder to write line crops")
    ap.add_argument("--exts", nargs="+", default=[".png", ".jpg", ".jpeg", ".tif", ".tiff"],
                    help="Image extensions to include (default: common types)")
    ap.add_argument("--no-deskew", action="store_true", help="Disable deskew (on by default)")
    args = ap.parse_args()

    in_dir  = Path(args.input_dir)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Collect images
    paths = []
    for ext in args.exts:
        paths += glob.glob(str(in_dir / f"*{ext}"))
    paths = [Path(p) for p in sorted(paths)]
    if not paths:
        print(f"No images found in {in_dir} with extensions {args.exts}", file=sys.stderr)
        sys.exit(1)

    total_lines = 0
    for p in paths:
        n = process_image(p, out_dir, do_deskew=(not args.no_deskew))
        print(f"[OK] {p.name}: {n} lines")
        total_lines += n

    print(f"\nDone. Processed {len(paths)} page(s), produced {total_lines} line image(s).")
    print(f"Output root: {out_dir.resolve()}")

if __name__ == "__main__":
    main()
