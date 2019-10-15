"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * tttsルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const orders_1 = require("./ttts/orders");
const placeOrder_1 = require("./ttts/transactions/placeOrder");
const returnOrder_1 = require("./ttts/transactions/returnOrder");
const tttsRouter = express_1.Router();
tttsRouter.use('/orders', orders_1.default);
tttsRouter.use(`/transactions/${cinerino.factory.transactionType.PlaceOrder}`, placeOrder_1.default);
tttsRouter.use(`/transactions/${cinerino.factory.transactionType.ReturnOrder}`, returnOrder_1.default);
exports.default = tttsRouter;
