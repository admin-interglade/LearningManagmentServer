// DECIMAL columns come back from pg as strings; keep arithmetic in paise/cents to avoid float drift
export const toNumber = (value: string | number | null | undefined): number => Number(value ?? 0);

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export const toMinorUnits = (value: string | number): number => Math.round(toNumber(value) * 100);
