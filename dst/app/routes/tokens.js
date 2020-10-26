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
exports.TOKEN_EXPIRES_IN = void 0;
/**
 * トークンルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
exports.TOKEN_EXPIRES_IN = 1800;
const tokensRouter = express_1.Router();
/**
 * コードからトークンを発行する
 */
tokensRouter.post('', permitScopes_1.default(['tokens']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const codeRepo = new cinerino.repository.Code(mongoose.connection);
        const token = yield cinerino.service.code.getToken({
            project: req.project,
            code: req.body.code,
            secret: process.env.TOKEN_SECRET,
            issuer: process.env.RESOURCE_SERVER_IDENTIFIER,
            expiresIn: exports.TOKEN_EXPIRES_IN
        })({ code: codeRepo });
        res.json({ token });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = tokensRouter;
