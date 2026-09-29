import { randomInt } from 'crypto';

/** Inclusive integer in [min, max]. */
export const int = (min: number, max: number) => randomInt(min, max + 1);
export const pick = <T>(items: readonly T[]): T => items[randomInt(items.length)];

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Builds a 4-option MCQ from a numeric answer with plausible, distinct distractors. */
export function numericOptions(answer: number, spread = Math.max(3, Math.round(Math.abs(answer) * 0.15))) {
  const set = new Set<number>([answer]);
  const candidates = [answer + 1, answer - 1, answer + 10, answer - 10, answer * 2, Math.round(answer / 2)];
  for (const c of shuffle(candidates)) {
    if (set.size >= 4) break;
    if (c !== answer && c >= 0 === answer >= 0) set.add(c);
  }
  while (set.size < 4) {
    const delta = int(1, spread) * (int(0, 1) ? 1 : -1);
    set.add(answer + delta);
  }
  return withAnswer([...set].map(String), String(answer));
}

/** Shuffles options and returns the index of the answer. */
export function withAnswer(options: string[], answer: string) {
  const shuffled = shuffle(options);
  return { options: shuffled, correctIndex: shuffled.indexOf(answer) };
}
