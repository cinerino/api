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
 * サービスアウトプットルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const moment = require("moment");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const CODE_EXPIRES_IN_SECONDS_DEFAULT = 300;
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const serviceOutputsRouter = express_1.Router();
/**
 * 検索
 */
serviceOutputsRouter.get('', permitScopes_1.default(['serviceOutputs.*', 'serviceOutputs.read']), rateLimit_1.default, ...[
// query('typeOf')
//     .not()
//     .isEmpty()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined });
        const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const { data } = yield serviceOutputService.search(searchConditions);
        res.json(data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * サービスアウトプットに対して所有権コードを発行する
 */
// tslint:disable-next-line:use-default-type-parameter
serviceOutputsRouter.post('/:identifier/authorize', permitScopes_1.default(['transactions']), rateLimit_1.default, ...[
    express_validator_1.oneOf([
        [
            express_validator_1.body('object.accessCode')
                .not()
                .isEmpty()
                .isString()
        ]
    ])
    // body('result.expiresInSeconds')
    //     .optional()
    //     .isInt({ min: 0, max: CODE_EXPIRES_IN_SECONDS_MAXIMUM })
    //     .toInt()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const now = new Date();
        const expiresInSeconds = CODE_EXPIRES_IN_SECONDS_DEFAULT;
        const accessCode = (_a = req.body.object) === null || _a === void 0 ? void 0 : _a.accessCode;
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        // chevreでサービスアウトプット検索
        const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const searchServiceOutputsResult = yield serviceOutputService.search({
            limit: 1,
            page: 1,
            identifier: { $eq: req.params.identifier },
            accessCode: { $eq: accessCode }
        });
        const serviceOutput = searchServiceOutputsResult.data.shift();
        if (serviceOutput === undefined) {
            throw new cinerino.factory.errors.NotFound('ServiceOutput');
        }
        const authorizationObject = {
            id: '',
            ownedBy: req.agent,
            ownedFrom: now,
            ownedThrough: moment(now)
                .add(expiresInSeconds, 'seconds')
                .toDate(),
            project: { id: req.project.id, typeOf: cinerino.factory.organizationType.Project },
            typeOf: 'OwnershipInfo',
            typeOfGood: {
                project: serviceOutput.project,
                typeOf: serviceOutput.typeOf,
                identifier: serviceOutput.identifier
            }
        };
        // 注文に対してコード発行
        const authorizations = yield cinerino.service.code.publish({
            project: req.project,
            agent: req.agent,
            recipient: req.agent,
            object: [authorizationObject],
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
        res.json({
            code: authorizations[0].code
        });
    }
    catch (error) {
        next(error);
    }
}));
exports.default = serviceOutputsRouter;
