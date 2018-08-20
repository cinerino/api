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
const jwt = require("jsonwebtoken");
// import * as redis from '../../redis';
const authentication_1 = require("../middlewares/authentication");
// import permitScopes from '../middlewares/permitScopes';
const validator_1 = require("../middlewares/validator");
const authRouter = express_1.Router();
authRouter.use(authentication_1.default);
/**
 * コードから所有権に対するアクセストークンを発行する
 */
authRouter.post('/token', 
// permitScopes(['aws.cognito.signin.user.admin']),
validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const code = req.body.code;
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const ownershipInfo = yield ownershipInfoRepo.ownershipInfoModel.findOne({
            identifier: code
        }).then((doc) => {
            if (doc === null) {
                throw new cinerino.factory.errors.Argument('Invalid code');
            }
            return doc.toObject();
        });
        // 所有権をトークン化
        const token = yield new Promise((resolve, reject) => {
            // 許可証を暗号化する
            jwt.sign(ownershipInfo, process.env.TOKEN_SECRET, {
                issuer: process.env.RESOURCE_SERVER_IDENTIFIER,
                // tslint:disable-next-line:no-magic-numbers
                expiresIn: 1800
            }, (err, encoded) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    resolve(encoded);
                }
            });
        });
        res.json({ token });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = authRouter;
