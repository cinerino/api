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
 * 所有権ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const moment = require("moment");
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const redis = require("../../redis");
const ownershipInfosRouter = express_1.Router();
ownershipInfosRouter.use(authentication_1.default);
/**
 * コードから所有権に対するアクセストークンを発行する
 */
ownershipInfosRouter.post('/tokens', permitScopes_1.default(['aws.cognito.signin.user.admin', 'tokens']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const codeRepo = new cinerino.repository.Code(redis.getClient());
        const token = yield cinerino.service.code.getToken({
            code: req.body.code,
            secret: process.env.TOKEN_SECRET,
            issuer: process.env.RESOURCE_SERVER_IDENTIFIER,
            // tslint:disable-next-line:no-magic-numbers
            expiresIn: 1800
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
ownershipInfosRouter.get('/:id/actions/checkToken', permitScopes_1.default(['admin']), ...[
    check_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const now = new Date();
        const ownershipInfoId = req.params.id;
        const searchConditions = {
            typeOf: cinerino.factory.actionType.CheckAction,
            'result.typeOf': {
                $exists: true,
                $eq: 'OwnershipInfo'
            },
            'result.id': {
                $exists: true,
                $eq: ownershipInfoId
            },
            startDate: {
                $gte: (req.query.startFrom instanceof Date)
                    ? req.query.startFrom
                    : moment(now)
                        // とりあえずデフォルト直近1カ月(おそらくこれで十分)
                        // tslint:disable-next-line:no-magic-numbers
                        .add(-3, 'month')
                        .toDate(),
                $lte: (req.query.startThrough instanceof Date)
                    ? req.query.startThrough
                    : now
            }
        };
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const totalCount = yield actionRepo.actionModel.countDocuments(searchConditions)
            .setOptions({ maxTimeMS: 10000 })
            .exec();
        const actions = yield actionRepo.actionModel.find(searchConditions, {
            __v: 0,
            createdAt: 0,
            updatedAt: 0
        })
            .sort({ startDate: cinerino.factory.sortType.Descending })
            // ページング未実装、いったん100限定でも要件は十分満たされるか
            // tslint:disable-next-line:no-magic-numbers
            .limit(100)
            // .setOptions({ maxTimeMS: 10000 })
            .exec()
            .then((docs) => docs.map((doc) => doc.toObject()));
        res.set('X-Total-Count', totalCount.toString());
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
ownershipInfosRouter.get('/countByRegisterDateAndTheater', permitScopes_1.default(['aws.cognito.signin.user.admin']), (req, __, next) => {
    req.checkQuery('fromDate')
        .notEmpty()
        .isISO8601()
        .withMessage('fromDate must be ISO8601 timestamp');
    req.checkQuery('toDate')
        .notEmpty()
        .isISO8601()
        .withMessage('toDate must be ISO8601 timestamp');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
            { 'typeOfGood.typeOf': 'ProgramMembership' }
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
