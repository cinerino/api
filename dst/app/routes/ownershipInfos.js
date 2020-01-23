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
const express_validator_1 = require("express-validator");
const moment = require("moment");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const TOKEN_EXPIRES_IN = 1800;
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
            // case cinerino.factory.ownershipInfo.AccountGoodType.Account:
            //     ownershipInfos = await cinerino.service.account.search({
            //         project: req.project,
            //         conditions: searchConditions
            //     })({
            //         ownershipInfo: ownershipInfoRepo,
            //         project: projectRepo
            //     });
            //     break;
            // case cinerino.factory.chevre.reservationType.EventReservation:
            //     ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(searchConditions)({
            //         ownershipInfo: ownershipInfoRepo,
            //         project: projectRepo
            //     });
            //     break;
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
 */
ownershipInfosRouter.post('/tokens', permitScopes_1.default(['tokens']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const codeRepo = new cinerino.repository.Code(mongoose.connection);
        const token = yield cinerino.service.code.getToken({
            code: req.body.code,
            secret: process.env.TOKEN_SECRET,
            issuer: process.env.RESOURCE_SERVER_IDENTIFIER,
            expiresIn: TOKEN_EXPIRES_IN
        })({ code: codeRepo });
        res.json({ token });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 所有権に対するトークン検証アクションを検索する
 */
// tslint:disable-next-line:use-default-type-parameter
ownershipInfosRouter.get('/:id/actions/checkToken', permitScopes_1.default(['ownershipInfos.actions.checkToken.read']), rateLimit_1.default, ...[
    express_validator_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date();
        const ownershipInfoId = req.params.id;
        const searchConditions = {
            // ページング未実装、いったん100限定でも要件は十分満たされるか
            // tslint:disable-next-line:no-magic-numbers
            limit: 100,
            sort: { startDate: cinerino.factory.sortType.Descending },
            typeOf: cinerino.factory.actionType.CheckAction,
            result: {
                typeOf: { $in: ['OwnershipInfo'] },
                id: { $in: [ownershipInfoId] }
            },
            startFrom: (req.query.startFrom instanceof Date)
                ? req.query.startFrom
                : moment(now)
                    // とりあえずデフォルト直近1カ月(おそらくこれで十分)
                    // tslint:disable-next-line:no-magic-numbers
                    .add(-3, 'months')
                    .toDate(),
            startThrough: (req.query.startThrough instanceof Date)
                ? req.query.startThrough
                : now
        };
        // const searchConditions: any = {
        //     typeOf: cinerino.factory.actionType.CheckAction,
        //     'result.typeOf': {
        //         $exists: true,
        //         $eq: 'OwnershipInfo'
        //     },
        //     'result.id': {
        //         $exists: true,
        //         $eq: ownershipInfoId
        //     },
        //     startDate: {
        //         $gte: (req.query.startFrom instanceof Date)
        //             ? req.query.startFrom
        //             : moment(now)
        //                 // とりあえずデフォルト直近1カ月(おそらくこれで十分)
        //                 // tslint:disable-next-line:no-magic-numbers
        //                 .add(-3, 'months')
        //                 .toDate(),
        //         $lte: (req.query.startThrough instanceof Date)
        //             ? req.query.startThrough
        //             : now
        //     }
        // };
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        // const totalCount = await actionRepo.actionModel.countDocuments(searchConditions)
        //     .setOptions({ maxTimeMS: 10000 })
        //     .exec();
        const actions = yield actionRepo.search(searchConditions);
        // const actions = await actionRepo.actionModel.find(
        //     searchConditions,
        //     {
        //         __v: 0,
        //         createdAt: 0,
        //         updatedAt: 0
        //     }
        // )
        //     .sort({ startDate: cinerino.factory.sortType.Descending })
        //     // ページング未実装、いったん100限定でも要件は十分満たされるか
        //     // tslint:disable-next-line:no-magic-numbers
        //     .limit(100)
        //     // .setOptions({ maxTimeMS: 10000 })
        //     .exec()
        //     .then((docs) => docs.map((doc) => doc.toObject()));
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
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
        const searchConditions = {
            createdAtFrom: new Date(fromDate),
            createdAtTo: new Date(toDate),
            theaterIds: theaterIds
        };
        const repository = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const andConditions = [
            { 'typeOfGood.typeOf': cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership }
        ];
        andConditions.push({
            createdAt: {
                $lte: searchConditions.createdAtTo,
                $gte: searchConditions.createdAtFrom
            }
        });
        if (Array.isArray(searchConditions.theaterIds)) {
            andConditions.push({
                'acquiredFrom.id': {
                    $exists: true,
                    $in: searchConditions.theaterIds
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
