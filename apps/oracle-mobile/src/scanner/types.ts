export type SignalDirection = 'BUY' | 'SELL';

export type ChartSignal = {
  symbol: string;
  symbolConfidence: 'high' | 'medium' | 'low';
  direction: SignalDirection;
  entry: number | null;
  takeProfit: number;
  stopLoss: number;
  confidence: number;
  rationale: string;
  notes: string;
  ocrTextSample: string;
  imageUri: string;
};

/** Explicit reject — never invent BUY/SELL/TP/SL for non-chart photos. */
export type ChartReject = {
  ok: false;
  reason: 'not_a_chart';
  message: string;
  imageUri: string;
  detectionScore?: number;
};

export type ChartAnalyzeOk = {
  ok: true;
  signal: ChartSignal;
};

export type ChartAnalyzeResult = ChartAnalyzeOk | ChartReject;
