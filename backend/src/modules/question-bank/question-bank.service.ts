import { z } from 'zod';
import { query, queryOne } from '../../db/pool';
import { notFound } from '../../common/errors';
import { categorySchema, questionListQuery, questionSchema } from './question-bank.schema';
import { Complexity, generateQuestions, Generator } from './generators';
import { toApiComplexity } from '../../common/complexity';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

interface CategoryRow { id: string; name: string; slug: string; description: string | null; generator: Generator; question_count: number }
const toCategory = (r: CategoryRow) => ({
  id: r.id, name: r.name, slug: r.slug, description: r.description, generator: r.generator, questionCount: r.question_count ?? 0,
});

export async function listCategories() {
  const rows = await query<CategoryRow>(
    `SELECT c.*, (SELECT count(*) FROM questions q WHERE q.category_id = c.id) AS question_count
     FROM question_categories c ORDER BY c.name`,
  );
  return rows.map(toCategory);
}

export async function getCategory(id: string) {
  const row = await queryOne<CategoryRow>(
    `SELECT c.*, (SELECT count(*) FROM questions q WHERE q.category_id = c.id) AS question_count
     FROM question_categories c WHERE c.id = $1`, [id],
  );
  if (!row) throw notFound('Category not found');
  return toCategory(row);
}

export async function createCategory(input: z.infer<typeof categorySchema>) {
  const row = await queryOne<{ id: string }>(
    'INSERT INTO question_categories (name, slug, description, generator) VALUES ($1, $2, $3, $4) RETURNING id',
    [input.name, slugify(input.name), input.description ?? null, input.generator],
  );
  return getCategory(row!.id);
}

export async function updateCategory(id: string, input: z.infer<typeof categorySchema>) {
  const row = await queryOne<{ id: string }>(
    'UPDATE question_categories SET name=$2, slug=$3, description=$4, generator=$5 WHERE id=$1 RETURNING id',
    [id, input.name, slugify(input.name), input.description ?? null, input.generator],
  );
  if (!row) throw notFound('Category not found');
  return getCategory(id);
}

interface QuestionRow {
  id: string; category_id: string; category_name: string; complexity: Complexity; text: string;
  options: string[]; correct_index: number; explanation: string | null; created_at: Date;
}
const toQuestion = (r: QuestionRow) => ({
  id: r.id, categoryId: r.category_id, category: r.category_name, complexity: toApiComplexity(r.complexity), text: r.text,
  options: r.options, correctIndex: r.correct_index, explanation: r.explanation, createdAt: r.created_at,
});
const QUESTION_SELECT = `SELECT q.*, c.name AS category_name FROM questions q JOIN question_categories c ON c.id = q.category_id`;

export async function listQuestions(f: z.infer<typeof questionListQuery>) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.categoryId) { params.push(f.categoryId); where.push(`q.category_id = $${params.length}`); }
  if (f.complexity) { params.push(f.complexity); where.push(`q.complexity = $${params.length}`); }
  if (f.search) { params.push(`%${f.search}%`); where.push(`q.text ILIKE $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await queryOne<{ n: number }>(`SELECT count(*) AS n FROM questions q ${whereSql}`, params);
  const rows = await query<QuestionRow>(
    `${QUESTION_SELECT} ${whereSql} ORDER BY q.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize],
  );
  return { items: rows.map(toQuestion), total: total!.n, page: f.page, pageSize: f.pageSize };
}

async function getQuestion(id: string) {
  const row = await queryOne<QuestionRow>(`${QUESTION_SELECT} WHERE q.id = $1`, [id]);
  if (!row) throw notFound('Question not found');
  return toQuestion(row);
}

export async function createQuestion(input: z.infer<typeof questionSchema>) {
  await getCategory(input.categoryId);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO questions (category_id, complexity, text, options, correct_index, explanation)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.categoryId, input.complexity, input.text, JSON.stringify(input.options), input.correctIndex, input.explanation ?? null],
  );
  return getQuestion(row!.id);
}

export async function updateQuestion(id: string, input: z.infer<typeof questionSchema>) {
  const row = await queryOne<{ id: string }>(
    `UPDATE questions SET category_id=$2, complexity=$3, text=$4, options=$5, correct_index=$6, explanation=$7
     WHERE id=$1 RETURNING id`,
    [id, input.categoryId, input.complexity, input.text, JSON.stringify(input.options), input.correctIndex, input.explanation ?? null],
  );
  if (!row) throw notFound('Question not found');
  return getQuestion(id);
}

export async function deleteQuestion(id: string) {
  const row = await queryOne('DELETE FROM questions WHERE id = $1 RETURNING id', [id]);
  if (!row) throw notFound('Question not found');
  return { ok: true };
}

export async function previewQuestions(categoryId: string, complexity: Complexity, count: number) {
  const category = await getCategory(categoryId);
  const qs = await generateQuestions(category, complexity, count);
  return qs.map(({ text, options, correctIndex, explanation }) => ({
    text, options, correctIndex, explanation, category: category.name, complexity: toApiComplexity(complexity),
  }));
}
