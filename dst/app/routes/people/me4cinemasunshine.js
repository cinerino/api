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
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const DEFAULT_MEMBERSHIP_SERVICE_ID = process.env.DEFAULT_MEMBERSHIP_SERVICE_ID;
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const me4cinemasunshineRouter = express_1.Router();
/**
 * メンバーシップ登録
 */
me4cinemasunshineRouter.put('/ownershipInfos/programMembership/register', permitScopes_1.default(['people.ownershipInfos', 'people.me.*']), rateLimit_1.default, ...[
    express_validator_1.body('agent.additionalProperty')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('agent.additionalProperty.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('agent.additionalProperty.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('sellerId')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (typeof DEFAULT_MEMBERSHIP_SERVICE_ID !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('DEFAULT_MEMBERSHIP_SERVICE_ID undefined');
        }
        const productId = DEFAULT_MEMBERSHIP_SERVICE_ID;
        const sellerId = String(req.body.sellerId);
        const productService = new cinerino.chevre.service.Product({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const sellerService = new cinerino.chevre.service.Seller({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const seller = yield sellerService.findById({ id: sellerId });
        const membershipService = yield productService.findById({
            id: productId
        });
        if (membershipService.project.id !== req.project.id) {
            throw new cinerino.factory.errors.NotFound('MembershipService');
        }
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const offers = yield cinerino.service.offer.product.search({
            project: { id: req.project.id },
            itemOffered: { id: productId },
            seller: { id: String(seller.id) },
            availableAt: { id: req.user.client_id }
        })({ project: projectRepo });
        if (offers.length === 0) {
            throw new cinerino.factory.errors.NotFound('Offer');
        }
        // sskts専用なので、強制的に一つ目のオファーを選択
        const acceptedOffer = offers[0];
        const task = yield cinerino.service.product.createOrderTask({
            project: { id: req.project.id },
            agent: Object.assign(Object.assign({}, req.agent), { additionalProperty: [
                    ...(Array.isArray(req.agent.additionalProperty)) ? req.agent.additionalProperty : [],
                    ...(Array.isArray((_a = req.body.agent) === null || _a === void 0 ? void 0 : _a.additionalProperty))
                        ? req.body.agent.additionalProperty.map((p) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : []
                    // ...[{ name: 'firstMembership', value: '1' }]
                ] }),
            object: {
                typeOf: cinerino.factory.chevre.offerType.Offer,
                id: String(acceptedOffer.id),
                itemOffered: { id: productId },
                seller: {
                    typeOf: seller.typeOf,
                    id: String(seller.id)
                }
            },
            location: { id: req.user.client_id }
        })({
            project: new cinerino.repository.Project(mongoose.connection),
            task: new cinerino.repository.Task(mongoose.connection)
        });
        // プロダクト注文タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED)
            .json(task);
    }
    catch (error) {
        next(error);
    }
}));
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
            return {
                project: o.project,
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
