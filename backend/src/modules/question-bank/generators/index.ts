import { Queryable, pool, query } from '../../../db/pool';
import { badRequest } from '../../../common/errors';
import { Complexity, GeneratedQuestion } from './types';
import { generateMaths } from './maths';
import { generateReasoning } from './reasoning';
import { withAnswer } from './random';

export type Generator = 'maths' | 'reasoning' | 'bank';
export type { Complexity, GeneratedQuestion };

function generateUnique(fn: (c: Complexity) => GeneratedQuestion, complexity: Complexity, count: number) {
  const seen = new Set<string>();
  const out: GeneratedQuestion[] = [];
  for (let tries = 0; out.length < count && tries < count * 50; tries++) {
    const q = fn(complexity);
    if (seen.has(q.text) || q.correctIndex < 0 || new Set(q.options).size !== q.options.length) continue;
    seen.add(q.text);
    out.push(q);
  }
  while (out.length < count) out.push(fn(complexity)); // extremely unlikely fallback
  return out;
}

/**
 * Produces `count` questions for a category/complexity.
 * Procedural generators give a fresh set every time; bank categories draw random questions
 * from the admin question bank (options re-shuffled per attempt).
 */
export async function generateQuestions(
  category: { id: string; generator: Generator; name: string },
  complexity: Complexity,
  count: number,
  db: Queryable = pool,
): Promise<GeneratedQuestion[]> {
  if (category.generator === 'maths') return generateUnique(generateMaths, complexity, count);
  if (category.generator === 'reasoning') return generateUnique(generateReasoning, complexity, count);

  const rows = await query<{ id: string; text: string; options: string[]; correct_index: number; explanation: string | null }>(
    `SELECT id, text, options, correct_index, explanation FROM questions
     WHERE category_id = $1 AND complexity = $2 ORDER BY random() LIMIT $3`,
    [category.id, complexity, count], db,
  );
  if (rows.length < count) {
    throw badRequest(`Question bank for "${category.name}" (${complexity}) has only ${rows.length} of ${count} required questions. Please contact the administrator.`);
  }
  return rows.map((r) => ({
    text: r.text,
    ...withAnswer(r.options, r.options[r.correct_index]),
    explanation: r.explanation,
    sourceQuestionId: r.id,
  }));
}
