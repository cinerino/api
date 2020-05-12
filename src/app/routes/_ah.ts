/**
 * ahルーター
 */
import * as express from 'express';

const ahRouter = express.Router();

ahRouter.get(
    '/warmup',
    async (_, res, next) => {
        try {
            res.send('warmup done!');
        } catch (error) {
            next(error);
        }
    }
);

export default ahRouter;
