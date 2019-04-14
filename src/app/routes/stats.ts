/**
 * 統計ルーター
 */
import * as express from 'express';
import * as mongoose from 'mongoose';

const statsRouter = express.Router();

import { OK } from 'http-status';

statsRouter.get(
    '/dbStats',
    async (_, res, next) => {
        try {
            const stats = await mongoose.connection.db.stats();

            res.status(OK)
                .json(stats);
        } catch (error) {
            next(error);
        }
    });

export default statsRouter;
