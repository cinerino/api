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
 * アクションルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const iam_1 = require("../iam");
const actionsRouter = express_1.Router();
/**
 * アクション検索
 */
actionsRouter.get('', permitScopes_1.default(['actions.*', 'actions.read']), rateLimit_1.default, ...[
    express_validator_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const totalCount = yield actionRepo.count(searchConditions);
        const actions = yield actionRepo.search(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * チケット印刷アクション追加
 */
actionsRouter.post('/print/ticket', permitScopes_1.default([iam_1.Permission.User, 'customer', 'actions']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ticket = {
            ticketToken: req.body.ticketToken
        };
        const action = yield new cinerino.repository.Action(mongoose.connection).printTicket(req.user.sub, ticket, req.project);
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * チケット印刷アクション検索
 */
actionsRouter.get('/print/ticket', permitScopes_1.default([iam_1.Permission.User, 'customer', 'actions', 'actions.read-only']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actions = yield new cinerino.repository.Action(mongoose.connection).searchPrintTicket({
            agentId: req.user.sub,
            ticketToken: req.query.ticketToken
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = actionsRouter;
