/**
 * tttsルーター
 */
import * as cinerino from '@cinerino/domain';

import { Router } from 'express';

import placeOrderTransactionsRouter from './ttts/transactions/placeOrder';
import returnOrderTransactionsRouter from './ttts/transactions/returnOrder';

const tttsRouter = Router();

tttsRouter.use(`/transactions/${cinerino.factory.transactionType.PlaceOrder}`, placeOrderTransactionsRouter);
tttsRouter.use(`/transactions/${cinerino.factory.transactionType.ReturnOrder}`, returnOrderTransactionsRouter);

export default tttsRouter;
