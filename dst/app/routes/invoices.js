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
 * インボイスルーター
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
const invoicesRouter = express_1.Router();
invoicesRouter.use(authentication_1.default);
/**
 * インボイス検索
 */
invoicesRouter.get('', permitScopes_1.default(['admin']), ...[
    check_1.query('createdFrom')
        .optional()
        .isISO8601()
        .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
        .toDate(),
    check_1.query('createdThrough')
        .optional()
        .isISO8601()
        .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const totalCount = yield invoiceRepo.count(searchConditions);
        const invoices = yield invoiceRepo.search(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(invoices);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = invoicesRouter;
