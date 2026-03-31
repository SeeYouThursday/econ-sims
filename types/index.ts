export interface EconomicData {
  q: number;
  inf: number;
  unp: number;
  rate: number;
}

export interface NewsEvent {
  m: string; // message
  i: number; // inflation impact
  u: number; // unemployment impact
}

export interface GradeResult {
  letter: string;
  title: string;
  text: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}

export interface ReportCardProps {
  history: EconomicData[];
  onRestart: () => void;
}

export interface StockHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockInfo {
  symbol: string;
  name: string;
  description: string;
}

// Future thought:
export interface NewsEvent {
  m: string;
  i: number;
  u: number;
  isPolitical?: boolean; // If true, maybe it affects a "Reputation" bar?
}

export interface CustomizedLabelProps {
  x?: number;
  y?: number;
  color?: string;
  text?: string;
  index?: number;
  lastIndex?: number;
}

export interface CompactStatProps {
  title: string;
  val: number;
  color: string;
  icon: React.ReactNode;
}
