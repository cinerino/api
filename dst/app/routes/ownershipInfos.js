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
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
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
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const typeOfGood = (req.query.typeOfGood !== undefined && req.query.typeOfGood !== null) ? req.query.typeOfGood : {};
        let ownershipInfos;
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        switch (typeOfGood.typeOf) {
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
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        // const andConditions: any[] = [
        //     { 'typeOfGood.typeOf': cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership }
        // ];
        // andConditions.push({
        //     ownedFrom: {
        //         $gte: new Date(fromDate),
        //         $lte: new Date(toDate)
        //     }
        // });
        // if (Array.isArray(theaterIds)) {
        //     andConditions.push({
        //         'acquiredFrom.id': {
        //             $exists: true,
        //             $in: theaterIds
        //         }
        //     });
        // }
        // const count = await ownershipInfoService.countDocuments({ $and: andConditions })
        //     .exec();
        const searchOwnershipInfosResult = yield ownershipInfoService.search(Object.assign({ project: { id: { $eq: req.project.id } }, typeOfGood: { typeOf: { $eq: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership } }, countDocuments: '1', ownedFromGte: new Date(fromDate), ownedFromLte: new Date(toDate) }, (Array.isArray(theaterIds))
            ? { acquiredFrom: { id: { $in: theaterIds } } }
            : undefined));
        const count = Number(searchOwnershipInfosResult.totalCount);
        res.json({ count });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = ownershipInfosRouter;
