"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ムビチケ決済方法ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const movieTicketPaymentMethodsRouter = express_1.Router();
movieTicketPaymentMethodsRouter.use(authentication_1.default);
movieTicketPaymentMethodsRouter.get('', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const paymentMethodRepo = new cinerino.repository.PaymentMethod(mongoose.connection);
        const searchCoinditions = Object.assign({}, req.query, { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const paymentMethods = yield paymentMethodRepo.searchMovieTickets(searchCoinditions);
        const totalCount = yield paymentMethodRepo.countMovieTickets(searchCoinditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(paymentMethods);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = movieTicketPaymentMethodsRouter;
