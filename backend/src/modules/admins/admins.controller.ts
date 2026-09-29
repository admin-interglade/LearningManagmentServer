import { RequestHandler } from 'express';
import * as svc from './admins.service';

export const list: RequestHandler = async (_req, res) => { res.json(await svc.listAdmins()); };
export const create: RequestHandler = async (req, res) => { res.status(201).json({ user: await svc.createAdmin(req.body) }); };
