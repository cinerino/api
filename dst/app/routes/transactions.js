"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 取引ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const moneyTransfer_1 = require("./transactions/moneyTransfer");
const placeOrder_1 = require("./transactions/placeOrder");
const returnOrder_1 = require("./transactions/returnOrder");
const transactionsRouter = express_1.Router();
if (process.env.USE_MONEY_TRANSFER === '1') {
    transactionsRouter.use(`/${cinerino.factory.transactionType.MoneyTransfer}`, moneyTransfer_1.default);
}
transactionsRouter.use(`/${cinerino.factory.transactionType.PlaceOrder}`, placeOrder_1.default);
transactionsRouter.use(`/${cinerino.factory.transactionType.ReturnOrder}`, returnOrder_1.default);
exports.default = transactionsRouter;
