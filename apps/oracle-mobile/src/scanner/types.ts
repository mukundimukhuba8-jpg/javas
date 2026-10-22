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
