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
 * 口座ルーター
 */
const cinerino = require("@cinerino/domain");
const middlewares = require("@motionpicture/express-middleware");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const ioredis = require("ioredis");
const mongoose = require("mongoose");
const redis = require("../../redis");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.PECORINO_CLIENT_ID,
    clientSecret: process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const accountsRouter = express_1.Router();
accountsRouter.use(authentication_1.default);
/**
 * 管理者として口座開設
 */
accountsRouter.post('', permitScopes_1.default([]), ...[
    check_1.body('accountType', 'invalid accountType')
        .not()
        .isEmpty(),
    check_1.body('name', 'invalid name')
        .not()
        .isEmpty()
], rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const account = yield cinerino.service.account.openWithoutOwnershipInfo({
            project: req.project,
            accountType: req.body.accountType,
            name: req.body.name
        })({
            accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
            project: new cinerino.repository.Project(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(account);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 管理者として口座解約
 */
accountsRouter.put('/:accountType/:accountNumber/close', permitScopes_1.default([]), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.account.close({
            project: req.project,
            accountType: req.params.accountType,
            accountNumber: req.params.accountNumber
        })({
            ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座検索
 */
accountsRouter.get('', permitScopes_1.default([]), rateLimit_1.default, ...[
    check_1.query('accountType', 'invalid accountType')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
    // query('bookingFrom')
    //     .not()
    //     .isEmpty()
    //     .isISO8601()
    //     .toDate(),
    // query('bookingThrough')
    //     .not()
    //     .isEmpty()
    //     .isISO8601()
    //     .toDate()
    //     .custom((value, { req }) => {
    //         // 期間指定を限定
    //         const bookingThrough = moment(value);
    //         if (req.query !== undefined) {
    //             const bookingThroughExpectedToBe = moment(req.query.bookingFrom)
    //                 .add(1, 'months');
    //             if (bookingThrough.isAfter(bookingThroughExpectedToBe)) {
    //                 throw new Error('Booking time range too large');
    //             }
    //         }
    //         return true;
    //     })
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.pecorino === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        // クエリをそのままPecorino検索へパス
        const accountService = new cinerino.pecorinoapi.service.Account({
            endpoint: project.settings.pecorino.endpoint,
            auth: pecorinoAuthClient
        });
        const searchResult = yield accountService.searchWithTotalCount(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }));
        res.set('X-Total-Count', searchResult.totalCount.toString());
        res.json(searchResult.data);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引履歴検索
 */
accountsRouter.get('/actions/moneyTransfer', permitScopes_1.default([]), rateLimit_1.default, ...[
    check_1.query('accountType', 'invalid accountType')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
    // query('bookingFrom')
    //     .not()
    //     .isEmpty()
    //     .isISO8601()
    //     .toDate(),
    // query('bookingThrough')
    //     .not()
    //     .isEmpty()
    //     .isISO8601()
    //     .toDate()
    //     .custom((value, { req }) => {
    //         // 期間指定を限定
    //         const bookingThrough = moment(value);
    //         if (req.query !== undefined) {
    //             const bookingThroughExpectedToBe = moment(req.query.bookingFrom)
    //                 .add(1, 'months');
    //             if (bookingThrough.isAfter(bookingThroughExpectedToBe)) {
    //                 throw new Error('Booking time range too large');
    //             }
    //         }
    //         return true;
    //     })
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.pecorino === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        // クエリをそのままPecorino検索へパス
        const actionService = new cinerino.pecorinoapi.service.Action({
            endpoint: project.settings.pecorino.endpoint,
            auth: pecorinoAuthClient
        });
        const searchResult = yield actionService.searchMoneyTransferActions(Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } } }));
        res.set('X-Total-Count', searchResult.totalCount.toString());
        res.json(searchResult.data);
    }
    catch (error) {
        next(error);
    }
}));
// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = 60;
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = 60;
const redisClient = new ioredis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_KEY,
    tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
});
const depositAccountRateLimiet = middlewares.rateLimit({
    redisClient: redisClient,
    aggregationUnitInSeconds: UNIT_IN_SECONDS,
    threshold: THRESHOLD,
    // 制限超過時の動作をカスタマイズ
    limitExceededHandler: (_, __, res, next) => {
        res.setHeader('Retry-After', UNIT_IN_SECONDS);
        const message = `Retry after ${UNIT_IN_SECONDS} seconds for your transaction`;
        next(new cinerino.factory.errors.RateLimitExceeded(message));
    },
    // スコープ生成ロジックをカスタマイズ
    scopeGenerator: (_) => 'api:rateLimit4accountDepositTransaction'
});
/**
 * 管理者として口座に入金する
 */
accountsRouter.post('/transactions/deposit', permitScopes_1.default([]), 
// 互換性維持のため
(req, _, next) => {
    if (req.body.object === undefined || req.body.object === null) {
        req.body.object = {};
    }
    if (typeof req.body.amount === 'number') {
        req.body.object.amount = Number(req.body.amount);
    }
    if (typeof req.body.notes === 'string') {
        req.body.object.description = req.body.notes;
    }
    if (typeof req.body.toAccountNumber === 'string') {
        if (req.body.object.toLocation === undefined || req.body.object.toLocation === null) {
            req.body.object.toLocation = {};
        }
        req.body.object.toLocation.accountNumber = req.body.toAccountNumber;
    }
    next();
}, ...[
    check_1.body('recipient')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    check_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isInt()
        .withMessage(() => 'Amount must be number')
        .custom((value) => {
        if (Number(value) <= 0) {
            throw new Error('Amount must be more than 0');
        }
        return true;
    })
        .withMessage(() => 'Amount must be more than 0'),
    check_1.body('object.toLocation.accountNumber')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, depositAccountRateLimiet, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        yield cinerino.service.account.deposit({
            project: req.project,
            agent: Object.assign(Object.assign({ typeOf: cinerino.factory.personType.Person, name: (req.user.username !== undefined) ? req.user.username : req.user.sub }, req.body.agent), { id: req.user.sub }),
            object: Object.assign(Object.assign({}, req.body.object), { description: (typeof req.body.object.description === 'string') ? req.body.object.description : '入金' }),
            recipient: Object.assign({ typeOf: cinerino.factory.personType.Person }, req.body.recipient)
        })({
            project: projectRepo
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountsRouter;
