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
const paymentCard_1 = require("./payment/paymentCard");
const paymentRouter = express_1.Router();
paymentRouter.use('/any', any_1.default);
paymentRouter.use(`/Account`, account_1.default); // PaymentCardに統合前に対する互換性維持対応
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.CreditCard}`, creditCard_1.default);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.MovieTicket}`, movieTicket_1.default);
paymentRouter.use(`/${cinerino.factory.chevre.service.paymentService.PaymentServiceType.PaymentCard}`, paymentCard_1.default);
exports.default = paymentRouter;
