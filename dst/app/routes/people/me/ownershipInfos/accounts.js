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
 * 自分の口座ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../../../middlewares/permitScopes");
const validator_1 = require("../../../../middlewares/validator");
const redis = require("../../../../../redis");
const accountsRouter = express_1.Router();
/**
 * 口座開設
 */
accountsRouter.post('/:accountType', permitScopes_1.default(['customer']), (req, _, next) => {
    req.checkBody('name', 'invalid name')
        .notEmpty()
        .withMessage('name is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const ownershipInfo = yield cinerino.service.account.open({
            project: req.project,
            agent: req.agent,
            name: req.body.name,
            accountType: req.params.accountType
        })({
            accountNumber: accountNumberRepo,
            ownershipInfo: ownershipInfoRepo,
            project: projectRepo
        });
        res.status(http_status_1.CREATED)
            .json(ownershipInfo);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
 */
accountsRouter.put('/:accountType/:accountNumber/close', permitScopes_1.default(['customer']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        yield cinerino.service.account.close({
            project: req.project,
            ownedBy: {
                id: req.user.sub
            },
            accountType: req.params.accountType,
            accountNumber: req.params.accountNumber
        })({
            ownershipInfo: ownershipInfoRepo,
            project: projectRepo
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座取引履歴検索
 */
accountsRouter.get('/actions/moneyTransfer', permitScopes_1.default(['customer']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const actions = yield cinerino.service.account.searchMoneyTransferActions({
            project: req.project,
            ownedBy: {
                id: req.user.sub
            },
            conditions: req.query
        })({
            ownershipInfo: ownershipInfoRepo,
            project: projectRepo
        });
        res.set('X-Total-Count', actions.length.toString())
            .json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountsRouter;
