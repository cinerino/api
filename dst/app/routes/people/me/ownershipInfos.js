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
 * 自分の所有権ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
const redis = require("../../../../redis");
const ownershipInfosRouter = express_1.Router();
/**
 * ユーザーの所有権検索
 */
ownershipInfosRouter.get('/:goodType', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.ownershipInfos', 'people.ownershipInfos.read-only']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const repository = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const ownershipInfos = yield repository.search({
            goodType: req.params.goodType,
            ownedBy: req.user.sub,
            ownedAt: new Date()
        });
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 所有権に対して認可コードを発行する
 */
ownershipInfosRouter.get('/:goodType/:identifier/authorize', permitScopes_1.default(['aws.cognito.signin.user.admin']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const codeRepo = new cinerino.repository.Code(redis.getClient());
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
        const code = yield cinerino.service.code.publish({
            goodType: req.params.goodType,
            identifier: req.params.identifier
        })({
            code: codeRepo,
            ownershipInfo: ownershipInfoRepo
        });
        res.json({ code });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラム登録
 */
ownershipInfosRouter.put('/programMembership/register', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.ownershipInfos']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const task = yield cinerino.service.programMembership.createRegisterTask({
            agent: req.agent,
            seller: {
                typeOf: req.body.sellerType,
                id: req.body.sellerId
            },
            programMembershipId: req.body.programMembershipId,
            offerIdentifier: req.body.offerIdentifier
        })({
            organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
            programMembership: new cinerino.repository.ProgramMembership(cinerino.mongoose.connection),
            task: new cinerino.repository.Task(cinerino.mongoose.connection)
        });
        // 会員登録タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED).json(task);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員プログラム登録解除
 * 所有権のidentifierをURLで指定
 */
ownershipInfosRouter.put('/programMembership/:identifier/unRegister', permitScopes_1.default(['aws.cognito.signin.user.admin', 'people.ownershipInfos']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const task = yield cinerino.service.programMembership.createUnRegisterTask({
            agent: req.agent,
            ownershipInfoIdentifier: req.params.identifier
        })({
            ownershipInfo: new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection),
            task: new cinerino.repository.Task(cinerino.mongoose.connection)
        });
        // 会員登録解除タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED).json(task);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ownershipInfosRouter;
