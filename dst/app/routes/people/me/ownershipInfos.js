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
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../../middlewares/permitScopes");
const rateLimit_1 = require("../../../middlewares/rateLimit");
const validator_1 = require("../../../middlewares/validator");
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
const ownershipInfosRouter = express_1.Router();
ownershipInfosRouter.use('/accounts', accounts_1.default);
ownershipInfosRouter.use('/creditCards', creditCards_1.default);
ownershipInfosRouter.use('/reservations', reservations_1.default);
/**
 * 所有権検索
 */
ownershipInfosRouter.get('', permitScopes_1.default(['customer']), rateLimit_1.default, ...[
    check_1.query('typeOfGood')
        .not()
        .isEmpty(),
    check_1.query('ownedFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('ownedThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let ownershipInfos;
        const searchConditions = Object.assign(Object.assign({}, req.query), { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, ownedBy: { id: req.user.sub } });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const totalCount = yield ownershipInfoRepo.count(searchConditions);
        const typeOfGood = req.query.typeOfGood;
        switch (typeOfGood.typeOf) {
            case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                ownershipInfos = yield cinerino.service.account.search({
                    project: req.project,
                    conditions: searchConditions
                })({
                    ownershipInfo: ownershipInfoRepo,
                    project: projectRepo
                });
                break;
            case cinerino.factory.chevre.reservationType.EventReservation:
                ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations(Object.assign(Object.assign({}, searchConditions), { project: req.project }))({
                    ownershipInfo: ownershipInfoRepo,
                    project: projectRepo
                });
                break;
            default:
                ownershipInfos = yield ownershipInfoRepo.search(searchConditions);
            // throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
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
ownershipInfosRouter.post('/:id/authorize', permitScopes_1.default(['customer']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const codeRepo = new cinerino.repository.Code(mongoose.connection);
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        const ownershipInfo = yield ownershipInfoRepo.findById({ id: req.params.id });
        if (ownershipInfo.ownedBy.id !== req.user.sub) {
            throw new cinerino.factory.errors.Unauthorized();
        }
        const authorization = yield cinerino.service.code.publish({
            project: req.project,
            agent: req.agent,
            recipient: req.agent,
            object: ownershipInfo,
            purpose: {},
            validFrom: new Date(),
            expiresInSeconds: CODE_EXPIRES_IN_SECONDS
        })({
            action: actionRepo,
            code: codeRepo
        });
        const code = authorization.code;
        // const code = await codeRepo.publish({
        //     project: req.project,
        //     data: ownershipInfo,
        //     validFrom: new Date(),
        //     expiresInSeconds: CODE_EXPIRES_IN_SECONDS
        // });
        // 座席予約に対する所有権であれば、Chevreでチェックイン
        if (ownershipInfo.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: project.settings.chevre.endpoint,
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
