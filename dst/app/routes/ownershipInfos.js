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
 * 認証ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const redis = require("../../redis");
const ownershipInfosRouter = express_1.Router();
ownershipInfosRouter.use(authentication_1.default);
/**
 * コードから所有権に対するアクセストークンを発行する
 */
ownershipInfosRouter.post('/tokens', permitScopes_1.default(['aws.cognito.signin.user.admin', 'tokens']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const codeRepo = new cinerino.repository.Code(redis.getClient());
        const token = yield cinerino.service.code.getToken({
            code: req.body.code,
            secret: process.env.TOKEN_SECRET,
            issuer: process.env.RESOURCE_SERVER_IDENTIFIER,
            // tslint:disable-next-line:no-magic-numbers
            expiresIn: 1800
        })({ code: codeRepo });
        res.json({ token });
    }
    catch (error) {
        next(error);
    }
}));
ownershipInfosRouter.get('/:goodType/:identifier/actions/checkToken', permitScopes_1.default(['admin']), validator_1.default, (_, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actions = [];
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ownershipInfosRouter;
