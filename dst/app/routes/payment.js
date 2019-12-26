"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 決済ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const account_1 = require("./payment/account");
const any_1 = require("./payment/any");
const creditCard_1 = require("./payment/creditCard");
const movieTicket_1 = require("./payment/movieTicket");
const paymentRouter = express_1.Router();
paymentRouter.use('/any', any_1.default);
paymentRouter.use(`/${cinerino.factory.paymentMethodType.Account}`, account_1.default);
paymentRouter.use(`/${cinerino.factory.paymentMethodType.CreditCard}`, creditCard_1.default);
paymentRouter.use(`/${cinerino.factory.paymentMethodType.MovieTicket}`, movieTicket_1.default);
exports.default = paymentRouter;
