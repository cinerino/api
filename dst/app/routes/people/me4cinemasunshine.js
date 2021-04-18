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
 * me(今ログイン中のユーザー)ルーター
 * Cinemasunshinに互換性を維持するためのルーター
 * 可能な部分から順次placeOrderTransactionsRouterへ移行していくことが望ましい
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const me4cinemasunshineRouter = express_1.Router();
/**
 * 会員プログラム登録解除
 * 所有権のidentifierをURLで指定
 * @deprecated シネマサンシャインで「退会処理」として使用(機を見てエンドポイントを変更したい)
 */
me4cinemasunshineRouter.put('/ownershipInfos/programMembership/:identifier/unRegister', permitScopes_1.default(['people.ownershipInfos', 'people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        // 現在所有している会員プログラムを全て検索
        const now = new Date();
        const ownershipInfos = yield ownershipInfoRepo.search({
            project: { id: { $eq: req.project.id } },
            typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
            ownedBy: { id: req.agent.id },
            ownedFrom: now,
            ownedThrough: now
        });
        // 所有が確認できれば、会員プログラム登録解除タスクを作成する
        const unRegisterActionAttributes = ownershipInfos.map((o) => {
            var _a, _b;
            return {
                project: { id: (_a = o.project) === null || _a === void 0 ? void 0 : _a.id, typeOf: (_b = o.project) === null || _b === void 0 ? void 0 : _b.typeOf },
                typeOf: cinerino.factory.actionType.UnRegisterAction,
                agent: req.agent,
                object: Object.assign(Object.assign({}, o.typeOfGood), { member: [req.agent] })
            };
        });
        // 会員削除タスクを作成
        const deleteMemberAction = {
            agent: req.agent,
            object: req.agent,
            project: req.project,
            potentialActions: {
                unRegisterProgramMembership: unRegisterActionAttributes
            },
            typeOf: cinerino.factory.actionType.DeleteAction
        };
        const deleteMemberTask = {
            project: req.project,
            name: cinerino.factory.taskName.DeleteMember,
            status: cinerino.factory.taskStatus.Ready,
            runsAt: now,
            remainingNumberOfTries: 10,
            numberOfTried: 0,
            executionResults: [],
            data: deleteMemberAction
        };
        yield taskRepo.save(deleteMemberTask);
        // 会員登録解除タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED)
            .json(deleteMemberTask);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = me4cinemasunshineRouter;
