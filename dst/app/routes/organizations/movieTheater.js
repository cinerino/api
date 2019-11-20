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
 * 劇場組織ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const movieTheaterRouter = express_1.Router();
movieTheaterRouter.use(authentication_1.default);
/**
 * @deprecated Use /sellers
 */
movieTheaterRouter.get('', permitScopes_1.default(['customer', 'organizations', 'organizations.read-only']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchCoinditions = Object.assign(Object.assign({}, req.query), { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const movieTheaters = yield sellerRepo.search(searchCoinditions, 
        // 管理者以外にセキュアな情報を露出しないように
        (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined);
        const totalCount = yield sellerRepo.count(searchCoinditions);
        movieTheaters.forEach((movieTheater) => {
            // 互換性維持のためgmoInfoをpaymentAcceptedから情報追加
            if (Array.isArray(movieTheater.paymentAccepted)) {
                const creditCardPaymentAccepted = movieTheater.paymentAccepted.find((p) => {
                    return p.paymentMethodType === cinerino.factory.paymentMethodType.CreditCard;
                });
                if (creditCardPaymentAccepted !== undefined) {
                    movieTheater.gmoInfo = creditCardPaymentAccepted.gmoInfo;
                }
            }
        });
        res.set('X-Total-Count', totalCount.toString());
        res.json(movieTheaters);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * @deprecated Use /sellers
 */
movieTheaterRouter.get('/:branchCode([0-9]{3})', permitScopes_1.default(['customer', 'organizations', 'organizations.read-only']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const movieTheaters = yield sellerRepo.search({
            location: { branchCodes: [req.params.branchCode] }
        }, 
        // 管理者以外にセキュアな情報を露出しないように
        (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined);
        const movieTheater = movieTheaters.shift();
        if (movieTheater === undefined) {
            throw new cinerino.factory.errors.NotFound('Organization');
        }
        // 互換性維持のためgmoInfoをpaymentAcceptedから情報追加
        if (Array.isArray(movieTheater.paymentAccepted)) {
            const creditCardPaymentAccepted = movieTheater.paymentAccepted.find((p) => {
                return p.paymentMethodType === cinerino.factory.paymentMethodType.CreditCard;
            });
            if (creditCardPaymentAccepted !== undefined) {
                movieTheater.gmoInfo = creditCardPaymentAccepted.gmoInfo;
            }
        }
        res.json(movieTheater);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * @deprecated Use /sellers
 */
movieTheaterRouter.get('/:id', permitScopes_1.default(['customer', 'organizations', 'organizations.read-only']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const movieTheater = yield sellerRepo.findById({
            id: req.params.id
        }, 
        // 管理者以外にセキュアな情報を露出しないように
        (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined);
        res.json(movieTheater);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = movieTheaterRouter;
