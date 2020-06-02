"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 決済方法ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const movieTicket_1 = require("./paymentMethods/movieTicket");
const paymentMethodsRouter = express_1.Router();
paymentMethodsRouter.use(`/${cinerino.factory.paymentMethodType.MovieTicket}`, movieTicket_1.default);
exports.default = paymentMethodsRouter;
