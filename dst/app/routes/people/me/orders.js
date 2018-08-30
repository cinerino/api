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
const moment = require("moment");
const authentication_1 = require("../../../middlewares/authentication");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
const ordersRouter = express_1.Router();
ordersRouter.use(authentication_1.default);
/**
 * 注文検索
 */
ordersRouter.get('', permitScopes_1.default(['aws.cognito.signin.user.admin']), (req, __2, next) => {
    req.checkQuery('orderDateFrom').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
    req.checkQuery('orderDateThrough').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
        const searchConditions = {
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : /* istanbul ignore next*/ 100,
            page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : /* istanbul ignore next*/ 1,
            sellerIds: (Array.isArray(req.query.sellerIds)) ? req.query.sellerIds : undefined,
            customerMembershipNumbers: [req.user.username],
            orderNumbers: (Array.isArray(req.query.orderNumbers)) ? req.query.orderNumbers : undefined,
            orderStatuses: (Array.isArray(req.query.orderStatuses)) ? req.query.orderStatuses : undefined,
            orderDateFrom: moment(req.query.orderDateFrom).toDate(),
            orderDateThrough: moment(req.query.orderDateThrough).toDate(),
            confirmationNumbers: (Array.isArray(req.query.confirmationNumbers))
                ? req.query.confirmationNumbers
                : undefined,
            reservedEventIds: (Array.isArray(req.query.reservedEventIds))
                ? req.query.reservedEventIds
                : undefined
        };
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
