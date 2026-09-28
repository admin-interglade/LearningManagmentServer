import { ValueTransformer } from 'typeorm';

// pg returns DECIMAL as string; expose it as number in the app
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};
