import { RequestHandler } from 'express';
import { userId } from '../../common/auth.middleware';
import * as auth from './auth.service';
import { getUserById } from '../users/users.service';

export const register: RequestHandler = async (req, res) => {
  res.status(201).json(await auth.register(req.body));
};
export const login: RequestHandler = async (req, res) => {
  res.json(await auth.login(req.body.identifier, req.body.password));
};
export const me: RequestHandler = async (req, res) => {
  res.json({ user: await getUserById(userId(req)) });
};
export const forgotPassword: RequestHandler = async (req, res) => {
  res.json(await auth.forgotPassword(req.body.identifier));
};
export const resetPassword: RequestHandler = async (req, res) => {
  res.json(await auth.resetPassword(req.body.token, req.body.password));
};
export const changePassword: RequestHandler = async (req, res) => {
  res.json(await auth.changePassword(userId(req), req.body));
};
