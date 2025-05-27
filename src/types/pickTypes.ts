// types/PickTypes.ts
export type LegResult = {
  outcome: 'win' | 'loss' | 'push' | 'void';
  units_result: number;
  [key: string]: any;
};

export type OutcomeInfo = {
  outcome: string;
  units_result: number;
  legResults?: LegResult[] | null;
};
