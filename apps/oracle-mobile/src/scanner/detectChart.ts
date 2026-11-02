/**
 * Lightweight "is this a trading chart?" gate — runs before BUY/SELL heuristics
 * so photos of feet, pets, selfies, etc. never invent TP/SL.
 */

export type ChartDetection = {
  isChart: boolean;
  score: number;
  reasons: string[];
};

const CHART_KEYWORDS = [
  'BID',
  'ASK',
  'SPREAD',
  'VOLUME',
  'OPEN',
  'HIGH',
  'LOW',
  'CLOSE',
  'M1',
  'M5',
  'M15',
  'M30',
  'H1',
  'H4',
  'D1',
  'W1',
  'MN',
  'MT4',
  'MT5',
  'METATRADER',
  'TRADINGVIEW',
  'CANDLE',
  'CHART',
  'PIP',
  'LOT',
  'BUY',
  'SELL',
  'LONG',
  'SHORT',
  'ATR',
  'RSI',
  'MACD',
  'EMA',
  'SMA',
];

const SYMBOL_HINTS =
  /\b(EURUSD|GBPUSD|USDJPY|XAUUSD|XAGUSD|BTCUSD|ETHUSD|NAS100|US30|SPX500|GER40|UK100|EUR\/USD|GBP\/USD|USD\/JPY|XAU\/USD)\b/i;

function isSkinTone(r: number, g: number, b: number): boolean {
  // Rough Fitzpatrick-ish band — photos of people/feet light up here; MT charts rarely do
  if (r < 60 || g < 30 || b < 20) return false;
  if (r < g || r < b) return false;
  if (Math.abs(r - g) < 15) return false;
  return r > 95 && g > 40 && g < 200 && b < 170 && r - g > 15;
}

async function loadImageData(
  uri: string,
  maxW = 180,
): Promise<{ data: Uint8ClampedArray; w: number; h: number } | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = uri;
    });
    const w = maxW;
    const h = Math.max(80, Math.round((img.height / Math.max(img.width, 1)) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return { data, w, h };
  } catch {
    return null;
  }
}

function scoreOcr(ocrText: string): { score: number; reasons: string[] } {
  const upper = (ocrText || '').toUpperCase();
  const compact = upper.replace(/\s+/g, ' ').trim();
  let score = 0;
  const reasons: string[] = [];

  if (!compact || compact.length < 8) {
    reasons.push('ocr_empty');
    return { score: -1, reasons };
  }

  if (SYMBOL_HINTS.test(upper)) {
    score += 3;
    reasons.push('symbol_text');
  }

  let kw = 0;
  for (const k of CHART_KEYWORDS) {
    if (upper.includes(k)) kw += 1;
  }
  if (kw >= 1) {
    score += Math.min(3, kw);
    reasons.push(`chart_keywords:${kw}`);
  }

  // Price-axis style numbers (e.g. 1.08542, 2345.50, 17800)
  const decimals = upper.match(/\b\d{1,2}[.,]\d{3,5}\b/g) ?? [];
  const bigInts = upper.match(/\b\d{4,5}(?:[.,]\d{1,2})?\b/g) ?? [];
  if (decimals.length >= 2) {
    score += 2;
    reasons.push('price_decimals');
  } else if (decimals.length === 1 || bigInts.length >= 3) {
    score += 1;
    reasons.push('sparse_prices');
  }

  // Pair letters without slash still count lightly if OCR mangled
  if (/\b(EUR|GBP|USD|JPY|XAU|BTC|NAS|SPX)\b/.test(upper) && score < 2) {
    score += 1;
    reasons.push('asset_token');
  }

  return { score, reasons };
}

function scorePixels(data: Uint8ClampedArray, w: number, h: number): {
  score: number;
  reasons: string[];
} {
  let skin = 0;
  let dark = 0;
  let candleRG = 0;
  let samples = 0;
  let edgeish = 0;

  const step = 8;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      samples += 1;
      const lum = (r + g + b) / 3;
      if (lum < 55) dark += 1;
      if (isSkinTone(r, g, b)) skin += 1;
      // Candle-like saturated red/green on darker UIs
      if (lum < 200) {
        if (g > r + 30 && g > b + 15 && g > 80) candleRG += 1;
        if (r > g + 30 && r > b + 15 && r > 80) candleRG += 1;
      }
      // Cheap vertical edge proxy (candles / grid)
      if (x + step < w) {
        const j = (y * w + (x + step)) * 4;
        const dl =
          Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]);
        if (dl > 90) edgeish += 1;
      }
    }
  }

  const skinRatio = skin / Math.max(samples, 1);
  const darkRatio = dark / Math.max(samples, 1);
  const candleRatio = candleRG / Math.max(samples, 1);
  const edgeRatio = edgeish / Math.max(samples, 1);

  let score = 0;
  const reasons: string[] = [];

  if (skinRatio > 0.12) {
    score -= 4;
    reasons.push(`skin_heavy:${skinRatio.toFixed(2)}`);
  } else if (skinRatio > 0.05) {
    score -= 2;
    reasons.push(`skin_present:${skinRatio.toFixed(2)}`);
  }

  if (darkRatio > 0.35) {
    score += 1;
    reasons.push('dark_ui');
  }
  if (candleRatio > 0.04) {
    score += 2;
    reasons.push('candle_colours');
  } else if (candleRatio > 0.015) {
    score += 1;
    reasons.push('weak_candle_colours');
  }
  if (edgeRatio > 0.18) {
    score += 1;
    reasons.push('structured_edges');
  }

  // Bright photo / room lighting without dark terminal UI
  if (darkRatio < 0.15 && skinRatio > 0.03) {
    score -= 2;
    reasons.push('photo_like');
  }

  return { score, reasons };
}

/**
 * Returns whether the image + OCR look like a market chart screenshot.
 * Threshold is intentionally conservative: prefer reject over fake signals.
 */
export async function detectTradingChart(
  imageUri: string,
  ocrText: string,
): Promise<ChartDetection> {
  const ocr = scoreOcr(ocrText);
  const reasons = [...ocr.reasons];
  let score = ocr.score;

  const pixels = await loadImageData(imageUri);
  if (pixels) {
    const pix = scorePixels(pixels.data, pixels.w, pixels.h);
    score += pix.score;
    reasons.push(...pix.reasons);
  } else {
    reasons.push('pixels_unavailable');
  }

  // Need clear chart evidence — symbol/keywords/prices OR strong candle UI without skin
  const isChart = score >= 3;
  return { isChart, score, reasons };
}

export const NO_CHART_MESSAGE =
  'No chart detected — upload a clear market screenshot.';
