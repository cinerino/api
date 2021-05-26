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
 * プロダクトルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const productsRouter = express_1.Router();
/**
 * 検索
 */
productsRouter.get('', permitScopes_1.default(['products.*', 'products.read']), rateLimit_1.default, ...[
    express_validator_1.query('typeOf')
        .not()
        .isEmpty()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined });
        const productService = new cinerino.chevre.service.Product({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const { data } = yield productService.search(Object.assign(Object.assign({}, searchConditions), {
        // $projection: {
        //     'availableChannel.credentials': 0,
        //     'availableChannel.serviceUrl': 0,
        //     'provider.credentials.shopPass': 0,
        //     'provider.credentials.kgygishCd': 0,
        //     'provider.credentials.stCd': 0
        // }
        }));
        res.json(data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * オファー検索
 */
// tslint:disable-next-line:use-default-type-parameter
productsRouter.get('/:id/offers', permitScopes_1.default(['products.*', 'products.read']), rateLimit_1.default, ...[
    express_validator_1.query('seller.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const productService = new cinerino.chevre.service.Product({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const offers = yield cinerino.service.offer.product.search({
            project: { id: req.project.id },
            itemOffered: { id: req.params.id },
            seller: { id: (_a = req.query.seller) === null || _a === void 0 ? void 0 : _a.id },
            availableAt: { id: req.user.client_id }
        })({ product: productService });
        res.json(offers);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = productsRouter;
