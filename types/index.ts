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

// Future thought:
export interface NewsEvent {
  m: string;
  i: number;
  u: number;
  isPolitical?: boolean; // If true, maybe it affects a "Reputation" bar?
}
