import { Complexity, GeneratedQuestion } from './types';
import { int, numericOptions, pick, withAnswer } from './random';

type Gen = () => GeneratedQuestion;
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function series(terms: number[], next: number, rule: string): GeneratedQuestion {
  return { text: `Find the next number in the series: ${terms.join(', ')}, ?`, ...numericOptions(next), explanation: rule };
}

function letterSeries(start: number, step: number, count: number): GeneratedQuestion {
  const letters = Array.from({ length: count + 1 }, (_, i) => ALPHA[(start + i * step) % 26]);
  const answer = letters.pop()!;
  const distractors = new Set<string>();
  while (distractors.size < 3) {
    const d = ALPHA[(ALPHA.indexOf(answer) + int(1, 5) * (int(0, 1) ? 1 : -1) + 26) % 26];
    if (d !== answer) distractors.add(d);
  }
  return {
    text: `Find the next letter in the series: ${letters.join(', ')}, ?`,
    ...withAnswer([answer, ...distractors], answer),
    explanation: `Each letter moves ${step} place${step > 1 ? 's' : ''} forward.`,
  };
}

function oddOneOut(): GeneratedQuestion {
  const k = pick([3, 4, 5, 7]);
  const multiples = new Set<number>();
  while (multiples.size < 3) multiples.add(k * int(2, 12));
  let odd = int(10, 90);
  while (odd % k === 0) odd++;
  const answer = String(odd);
  return {
    text: `Which number is the odd one out? ${[...multiples, odd].sort((a, b) => a - b).join(', ')}`,
    ...withAnswer([...[...multiples].map(String), answer], answer),
    explanation: `All other numbers are multiples of ${k}.`,
  };
}

function coding(shift: number): GeneratedQuestion {
  const words = ['CAT', 'DOG', 'SUN', 'BOOK', 'TREE', 'FISH', 'MILK', 'STAR', 'GAME', 'LION'];
  const [w1, w2] = [pick(words), pick(words.filter((w) => w.length >= 3))];
  const enc = (w: string) => [...w].map((c) => ALPHA[(ALPHA.indexOf(c) + shift) % 26]).join('');
  const answer = enc(w2);
  const distractors = new Set<string>();
  for (const s of [shift + 1, shift - 1, shift + 2, -shift]) {
    const d = [...w2].map((c) => ALPHA[(ALPHA.indexOf(c) + s + 26) % 26]).join('');
    if (d !== answer) distractors.add(d);
    if (distractors.size === 3) break;
  }
  return {
    text: `If ${w1} is written as ${enc(w1)}, how is ${w2} written in the same code?`,
    ...withAnswer([answer, ...distractors], answer),
    explanation: `Each letter is shifted ${shift} place${shift > 1 ? 's' : ''} forward in the alphabet.`,
  };
}

const low: Gen[] = [
  () => { const a = int(1, 20), d = int(2, 9); const t = [0, 1, 2, 3, 4].map((i) => a + i * d); return series(t, a + 5 * d, `Add ${d} each time.`); },
  () => letterSeries(int(0, 10), int(1, 2), 4),
  () => oddOneOut(),
];

const medium: Gen[] = [
  () => { const a = int(1, 5), r = pick([2, 3]); const t = [0, 1, 2, 3].map((i) => a * r ** i); return series(t, a * r ** 4, `Multiply by ${r} each time.`); },
  () => { const a = int(1, 10), d = int(1, 4); const t = [a]; for (let i = 1; i < 5; i++) t.push(t[i - 1] + d * i); return series(t, t[4] + d * 5, `Differences increase by ${d}: ${d}, ${2 * d}, ${3 * d}, …`); },
  () => letterSeries(int(0, 5), int(2, 4), 4),
  () => coding(int(1, 3)),
];

const high: Gen[] = [
  () => { const o = int(1, 4); const t = [1, 2, 3, 4, 5].map((n) => (n + o) ** 2); return series(t, (6 + o) ** 2, `Squares of consecutive numbers starting at ${1 + o}.`); },
  () => { const a = int(1, 5), b = int(1, 5); const t = [a, b]; for (let i = 2; i < 6; i++) t.push(t[i - 1] + t[i - 2]); return series(t, t[4] + t[5], 'Each number is the sum of the two before it.'); },
  () => { const a = int(2, 9), d1 = int(2, 5), d2 = int(1, 3) * 10; const t = [a]; for (let i = 1; i < 6; i++) t.push(t[i - 1] + (i % 2 ? d1 : d2)); return series(t, t[5] + d1, `Alternately add ${d1} and ${d2}.`); },
  () => { const t = [1, 2, 3, 4, 5].map((n) => n ** 3 + 1); return series(t, 6 ** 3 + 1, 'n³ + 1 for n = 1, 2, 3, …'); },
  () => coding(int(2, 5)),
];

const pools: Record<Complexity, Gen[]> = { low, medium, high };

export const generateReasoning = (complexity: Complexity): GeneratedQuestion => pick(pools[complexity])();
