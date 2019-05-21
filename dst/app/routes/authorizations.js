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
 * 承認ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';
const authorizationsRouter = express_1.Router();
authorizationsRouter.use(authentication_1.default);
/**
 * 承認検索
 */
authorizationsRouter.get('', permitScopes_1.default(['admin']), ...[
    check_1.query('validFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('validThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const authorizationRepo = new cinerino.repository.Code(mongoose.connection);
        const searchConditions = Object.assign({}, req.query, { project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const totalCount = yield authorizationRepo.count(searchConditions);
        const authorizations = yield authorizationRepo.search(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(authorizations);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = authorizationsRouter;
