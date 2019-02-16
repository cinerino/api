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
const moment = require("moment");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const validator_1 = require("../../../middlewares/validator");
const redis = require("../../../../redis");
const accounts_1 = require("./ownershipInfos/accounts");
const creditCards_1 = require("./ownershipInfos/creditCards");
const reservations_1 = require("./ownershipInfos/reservations");
const CODE_EXPIRES_IN_SECONDS = Number(process.env.CODE_EXPIRES_IN_SECONDS);
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
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
ownershipInfosRouter.get('', permitScopes_1.default(['aws.cognito.signin.user.admin']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const query = req.query;
        const typeOfGood = query.typeOfGood;
        let ownershipInfos;
        const searchConditions = {
            // tslint:disable-next-line:no-magic-numbers
            limit: (query.limit !== undefined) ? Math.min(query.limit, 100) : 100,
            page: (query.page !== undefined) ? Math.max(query.page, 1) : 1,
            sort: (query.sort !== undefined) ? query.sort : { ownedFrom: cinerino.factory.sortType.Descending },
            ownedBy: { id: req.user.sub },
            ownedFrom: (query.ownedFrom !== undefined) ? moment(query.ownedFrom)
                .toDate() : undefined,
            ownedThrough: (query.ownedThrough !== undefined) ? moment(query.ownedThrough)
                .toDate() : undefined,
            typeOfGood: typeOfGood
        };
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const totalCount = yield ownershipInfoRepo.count(searchConditions);
        switch (typeOfGood.typeOf) {
            case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                const accountService = new cinerino.pecorinoapi.service.Account({
                    endpoint: process.env.PECORINO_ENDPOINT,
                    auth: pecorinoAuthClient
                });
                ownershipInfos = yield cinerino.service.account.search(Object.assign({}, searchConditions, { typeOfGood: typeOfGood }))({
                    ownershipInfo: ownershipInfoRepo,
                    accountService: accountService
                });
                break;
            case cinerino.factory.chevre.reservationType.EventReservation:
                const reservationService = new cinerino.chevre.service.Reservation({
                    endpoint: process.env.CHEVRE_ENDPOINT,
                    auth: chevreAuthClient
                });
                ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations(Object.assign({}, searchConditions, { typeOfGood: typeOfGood }))({
                    ownershipInfo: ownershipInfoRepo,
                    reservationService: reservationService
                });
                break;
            default:
                throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
        }
        res.set('X-Total-Count', totalCount.toString());
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 所有権に対して認可コードを発行する
 */
ownershipInfosRouter.post('/:id/authorize', permitScopes_1.default(['aws.cognito.signin.user.admin']), (_1, _2, next) => {
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const codeRepo = new cinerino.repository.Code(redis.getClient());
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const ownershipInfo = yield ownershipInfoRepo.findById({ id: req.params.id });
        if (ownershipInfo.ownedBy.id !== req.user.sub) {
            throw new cinerino.factory.errors.Unauthorized();
        }
        const code = yield codeRepo.publish({
            data: ownershipInfo,
            expiresInSeconds: CODE_EXPIRES_IN_SECONDS
        });
        // 座席予約に対する所有権であれば、Chevreでチェックイン
        if (ownershipInfo.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            yield reservationService.checkInScreeningEventReservations({ id: ownershipInfo.typeOfGood.id });
        }
        res.json({ code });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ownershipInfosRouter;
