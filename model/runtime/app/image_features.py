"""
Computes the same handcrafted image features the model was trained on
(img_width, img_height, img_brightness, img_contrast, img_colorfulness,
img_blur_score, img_aspect_ratio, img_megapixels) directly from an
uploaded image file, using only PIL + numpy — no OpenCV dependency.

Used by streamlit_app.py so a normal user can just upload a photo instead
of typing technical image statistics by hand.
"""

import numpy as np
from PIL import Image


def _laplacian_variance(gray: np.ndarray) -> float:
    """
    Variance of the image's Laplacian — a standard, dependency-free sharpness
    proxy: a blurry image has few sharp edges, so the second-derivative
    response is low-variance; a sharp image has many strong edges, so it's
    high-variance. Implemented as a plain vectorized numpy convolution with
    the classic 4-neighbor Laplacian kernel, so no OpenCV/scipy is required.
    """
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    center = gray[1:-1, 1:-1]
    up = gray[:-2, 1:-1]
    down = gray[2:, 1:-1]
    left = gray[1:-1, :-2]
    right = gray[1:-1, 2:]
    laplacian = (up + down + left + right - 4 * center)
    return float(np.var(laplacian))


def _colorfulness(rgb: np.ndarray) -> float:
    """
    Hasler & Süsstrunk (2003) colorfulness metric — a simple, well-known,
    dependency-free formula combining the spread and mean of the
    red-green and yellow-blue opponent color channels.
    """
    r = rgb[:, :, 0].astype(np.float64)
    g = rgb[:, :, 1].astype(np.float64)
    b = rgb[:, :, 2].astype(np.float64)

    rg = r - g
    yb = 0.5 * (r + g) - b

    std_rg, std_yb = np.std(rg), np.std(yb)
    mean_rg, mean_yb = np.mean(rg), np.mean(yb)

    std_root = np.sqrt(std_rg ** 2 + std_yb ** 2)
    mean_root = np.sqrt(mean_rg ** 2 + mean_yb ** 2)
    return float(std_root + 0.3 * mean_root)


def extract_image_features(image: Image.Image) -> dict:
    """
    Takes a PIL Image (as returned by PIL.Image.open on an uploaded file)
    and returns the handcrafted numeric image features the model expects.
    Large images are downscaled before the pixel-level computations purely
    for speed — the resulting statistics are scale-invariant proxies, not
    exact pixel counts (width/height/megapixels are reported from the
    ORIGINAL image, not the downscaled copy).
    """
    image = image.convert("RGB")
    width, height = image.size

    max_dim = 512
    if max(width, height) > max_dim:
        scale = max_dim / max(width, height)
        small = image.resize((max(1, int(width * scale)), max(1, int(height * scale))))
    else:
        small = image

    rgb = np.asarray(small, dtype=np.float64)
    gray = rgb.mean(axis=2)

    brightness = float(gray.mean())
    contrast = float(gray.std())
    colorfulness = _colorfulness(rgb)
    blur_score = _laplacian_variance(gray)

    return {
        "img_width": float(width),
        "img_height": float(height),
        "img_brightness": brightness,
        "img_contrast": contrast,
        "img_colorfulness": colorfulness,
        "img_blur_score": blur_score,
        "img_aspect_ratio": float(width / height) if height else 0.0,
        "img_megapixels": float(width * height) / 1_000_000.0,
    }
