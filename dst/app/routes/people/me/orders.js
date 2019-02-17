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
 * 自分の注文ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const mongoose = require("mongoose");
const authentication_1 = require("../../../middlewares/authentication");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
const ordersRouter = express_1.Router();
ordersRouter.use(authentication_1.default);
/**
 * 注文検索
 */
ordersRouter.get('', permitScopes_1.default(['aws.cognito.signin.user.admin']), (req, __2, next) => {
    req.checkQuery('orderDateFrom')
        .notEmpty()
        .withMessage('required')
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    req.checkQuery('orderDateThrough')
        .notEmpty()
        .withMessage('required')
        .isISO8601()
        .withMessage('must be ISO8601')
        .toDate();
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const searchConditions = Object.assign({}, req.query, { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, 
            // customer条件を強制的に絞る
            customer: {
                typeOf: cinerino.factory.personType.Person,
                ids: [req.user.sub]
            } });
        const orders = yield orderRepo.search(searchConditions);
        const totalCount = yield orderRepo.count(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(orders);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ordersRouter;
