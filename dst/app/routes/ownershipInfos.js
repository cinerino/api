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
 * 所有権ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
const express_validator_1 = require("express-validator");
// import * as moment from 'moment';
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const tokens_1 = require("./tokens");
const ownershipInfosRouter = express_1.Router();
/**
 * 所有権検索
 */
ownershipInfosRouter.get('', permitScopes_1.default(['ownershipInfos.read']), rateLimit_1.default, ...[
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
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const typeOfGood = (req.query.typeOfGood !== undefined && req.query.typeOfGood !== null) ? req.query.typeOfGood : {};
        let ownershipInfos;
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        switch (typeOfGood.typeOf) {
            default:
                ownershipInfos = yield ownershipInfoRepo.search(searchConditions);
        }
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * コードから所有権に対するアクセストークンを発行する
 * @deprecated Use /tokens
 */
ownershipInfosRouter.post('/tokens', permitScopes_1.default(['tokens']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const codeRepo = new cinerino.repository.Code(mongoose.connection);
        const token = yield cinerino.service.code.getToken({
            project: req.project,
            code: req.body.code,
            secret: process.env.TOKEN_SECRET,
            issuer: process.env.RESOURCE_SERVER_IDENTIFIER,
            expiresIn: tokens_1.TOKEN_EXPIRES_IN
        })({ code: codeRepo });
        res.json({ token });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 所有権に対するトークン検証アクションを検索する
 * @deprecated Use GET /reservations/:id/actions/use
 */
// tslint:disable-next-line:use-default-type-parameter
// ownershipInfosRouter.get<ParamsDictionary>(
//     '/:id/actions/checkToken',
//     permitScopes(['reservations.read']),
//     rateLimit,
//     ...[
//         query('startFrom')
//             .optional()
//             .isISO8601()
//             .toDate(),
//         query('startThrough')
//             .optional()
//             .isISO8601()
//             .toDate()
//     ],
//     validator,
//     async (req, res, next) => {
//         try {
//             const now = new Date();
//             const ownershipInfoId = req.params.id;
//             const actionRepo = new cinerino.repository.Action(mongoose.connection);
//             const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
//             //  所有権を検索
//             const ownershipInfo = await ownershipInfoRepo.findById({ id: ownershipInfoId });
//             const reservation = <cinerino.factory.ownershipInfo.IReservation>ownershipInfo.typeOfGood;
//             // 予約使用アクションを検索
//             const searchConditions: cinerino.factory.action.ISearchConditions<cinerino.factory.actionType.UseAction> = {
//                 // ページング未実装、いったん100限定でも要件は十分満たされるか
//                 // tslint:disable-next-line:no-magic-numbers
//                 limit: 100,
//                 sort: { startDate: cinerino.factory.sortType.Descending },
//                 typeOf: cinerino.factory.actionType.UseAction,
//                 object: {
//                     typeOf: { $in: [reservation.typeOf] },
//                     id: { $in: [String(reservation.id)] }
//                 },
//                 startFrom: (req.query.startFrom instanceof Date)
//                     ? req.query.startFrom
//                     : moment(now)
//                         // とりあえずデフォルト直近1カ月(おそらくこれで十分)
//                         // tslint:disable-next-line:no-magic-numbers
//                         .add(-3, 'months')
//                         .toDate(),
//                 startThrough: (req.query.startThrough instanceof Date)
//                     ? req.query.startThrough
//                     : now
//             };
//             const actions = await actionRepo.search(searchConditions);
//             res.json(actions);
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * Cinemasunshine対応
 * @deprecated
 */
ownershipInfosRouter.get('/countByRegisterDateAndTheater', permitScopes_1.default(['ownershipInfos.read']), rateLimit_1.default, ...[
    express_validator_1.query('fromDate')
        .not()
        .isEmpty()
        .isISO8601(),
    express_validator_1.query('toDate')
        .not()
        .isEmpty()
        .isISO8601()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fromDate = req.query.fromDate;
        const toDate = req.query.toDate;
        const theaterIds = req.query.theaterIds;
        const repository = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const andConditions = [
            { 'typeOfGood.typeOf': cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership }
        ];
        andConditions.push({
            ownedFrom: {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            }
        });
        if (Array.isArray(theaterIds)) {
            andConditions.push({
                'acquiredFrom.id': {
                    $exists: true,
                    $in: theaterIds
                }
            });
        }
        const count = yield repository.ownershipInfoModel.countDocuments({ $and: andConditions })
            .exec();
        res.json({ count });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ownershipInfosRouter;
