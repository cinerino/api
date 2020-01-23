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
 * 販売者ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const sellersRouter = express_1.Router();
/**
 * 販売者作成
 */
sellersRouter.post('', permitScopes_1.default(['sellers.*', 'sellers.write']), rateLimit_1.default, ...[
    express_validator_1.body('typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('name.ja')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('name.en')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('parentOrganization.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('parentOrganization.name.ja')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('parentOrganization.name.en')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('telephone')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('url')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isURL(),
    express_validator_1.body('paymentAccepted')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isArray(),
    express_validator_1.body('hasPOS')
        .isArray(),
    express_validator_1.body('areaServed')
        .isArray()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const attributes = Object.assign(Object.assign({}, req.body), { project: req.project });
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const seller = yield sellerRepo.save({ attributes: attributes });
        res.status(http_status_1.CREATED)
            .json(seller);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 販売者検索
 */
sellersRouter.get('', permitScopes_1.default(['sellers.*', 'sellers.read', 'pos']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchCoinditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const sellers = yield sellerRepo.search(searchCoinditions, 
        // 管理者以外にセキュアな情報を露出しないように
        (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined);
        res.set('X-Total-Count', sellers.length.toString());
        res.json(sellers);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDで販売者検索
 */
sellersRouter.get('/:id', permitScopes_1.default(['sellers.*', 'sellers.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const seller = yield sellerRepo.findById({
            id: req.params.id
        }, 
        // 管理者以外にセキュアな情報を露出しないように
        (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined);
        res.json(seller);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 販売者更新
 */
// tslint:disable-next-line:use-default-type-parameter
sellersRouter.put('/:id', permitScopes_1.default(['sellers.*', 'sellers.write']), rateLimit_1.default, ...[
    express_validator_1.body('typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('name.ja')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('name.en')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('parentOrganization.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('parentOrganization.name.ja')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('parentOrganization.name.en')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('telephone')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('url')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isURL(),
    express_validator_1.body('paymentAccepted')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isArray(),
    express_validator_1.body('hasPOS')
        .isArray(),
    express_validator_1.body('areaServed')
        .isArray()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const attributes = Object.assign(Object.assign({}, req.body), { project: req.project });
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        yield sellerRepo.save({ id: req.params.id, attributes: attributes });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 販売者削除
 */
sellersRouter.delete('/:id', permitScopes_1.default(['sellers.*', 'sellers.write']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        yield sellerRepo.deleteById({
            id: req.params.id
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = sellersRouter;
