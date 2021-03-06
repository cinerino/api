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
 * 自分のクレジットカードルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../../../middlewares/permitScopes");
const rateLimit_1 = require("../../../../middlewares/rateLimit");
const validator_1 = require("../../../../middlewares/validator");
function checkUseMyCreditCards(project) {
    var _a;
    if (((_a = project.settings) === null || _a === void 0 ? void 0 : _a.useMyCreditCards) !== true) {
        throw new cinerino.factory.errors.Forbidden('my credit cards service unavailable');
    }
}
const creditCardsRouter = express_1.Router();
/**
 * 会員クレジットカード追加
 */
creditCardsRouter.post('', permitScopes_1.default(['people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        checkUseMyCreditCards(project);
        const credentials = yield cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
            project: { id: req.project.id },
            paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
        });
        const useUsernameAsGMOMemberId = ((_a = project.settings) === null || _a === void 0 ? void 0 : _a.useUsernameAsGMOMemberId) === true;
        const memberId = (useUsernameAsGMOMemberId) ? req.user.username : req.user.sub;
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: credentials.siteId,
            sitePass: credentials.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
        });
        const creditCard = yield creditCardRepo.save({
            personId: memberId,
            creditCard: req.body
        });
        res.status(http_status_1.CREATED)
            .json(creditCard);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員クレジットカード検索
 */
creditCardsRouter.get('', permitScopes_1.default(['people.me.*']), rateLimit_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        checkUseMyCreditCards(project);
        const credentials = yield cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
            project: { id: req.project.id },
            paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
        });
        const useUsernameAsGMOMemberId = ((_b = project.settings) === null || _b === void 0 ? void 0 : _b.useUsernameAsGMOMemberId) === true;
        const memberId = (useUsernameAsGMOMemberId) ? req.user.username : req.user.sub;
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: credentials.siteId,
            sitePass: credentials.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
        });
        const searchCardResults = yield creditCardRepo.search({ personId: memberId });
        res.json(searchCardResults);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員クレジットカード削除
 */
creditCardsRouter.delete('/:cardSeq', permitScopes_1.default(['people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        checkUseMyCreditCards(project);
        const credentials = yield cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
            project: { id: req.project.id },
            paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
        });
        const useUsernameAsGMOMemberId = ((_c = project.settings) === null || _c === void 0 ? void 0 : _c.useUsernameAsGMOMemberId) === true;
        const memberId = (useUsernameAsGMOMemberId) ? req.user.username : req.user.sub;
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: credentials.siteId,
            sitePass: credentials.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
        });
        yield creditCardRepo.deleteBySequenceNumber({
            personId: memberId,
            cardSeq: req.params.cardSeq
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = creditCardsRouter;
