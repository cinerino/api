/**
 * tttsルーター
 */
import * as cinerino from '@cinerino/domain';

import { Router } from 'express';

import ordersRouter from './ttts/orders';
import placeOrderTransactionsRouter from './ttts/transactions/placeOrder';
import returnOrderTransactionsRouter from './ttts/transactions/returnOrder';

const tttsRouter = Router();

tttsRouter.use('/orders', ordersRouter);
tttsRouter.use(`/transactions/${cinerino.factory.transactionType.PlaceOrder}`, placeOrderTransactionsRouter);
tttsRouter.use(`/transactions/${cinerino.factory.transactionType.ReturnOrder}`, returnOrderTransactionsRouter);

export default tttsRouter;
