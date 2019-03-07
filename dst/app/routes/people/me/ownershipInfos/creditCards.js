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
 * 自分のクレジットカードルーター
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const express_1 = require("express");
const http_status_1 = require("http-status");
const permitScopes_1 = require("../../../../middlewares/permitScopes");
const validator_1 = require("../../../../middlewares/validator");
/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';
const creditCardsRouter = express_1.Router();
const debug = createDebug('cinerino-api:router');
/**
 * 会員クレジットカード追加
 */
creditCardsRouter.post('', permitScopes_1.default(['aws.cognito.signin.user.admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? req.user.username : req.user.sub;
        const creditCard = yield cinerino.service.person.creditCard.save(memberId, req.body)();
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
creditCardsRouter.get('', permitScopes_1.default(['aws.cognito.signin.user.admin']), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? req.user.username : req.user.sub;
        const searchCardResults = yield cinerino.service.person.creditCard.find(memberId)();
        debug('searchCardResults:', searchCardResults);
        res.json(searchCardResults);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員クレジットカード削除
 */
creditCardsRouter.delete('/:cardSeq', permitScopes_1.default(['aws.cognito.signin.user.admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? req.user.username : req.user.sub;
        yield cinerino.service.person.creditCard.unsubscribe(memberId, req.params.cardSeq)();
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = creditCardsRouter;
