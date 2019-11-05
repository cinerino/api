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
 * 口座ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const redis = require("../../redis");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const accountsRouter = express_1.Router();
accountsRouter.use(authentication_1.default);
/**
 * 管理者として口座開設
 */
accountsRouter.post('', permitScopes_1.default(['admin']), ...[
    check_1.body('accountType', 'invalid accountType')
        .not()
        .isEmpty(),
    check_1.body('name', 'invalid name')
        .not()
        .isEmpty()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const account = yield cinerino.service.account.openWithoutOwnershipInfo({
            project: req.project,
            accountType: req.body.accountType,
            name: req.body.name
        })({
            accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
            project: new cinerino.repository.Project(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(account);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 管理者として口座解約
 */
accountsRouter.put('/:accountType/:accountNumber/close', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.account.close({
            project: req.project,
            accountType: req.params.accountType,
            accountNumber: req.params.accountNumber
        })({
            ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 管理者として口座に入金する
 */
accountsRouter.post('/transactions/deposit', permitScopes_1.default(['admin']), 
// 互換性維持のため
(req, _, next) => {
    if (req.body.object === undefined || req.body.object === null) {
        req.body.object = {};
    }
    if (typeof req.body.amount === 'number') {
        req.body.object.amount = Number(req.body.amount);
    }
    if (typeof req.body.notes === 'string') {
        req.body.object.description = req.body.notes;
    }
    if (typeof req.body.toAccountNumber === 'string') {
        if (req.body.object.toLocation === undefined || req.body.object.toLocation === null) {
            req.body.object.toLocation = {};
        }
        req.body.object.toLocation.accountNumber = req.body.toAccountNumber;
    }
    next();
}, ...[
    check_1.body('recipient')
        .not()
        .isEmpty(),
    check_1.body('object.amount')
        .not()
        .isEmpty()
        .isInt()
        .custom((value) => {
        if (Number(value) <= 0) {
            throw new Error('Amount must be more than 0');
        }
        return true;
    })
        .withMessage(() => 'Amount must be more than 0'),
    check_1.body('object.toLocation.accountNumber')
        .not()
        .isEmpty()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        yield cinerino.service.account.deposit({
            project: req.project,
            agent: {
                typeOf: cinerino.factory.personType.Person,
                id: req.user.sub,
                name: (req.user.username !== undefined) ? req.user.username : req.user.sub,
                url: ''
            },
            object: Object.assign(Object.assign({}, req.body.object), { description: (typeof req.body.object.description === 'string') ? req.body.object.description : '入金' }),
            recipient: req.body.recipient
        })({
            project: projectRepo
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountsRouter;
