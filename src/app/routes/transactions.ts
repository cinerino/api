/**
 * 取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import { Router } from 'express';

import moneyTransferTransactionsRouter from './transactions/moneyTransfer';
import placeOrderTransactionsRouter from './transactions/placeOrder';
import returnOrderTransactionsRouter from './transactions/returnOrder';

const transactionsRouter = Router();

if (process.env.USE_MONEY_TRANSFER === '1') {
    transactionsRouter.use(`/${cinerino.factory.transactionType.MoneyTransfer}`, moneyTransferTransactionsRouter);
}
transactionsRouter.use(`/${cinerino.factory.transactionType.PlaceOrder}`, placeOrderTransactionsRouter);
transactionsRouter.use(`/${cinerino.factory.transactionType.ReturnOrder}`, returnOrderTransactionsRouter);

export default transactionsRouter;
