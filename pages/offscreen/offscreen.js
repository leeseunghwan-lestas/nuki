// Offscreen document for image cropping + preprocessing with Canvas API
// Action constant — keep in sync with utils/actions.js ACTION.CROP_IMAGE
const ACTION_CROP_IMAGE = 'cropImage';

const MIN_DIMENSION = 20;
const MAX_DIMENSION = 8000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === ACTION_CROP_IMAGE) {
    cropImage(message.dataUrl, message.rect, message.devicePixelRatio)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function cropImage(dataUrl, rect, dpr) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid image data: expected data URI');
  }

  if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.w) || !Number.isFinite(rect.h) ||
      !Number.isFinite(dpr) || dpr <= 0) {
    return { success: false, error: 'Invalid capture parameters' };
  }

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  let sx = Math.round(rect.x * dpr);
  let sy = Math.round(rect.y * dpr);
  let sw = Math.round(rect.w * dpr);
  let sh = Math.round(rect.h * dpr);

  sx = Math.max(0, Math.min(sx, img.naturalWidth));
  sy = Math.max(0, Math.min(sy, img.naturalHeight));
  sw = Math.max(0, Math.min(sw, img.naturalWidth - sx));
  sh = Math.max(0, Math.min(sh, img.naturalHeight - sy));

  if (sw < MIN_DIMENSION || sh < MIN_DIMENSION) {
    return { success: false, tooSmall: true };
  }
  if (sw > MAX_DIMENSION || sh > MAX_DIMENSION) {
    return { success: false, error: 'Capture area too large' };
  }

  // 1. Crop at original size
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // 2. Upscale 2x (more pixels = better OCR on blurry text)
  const SCALE = 2;
  const uw = Math.min(sw * SCALE, MAX_DIMENSION);
  const uh = Math.min(sh * SCALE, MAX_DIMENSION);
  const canvas = document.createElement('canvas');
  canvas.width = uw;
  canvas.height = uh;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cropCanvas, 0, 0, uw, uh);

  // 3. Enhance for OCR (contrast + sharpen)
  enhanceForOcr(ctx, uw, uh);

  return { success: true, base64: canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '') };
}

// --- Image preprocessing for better OCR accuracy ---

function enhanceForOcr(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Step 1: Auto contrast stretch (normalize histogram)
  autoContrast(data);

  // Step 2: Sharpen (unsharp mask via 3x3 convolution)
  const sharpened = sharpen(data, w, h);
  imageData.data.set(sharpened);

  ctx.putImageData(imageData, 0, 0);
}

// Stretch the lightest and darkest pixels to full 0-255 range
function autoContrast(data) {
  let min = 255, max = 0;

  // Sample luminance to find range
  for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel for speed
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }

  const range = max - min;
  if (range < 30 || range > 240) return; // skip if already high contrast or near-uniform

  const scale = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, (data[i] - min) * scale));     // R
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - min) * scale)); // G
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - min) * scale)); // B
  }
}

// 3x3 sharpening convolution kernel
function sharpen(data, w, h) {
  const kernel = [
     0, -0.5,  0,
    -0.5,  3, -0.5,
     0, -0.5,  0,
  ];
  const out = new Uint8ClampedArray(data.length);
  out.set(data); // copy alpha + border pixels

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) { // R, G, B only
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ki = ((y + ky) * w + (x + kx)) * 4 + c;
            val += data[ki] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        out[idx + c] = val;
      }
    }
  }
  return out;
}
