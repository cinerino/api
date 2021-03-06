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
 * 自分の所有権ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const rateLimit_1 = require("../../../middlewares/rateLimit");
const validator_1 = require("../../../middlewares/validator");
const accounts_1 = require("./ownershipInfos/accounts");
const creditCards_1 = require("./ownershipInfos/creditCards");
const reservations_1 = require("./ownershipInfos/reservations");
const CODE_EXPIRES_IN_SECONDS_DEFAULT = (typeof process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT === 'string')
    ? Number(process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT)
    // tslint:disable-next-line:no-magic-numbers
    : 600;
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ownershipInfosRouter = express_1.Router();
ownershipInfosRouter.use('/accounts', accounts_1.default);
ownershipInfosRouter.use('/creditCards', creditCards_1.default);
ownershipInfosRouter.use('/reservations', reservations_1.default);
/**
 * 所有権検索
 */
ownershipInfosRouter.get('', permitScopes_1.default(['people.me.*']), rateLimit_1.default, ...[
    express_validator_1.query('typeOfGood')
        .not()
        .isEmpty(),
    express_validator_1.query('ownedFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('ownedThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productService = new cinerino.chevre.service.Product({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchPaymentCardProductsResult = yield productService.search({
            limit: 100,
            project: { id: { $eq: req.project.id } },
            typeOf: { $eq: cinerino.factory.chevre.product.ProductType.PaymentCard }
        });
        const paymentCardProducts = searchPaymentCardProductsResult.data;
        const paymentCardOutputTypes = [...new Set(paymentCardProducts.map((p) => { var _a; return String((_a = p.serviceOutput) === null || _a === void 0 ? void 0 : _a.typeOf); }))];
        let ownershipInfos;
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, ownedBy: { id: req.user.sub } });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const typeOfGood = req.query.typeOfGood;
        switch (true) {
            case paymentCardOutputTypes.includes(String(typeOfGood.typeOf)):
                ownershipInfos = yield cinerino.service.account.search({
                    project: req.project,
                    conditions: searchConditions
                })({
                    ownershipInfo: ownershipInfoRepo,
                    project: projectRepo
                });
                break;
            case cinerino.factory.chevre.reservationType.EventReservation === typeOfGood.typeOf:
                ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations(Object.assign(Object.assign({}, searchConditions), { project: { typeOf: req.project.typeOf, id: req.project.id } }))({
                    ownershipInfo: ownershipInfoRepo,
                    project: projectRepo
                });
                break;
            default:
                ownershipInfos = yield ownershipInfoRepo.search(searchConditions);
            // throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
        }
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 所有権に対して認可コードを発行する
 */
ownershipInfosRouter.post('/:id/authorize', permitScopes_1.default(['people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date();
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const codeRepo = new cinerino.repository.Code(mongoose.connection);
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const ownershipInfo = yield ownershipInfoRepo.findById({ id: req.params.id });
        if (ownershipInfo.ownedBy.id !== req.user.sub) {
            throw new cinerino.factory.errors.Unauthorized();
        }
        const expiresInSeconds = CODE_EXPIRES_IN_SECONDS_DEFAULT;
        const authorizations = yield cinerino.service.code.publish({
            project: req.project,
            agent: req.agent,
            recipient: req.agent,
            object: [ownershipInfo],
            purpose: {},
            validFrom: now,
            expiresInSeconds: expiresInSeconds
        })({
            action: actionRepo,
            code: codeRepo
        });
        const code = authorizations[0].code;
        // 座席予約に対する所有権であれば、Chevreでチェックイン
        if (ownershipInfo.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            yield reservationService.checkInScreeningEventReservations({
                id: ownershipInfo.typeOfGood.id
            });
        }
        res.json({ code });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ownershipInfosRouter;
