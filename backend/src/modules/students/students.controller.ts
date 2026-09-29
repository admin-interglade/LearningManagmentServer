import { RequestHandler } from 'express';
import { z } from 'zod';
import { paginationSchema, parseQuery } from '../../common/validate';
import * as svc from './students.service';
import { createUser, patchStudent } from '../users/users.service';

const listQuery = paginationSchema.extend({ search: z.string().trim().optional() });

export const list: RequestHandler = async (req, res) => { res.json(await svc.listStudents(parseQuery(listQuery, req.query))); };
export const get: RequestHandler = async (req, res) => { res.json(await svc.getStudent(String(req.params.id))); };
export const create: RequestHandler = async (req, res) => { res.status(201).json({ user: await createUser(req.body, 'student') }); };
export const update: RequestHandler = async (req, res) => { res.json({ user: await patchStudent(String(req.params.id), req.body) }); };
