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
 * アクションルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const actionsRouter = express_1.Router();
actionsRouter.use(authentication_1.default);
/**
 * チケット印刷アクション追加
 */
actionsRouter.post('/print/ticket', permitScopes_1.default(['aws.cognito.signin.user.admin', 'actions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const ticket = {
            ticketToken: req.body.ticketToken
        };
        const action = yield new cinerino.repository.Action(mongoose.connection).printTicket(req.user.sub, ticket);
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
actionsRouter.get('/print/ticket', permitScopes_1.default(['aws.cognito.signin.user.admin', 'actions', 'actions.read-only']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
