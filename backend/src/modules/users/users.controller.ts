import { RequestHandler } from 'express';
import { userId } from '../../common/auth.middleware';
import * as users from './users.service';

export const getProfile: RequestHandler = async (req, res) => {
  res.json({ user: await users.getUserById(userId(req)) });
};
export const updateProfile: RequestHandler = async (req, res) => {
  res.json({ user: await users.updateProfile(userId(req), req.body) });
};
