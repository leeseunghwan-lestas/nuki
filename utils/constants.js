// Single source of truth for magic numbers used across modules.
// Keep values conservative — changing SCALE or CONFIDENCE_THRESHOLD
// affects OCR cost and accuracy tradeoff.

// --- OCR ---
// Gemini returns a 0-100 confidence score. Results below this are shown as
// warnings ("too blurry / partial / low contrast") instead of successful text.
export const CONFIDENCE_THRESHOLD = 70;

// --- Image preprocessing (offscreen) ---
export const MIN_CAPTURE_DIMENSION = 20;   // reject tiny crops (probably miss-drag)
export const MAX_CAPTURE_DIMENSION = 8000; // guard against absurd memory use
export const UPSCALE_FACTOR = 2;           // 2x upscaling before contrast/sharpen

// --- History ---
export const MAX_HISTORY_ENTRIES = 20;     // ring buffer size in chrome.storage.local
