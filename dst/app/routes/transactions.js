"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 取引ルーター
 */
const express_1 = require("express");
const placeOrder_1 = require("./transactions/placeOrder");
const returnOrder_1 = require("./transactions/returnOrder");
const transactionsRouter = express_1.Router();
transactionsRouter.use('/placeOrder', placeOrder_1.default);
transactionsRouter.use('/returnOrder', returnOrder_1.default);
exports.default = transactionsRouter;
