/**
 * IAMルーター
 */
import * as express from 'express';
import iamMembersRouter from './iam/members';

const iamRouter = express.Router();

iamRouter.use('/members', iamMembersRouter);

export default iamRouter;
