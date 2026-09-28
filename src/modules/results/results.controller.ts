import { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth.middleware';
import { ok } from '../../common/utils/response';
import { resultsService } from './results.service';
import { LeaderboardQuery } from './results.validation';

export const resultsController = {
  async getLeaderboard(req: Request, res: Response) {
    const query = req.query as unknown as LeaderboardQuery;
    ok(res, await resultsService.getLeaderboard(req.params.examId as string, query, currentUser(req)));
  },
};
