"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 自分の注文ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const rateLimit_1 = require("../../../middlewares/rateLimit");
const validator_1 = require("../../../middlewares/validator");
const ordersRouter = express_1.Router();
/**
 * 注文検索
 */
ordersRouter.get('', permitScopes_1.default(['people.me.*']), rateLimit_1.default, ...[
    express_validator_1.query('orderDateFrom')
        .not()
        .isEmpty()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDateThrough')
        .not()
        .isEmpty()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDate.$gte')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('orderDate.$lte')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, 
            // customer条件を強制的に絞る
            customer: {
                typeOf: cinerino.factory.personType.Person,
                ids: [req.user.sub]
            } });
        const orders = yield orderRepo.search(searchConditions);
        res.json(orders);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ordersRouter;
