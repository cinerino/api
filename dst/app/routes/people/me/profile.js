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
 * 自分のプロフィールルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
const profileRouter = express_1.Router();
/**
 * プロフィール検索
 */
profileRouter.get('', permitScopes_1.default(['customer']), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person({
            userPoolId: '' // アクセストークンに情報が含まれるので必要なし
        });
        const profile = yield personRepo.getUserAttributesByAccessToken(req.accessToken);
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロフィール更新
 */
profileRouter.patch('', permitScopes_1.default(['customer']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person({
            userPoolId: '' // アクセストークンに情報が含まれるので必要なし
        });
        yield personRepo.updateProfileByAccessToken({
            accessToken: req.accessToken,
            profile: req.body
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = profileRouter;
