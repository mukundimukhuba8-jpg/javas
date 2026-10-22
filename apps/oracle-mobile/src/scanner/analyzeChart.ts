import { createWorker } from 'tesseract.js';
import { TRADE_SYMBOLS } from '../data/symbols';
import type { ChartSignal, SignalDirection } from './types';

const ALIASES: Record<string, string> = {
  EURUSD: 'EURUSD',
  'EUR/USD': 'EURUSD',
  GBPUSD: 'GBPUSD',
  'GBP/USD': 'GBPUSD',
  USDJPY: 'USDJPY',
  'USD/JPY': 'USDJPY',
  XAUUSD: 'XAUUSD',
  GOLD: 'XAUUSD',
  XAGUSD: 'XAGUSD',
  SILVER: 'XAGUSD',
  US30: 'US30',
  DJ30: 'US30',
  DOW: 'US30',
  NAS100: 'NAS100',
  NASDAQ: 'NAS100',
  USTEC: 'NAS100',
  SPX500: 'SPX500',
  SPX: 'SPX500',
  US500: 'SPX500',
  BTCUSD: 'BTCUSD',
  BITCOIN: 'BTCUSD',
  ETHUSD: 'ETHUSD',
  ETHEREUM: 'ETHUSD',
  GER40: 'GER40',
  DAX: 'GER40',
  UK100: 'UK100',
  FTSE: 'UK100',
};

function normalizeOcr(text: string): string {
  return text.toUpperCase().replace(/\s+/g, ' ');
}

function detectSymbol(ocr: string): { symbol: string; confidence: ChartSignal['symbolConfidence'] } {
  const upper = normalizeOcr(ocr);
  const compact = upper.replace(/[^A-Z0-9/]/g, '');

  for (const [alias, symbol] of Object.entries(ALIASES)) {
    const key = alias.replace(/[^A-Z0-9/]/g, '');
    if (upper.includes(alias) || compact.includes(key)) {
      return { symbol, confidence: alias.length >= 6 ? 'high' : 'medium' };
    }
  }

  for (const s of TRADE_SYMBOLS) {
    if (compact.includes(s.id)) return { symbol: s.id, confidence: 'high' };
  }

  const pair = upper.match(
    /\b(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)\s*[/-]?\s*(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)\b/,
  );
  if (pair) {
    const guess = `${pair[1]}${pair[2]}`;
    if (TRADE_SYMBOLS.some((s) => s.id === guess)) {
      return { symbol: guess, confidence: 'medium' };
    }
  }

  return { symbol: 'EURUSD', confidence: 'low' };
}

function extractPrices(ocr: string): number[] {
  const matches = ocr.match(/\b\d{1,5}(?:[.,]\d{1,5})?\b/g) ?? [];
  return matches
    .map((m) => Number(m.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1_000_000)
    .sort((a, b) => a - b);
}

function pickEntry(prices: number[], symbol: string): number | null {
  if (!prices.length) return null;
  if (symbol.includes('JPY') || symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500') {
    const big = prices.filter((p) => p > 50);
    return big.length ? big[Math.floor(big.length * 0.7)] : prices[prices.length - 1];
  }
  if (symbol.startsWith('XAU') || symbol.startsWith('BTC')) {
    const mid = prices.filter((p) => p > 100);
    return mid.length ? mid[Math.floor(mid.length * 0.6)] : prices[prices.length - 1];
  }
  const fx = prices.filter((p) => p > 0.1 && p < 10);
  return fx.length ? fx[Math.floor(fx.length * 0.65)] : prices[prices.length - 1];
}

async function colourBias(uri: string): Promise<{ direction: SignalDirection; score: number }> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { direction: 'BUY', score: 0.55 };
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load chart image'));
    el.src = uri;
  });

  const canvas = document.createElement('canvas');
  const w = 160;
  const h = Math.max(90, Math.round((img.height / img.width) * w));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { direction: 'BUY', score: 0.55 };
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let green = 0;
  let red = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (g > r + 25 && g > b + 10 && g > 70) green += 1;
    if (r > g + 25 && r > b + 10 && r > 70) red += 1;
  }
  const total = green + red || 1;
  const bull = green / total;
  return {
    direction: bull >= 0.5 ? 'BUY' : 'SELL',
    score: Math.min(0.92, Math.max(0.52, Math.abs(bull - 0.5) * 1.6 + 0.55)),
  };
}

function pipMeta(symbol: string, entry: number): { tp: number; sl: number; note: string } {
  if (symbol === 'XAUUSD') {
    return { tp: 8, sl: 5, note: 'Gold: ~8 / 5 point educational band' };
  }
  if (symbol === 'BTCUSD') {
    return {
      tp: entry * 0.012,
      sl: entry * 0.008,
      note: 'Crypto: ~1.2% TP / 0.8% SL educational band',
    };
  }
  if (['US30', 'NAS100', 'SPX500', 'GER40', 'UK100'].includes(symbol)) {
    return {
      tp: entry * 0.004,
      sl: entry * 0.0025,
      note: 'Index: ~0.4% TP / 0.25% SL educational band',
    };
  }
  if (symbol.includes('JPY')) {
    return { tp: 0.25, sl: 0.15, note: 'JPY pair: ~25 / 15 pip educational band' };
  }
  return { tp: 0.0025, sl: 0.0015, note: 'FX: ~25 / 15 pip educational band' };
}

function formatPrice(symbol: string, n: number): number {
  if (symbol.includes('JPY')) return Number(n.toFixed(3));
  if (
    symbol.startsWith('XAU') ||
    symbol === 'US30' ||
    symbol === 'NAS100' ||
    symbol.startsWith('BTC') ||
    symbol === 'SPX500' ||
    symbol === 'GER40' ||
    symbol === 'UK100'
  ) {
    return Number(n.toFixed(2));
  }
  return Number(n.toFixed(5));
}

export async function analyzeChartImage(
  imageUri: string,
  onProgress?: (msg: string) => void,
): Promise<ChartSignal> {
  onProgress?.('Reading chart text…');
  const worker = await createWorker('eng', 1, {
    logger: () => undefined,
  });
  let ocrText = '';
  try {
    const {
      data: { text },
    } = await worker.recognize(imageUri);
    ocrText = text ?? '';
  } finally {
    await worker.terminate();
  }

  onProgress?.('Measuring candle colour bias…');
  const { symbol, confidence: symbolConfidence } = detectSymbol(ocrText);
  const prices = extractPrices(ocrText);
  const entry = pickEntry(prices, symbol);
  const bias = await colourBias(imageUri);
  const direction = bias.direction;

  const fallbackEntry =
    entry ??
    (symbol === 'XAUUSD'
      ? 2350
      : symbol === 'US30'
        ? 39000
        : symbol === 'NAS100'
          ? 17800
          : symbol.includes('JPY')
            ? 150.25
            : 1.085);

  const { tp, sl, note } = pipMeta(symbol, fallbackEntry);
  const takeProfit = direction === 'BUY' ? fallbackEntry + tp : fallbackEntry - tp;
  const stopLoss = direction === 'BUY' ? fallbackEntry - sl : fallbackEntry + sl;

  const rationale =
    direction === 'BUY'
      ? 'Chart colour bias leans bullish (more green candle mass than red). Educational BUY bias only.'
      : 'Chart colour bias leans bearish (more red candle mass than green). Educational SELL bias only.';

  const notes = [
    symbolConfidence === 'low' ? 'Symbol uncertain — confirm or edit below.' : null,
    entry == null
      ? 'Entry inferred from typical quote band (OCR price not clear).'
      : 'Entry taken from OCR prices on the chart.',
    note,
  ]
    .filter(Boolean)
    .join(' ');

  onProgress?.('Building signal…');

  return {
    symbol,
    symbolConfidence,
    direction,
    entry: formatPrice(symbol, fallbackEntry),
    takeProfit: formatPrice(symbol, takeProfit),
    stopLoss: formatPrice(symbol, stopLoss),
    confidence: Math.round(
      bias.score * (symbolConfidence === 'high' ? 100 : symbolConfidence === 'medium' ? 88 : 70),
    ),
    rationale,
    notes,
    ocrTextSample: ocrText.slice(0, 280).trim(),
    imageUri,
  };
}
