/**
 * tttsルーター
 */
import * as cinerino from '@cinerino/domain';

import { Router } from 'express';

import placeOrderTransactionsRouter from './ttts/transactions/placeOrder';

const tttsRouter = Router();

tttsRouter.use(`/transactions/${cinerino.factory.transactionType.PlaceOrder}`, placeOrderTransactionsRouter);

export default tttsRouter;
