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
 * プロジェクトメンバールーター
 */
const cinerino = require("@cinerino/domain");
const express = require("express");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const iamMembersRouter = express.Router();
// iamMembersRouter.use('/me', iamMeRouter);
/**
 * プロジェクトメンバー検索
 */
iamMembersRouter.get('', permitScopes_1.default(['iam.members.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const iamService = new cinerino.chevre.service.IAM({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: req.chevreAuthClient,
            project: { id: req.project.id }
        });
        const { data } = yield iamService.searchMembers(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }));
        res.json(data);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = iamMembersRouter;
