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
const express_validator_1 = require("express-validator");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const invoicesRouter = express_1.Router();
/**
 * インボイス検索
 */
invoicesRouter.get('', permitScopes_1.default(['invoices.*', 'invoices.read']), rateLimit_1.default, ...[
    express_validator_1.query('createdFrom')
        .optional()
        .isISO8601()
        .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
        .toDate(),
    express_validator_1.query('createdThrough')
        .optional()
        .isISO8601()
        .withMessage((_, options) => `${options.path} must be ISO8601 timestamp`)
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const invoices = yield invoiceRepo.search(searchConditions);
        res.json(invoices);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = invoicesRouter;
