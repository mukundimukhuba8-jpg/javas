export type TradeSymbol = {
  id: string;
  name: string;
  category: 'Forex' | 'Metals' | 'Indices' | 'Crypto';
  description: string;
};

/** Sensible default watchlist for the Quotes picker. */
export const TRADE_SYMBOLS: TradeSymbol[] = [
  { id: 'EURUSD', name: 'EURUSD', category: 'Forex', description: 'Euro / US Dollar' },
  { id: 'GBPUSD', name: 'GBPUSD', category: 'Forex', description: 'British Pound / US Dollar' },
  { id: 'USDJPY', name: 'USDJPY', category: 'Forex', description: 'US Dollar / Japanese Yen' },
  { id: 'USDCHF', name: 'USDCHF', category: 'Forex', description: 'US Dollar / Swiss Franc' },
  { id: 'AUDUSD', name: 'AUDUSD', category: 'Forex', description: 'Australian Dollar / US Dollar' },
  { id: 'USDCAD', name: 'USDCAD', category: 'Forex', description: 'US Dollar / Canadian Dollar' },
  { id: 'NZDUSD', name: 'NZDUSD', category: 'Forex', description: 'New Zealand Dollar / US Dollar' },
  { id: 'EURGBP', name: 'EURGBP', category: 'Forex', description: 'Euro / British Pound' },
  { id: 'EURJPY', name: 'EURJPY', category: 'Forex', description: 'Euro / Japanese Yen' },
  { id: 'GBPJPY', name: 'GBPJPY', category: 'Forex', description: 'British Pound / Japanese Yen' },
  { id: 'XAUUSD', name: 'XAUUSD', category: 'Metals', description: 'Gold / US Dollar' },
  { id: 'XAGUSD', name: 'XAGUSD', category: 'Metals', description: 'Silver / US Dollar' },
  { id: 'US30', name: 'US30', category: 'Indices', description: 'Dow Jones Industrial Average' },
  { id: 'NAS100', name: 'NAS100', category: 'Indices', description: 'Nasdaq 100' },
  { id: 'SPX500', name: 'SPX500', category: 'Indices', description: 'S&P 500' },
  { id: 'GER40', name: 'GER40', category: 'Indices', description: 'DAX 40' },
  { id: 'UK100', name: 'UK100', category: 'Indices', description: 'FTSE 100' },
  { id: 'BTCUSD', name: 'BTCUSD', category: 'Crypto', description: 'Bitcoin / US Dollar' },
  { id: 'ETHUSD', name: 'ETHUSD', category: 'Crypto', description: 'Ethereum / US Dollar' },
];
