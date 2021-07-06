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
], validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        // const productService = new cinerino.chevre.service.Product({
        //     endpoint: cinerino.credentials.chevre.endpoint,
        //     auth: req.chevreAuthClient,
        //     project: { id: req.project.id }
        // });
        // const searchPaymentCardProductsResult = await productService.search({
        //     limit: 100,
        //     project: { id: { $eq: req.project.id } },
        //     typeOf: { $eq: cinerino.factory.product.ProductType.PaymentCard }
        // });
        // const paymentCardProducts = searchPaymentCardProductsResult.data;
        // const paymentCardOutputTypes = [...new Set(paymentCardProducts.map((p) => String(p.serviceOutput?.typeOf)))];
        let ownershipInfos;
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, ownedBy: { id: req.user.sub } });
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        // const typeOfGood = <cinerino.factory.ownershipInfo.ITypeOfGoodSearchConditions>req.query.typeOfGood;
        // switch (true) {
        //     case paymentCardOutputTypes.includes(String(typeOfGood.typeOf)):
        //         ownershipInfos = await cinerino.service.account.search({
        //             project: req.project,
        //             conditions: searchConditions
        //         })({
        //             ownershipInfo: ownershipInfoService
        //         });
        //         break;
        //     case cinerino.factory.reservationType.EventReservation === typeOfGood.typeOf:
        //         ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(<any>{
        //             ...searchConditions,
        //             project: { typeOf: req.project.typeOf, id: req.project.id }
        //         })({
        //             ownershipInfo: ownershipInfoService,
        //             reservation: new cinerino.chevre.service.Reservation({
        //                 endpoint: cinerino.credentials.chevre.endpoint,
        //                 auth: chevreAuthClient,
        //                 project: { id: req.project.id }
        //             })
        //         });
        //         break;
        //     default:
        //         const searchOwnershipInfosResult = await ownershipInfoService.search(searchConditions);
        //         ownershipInfos = searchOwnershipInfosResult.data;
        // }
        // ssktsにおけるtypeOfGood.typeOfでの検索を、typeOfGood.issuedThrough.typeOfでの検索に変換する
        // const issuedThroughTypeOf = searchConditions.typeOfGood?.issuedThrough?.typeOf?.$eq;
        const typeOfGoodTypeOf = (_a = searchConditions.typeOfGood) === null || _a === void 0 ? void 0 : _a.typeOf;
        // // ssktsアプリへの互換性維持対応
        if (typeOfGoodTypeOf === 'Account') {
            searchConditions.typeOfGood = Object.assign(Object.assign({}, searchConditions.typeOfGood), { issuedThrough: { typeOf: { $eq: cinerino.factory.product.ProductType.PaymentCard } } });
        }
        if (typeOfGoodTypeOf === cinerino.factory.reservationType.EventReservation) {
            searchConditions.typeOfGood = Object.assign(Object.assign({}, searchConditions.typeOfGood), { issuedThrough: { typeOf: { $eq: cinerino.factory.product.ProductType.EventService } } });
        }
        if (typeOfGoodTypeOf === 'ProgramMembership') {
            // typeOfGood?.typeOf条件は今日制定に削除する('ProgramMembership'への依存を排除するため)
            searchConditions.typeOfGood = {
                // ...searchConditions.typeOfGood,
                issuedThrough: { typeOf: { $eq: cinerino.factory.product.ProductType.MembershipService } }
            };
        }
        switch ((_d = (_c = (_b = searchConditions.typeOfGood) === null || _b === void 0 ? void 0 : _b.issuedThrough) === null || _c === void 0 ? void 0 : _c.typeOf) === null || _d === void 0 ? void 0 : _d.$eq) {
            case cinerino.factory.product.ProductType.PaymentCard:
                ownershipInfos = yield cinerino.service.account.search({
                    project: req.project,
                    conditions: searchConditions
                })({
                    ownershipInfo: ownershipInfoService
                });
                break;
            case cinerino.factory.product.ProductType.EventService:
                ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations(Object.assign(Object.assign({}, searchConditions), { project: { typeOf: req.project.typeOf, id: req.project.id } }))({
                    ownershipInfo: ownershipInfoService,
                    reservation: new cinerino.chevre.service.Reservation({
                        endpoint: cinerino.credentials.chevre.endpoint,
                        auth: chevreAuthClient,
                        project: { id: req.project.id }
                    })
                });
                break;
            default:
                const searchOwnershipInfosResult = yield ownershipInfoService.search(searchConditions);
                ownershipInfos = searchOwnershipInfosResult.data;
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
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const searchOwnershipInfosResult = yield ownershipInfoService.search({
            limit: 1,
            project: { id: { $eq: req.project.id } },
            ids: [req.params.id]
        });
        const ownershipInfos = searchOwnershipInfosResult.data;
        const ownershipInfo = ownershipInfos.shift();
        if (ownershipInfo === undefined) {
            throw new cinerino.factory.errors.NotFound('OwnershipInfo');
        }
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
            authorization: new cinerino.chevre.service.Authorization({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            })
        });
        const code = authorizations[0].code;
        // 座席予約に対する所有権であれば、Chevreでチェックイン
        if (ownershipInfo.typeOfGood.typeOf === cinerino.factory.reservationType.EventReservation) {
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
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
