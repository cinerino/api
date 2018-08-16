/**
 * devルーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
import { NO_CONTENT } from 'http-status';

import mongooseConnectionOptions from '../../mongooseConnectionOptions';

const devRouter = express.Router();

devRouter.get(
    '/500',
    () => {
        throw new Error('500 manually');
    });

devRouter.get(
    '/environmentVariables',
    (__, res) => {
        res.json(process.env);
    });

devRouter.get(
    '/mongoose/connect',
    async (__, res) => {
        await cinerino.mongoose.connect(<string>process.env.MONGOLAB_URI, mongooseConnectionOptions);
        res.status(NO_CONTENT).end();
    });

export default devRouter;
