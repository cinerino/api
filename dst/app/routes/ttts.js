"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * tttsルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const placeOrder_1 = require("./ttts/transactions/placeOrder");
const tttsRouter = express_1.Router();
tttsRouter.use(`/transactions/${cinerino.factory.transactionType.PlaceOrder}`, placeOrder_1.default);
exports.default = tttsRouter;
