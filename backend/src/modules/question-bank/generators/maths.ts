import { Complexity, GeneratedQuestion } from './types';
import { int, numericOptions, pick } from './random';

type Gen = () => GeneratedQuestion;

const q = (text: string, answer: number, explanation: string): GeneratedQuestion => ({
  text, ...numericOptions(answer), explanation,
});

const low: Gen[] = [
  () => { const a = int(5, 60), b = int(5, 40); return q(`What is ${a} + ${b}?`, a + b, `${a} + ${b} = ${a + b}`); },
  () => { const a = int(30, 99), b = int(1, 29); return q(`What is ${a} − ${b}?`, a - b, `${a} − ${b} = ${a - b}`); },
  () => { const a = int(2, 10), b = int(2, 10); return q(`What is ${a} × ${b}?`, a * b, `${a} × ${b} = ${a * b}`); },
  () => { const b = int(2, 10), ans = int(2, 10); return q(`What is ${b * ans} ÷ ${b}?`, ans, `${b} × ${ans} = ${b * ans}`); },
  () => { const n = int(3, 9), p = int(2, 9); return q(`A box has ${n} pencils. How many pencils are in ${p} boxes?`, n * p, `${n} × ${p} = ${n * p}`); },
];

const medium: Gen[] = [
  () => { const a = int(100, 999), b = int(100, 999); return q(`What is ${a} + ${b}?`, a + b, `${a} + ${b} = ${a + b}`); },
  () => { const a = int(12, 45), b = int(11, 29); return q(`What is ${a} × ${b}?`, a * b, `${a} × ${b} = ${a * b}`); },
  () => { const b = int(6, 19), ans = int(12, 60); return q(`What is ${b * ans} ÷ ${b}?`, ans, `${b} × ${ans} = ${b * ans}`); },
  () => { const p = pick([10, 20, 25, 50, 75]), n = int(2, 20) * 20; return q(`What is ${p}% of ${n}?`, (p * n) / 100, `${p}/100 × ${n} = ${(p * n) / 100}`); },
  () => { const x = int(2, 15), a = int(2, 9), b = int(1, 30); return q(`Solve for x: ${a}x + ${b} = ${a * x + b}`, x, `${a}x = ${a * x}, so x = ${x}`); },
  () => { const s = int(4, 25); return q(`What is the perimeter of a square with side ${s} cm (in cm)?`, 4 * s, `4 × ${s} = ${4 * s}`); },
];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const high: Gen[] = [
  () => { const n = int(11, 35); return q(`What is ${n}²?`, n * n, `${n} × ${n} = ${n * n}`); },
  () => { const n = int(12, 40); return q(`What is √${n * n}?`, n, `${n} × ${n} = ${n * n}`); },
  () => { const a = int(4, 30) * 2, b = int(4, 30) * 3, g = gcd(a, b); return q(`What is the HCF of ${a} and ${b}?`, g, `Greatest common factor of ${a} and ${b} is ${g}`); },
  () => { const a = int(4, 15), b = int(4, 15), l = (a * b) / gcd(a, b); return q(`What is the LCM of ${a} and ${b}?`, l, `LCM = ${a} × ${b} ÷ HCF(${gcd(a, b)}) = ${l}`); },
  () => { const x = int(3, 20), a = int(3, 12), b = int(5, 60), c = int(2, 6); const rhs = a * x - b; return q(`Solve for x: ${a}x − ${b} = ${rhs}. What is ${c}x?`, c * x, `${a}x = ${rhs + b}, x = ${x}, ${c}x = ${c * x}`); },
  () => { const p = int(1, 9) * 1000, r = pick([5, 8, 10, 12]), t = int(2, 5); const si = (p * r * t) / 100; return q(`Simple interest on ₹${p} at ${r}% per annum for ${t} years is?`, si, `SI = P×R×T/100 = ${p}×${r}×${t}/100 = ${si}`); },
  () => { const sp = int(2, 9) * 100, pct = pick([10, 20, 25, 50]); const cp = (sp * 100) / (100 + pct); if (!Number.isInteger(cp)) return q(`What is 15% of 240?`, 36, '0.15 × 240 = 36'); return q(`An item sold for ₹${sp} gives a ${pct}% profit. What was the cost price (₹)?`, cp, `CP = SP × 100 / (100 + ${pct}) = ${cp}`); },
];

const pools: Record<Complexity, Gen[]> = { low, medium, high };

export const generateMaths = (complexity: Complexity): GeneratedQuestion => pick(pools[complexity])();
