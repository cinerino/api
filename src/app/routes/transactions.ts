/**
 * 取引ルーター
 */
import { Router } from 'express';

import placeOrderTransactionsRouter from './transactions/placeOrder';
import returnOrderTransactionsRouter from './transactions/returnOrder';

const transactionsRouter = Router();
transactionsRouter.use('/placeOrder', placeOrderTransactionsRouter);
transactionsRouter.use('/returnOrder', returnOrderTransactionsRouter);

export default transactionsRouter;
