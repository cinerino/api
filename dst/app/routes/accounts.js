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
exports.deposit = void 0;
/**
 * 口座ルーター
 */
const cinerino = require("@cinerino/domain");
const middlewares = require("@motionpicture/express-middleware");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const ioredis = require("ioredis");
const moment = require("moment");
const mongoose = require("mongoose");
// import * as redis from '../../redis';
const permitScopes_1 = require("../middlewares/permitScopes");
// import rateLimit from '../middlewares/rateLimit';
const validator_1 = require("../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const accountsRouter = express_1.Router();
/**
 * 管理者として口座開設
 */
// accountsRouter.post(
//     '',
//     permitScopes(['accounts.*', 'accounts.write']),
//     ...[
//         body('accountType', 'invalid accountType')
//             .not()
//             .isEmpty(),
//         body('name', 'invalid name')
//             .not()
//             .isEmpty()
//     ],
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             const account = await cinerino.service.account.openWithoutOwnershipInfo({
//                 project: req.project,
//                 accountType: req.body.accountType,
//                 name: req.body.name
//             })({
//                 // accountNumber: new cinerino.repository.AccountNumber(redis.getClient()),
//                 project: new cinerino.repository.Project(mongoose.connection)
//             });
//             res.status(CREATED)
//                 .json(account);
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * 管理者として口座解約
 */
// accountsRouter.put(
//     '/:accountType/:accountNumber/close',
//     permitScopes(['accounts.*', 'accounts.write']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             await cinerino.service.account.close({
//                 project: req.project,
//                 accountType: <cinerino.factory.accountType>req.params.accountType,
//                 accountNumber: req.params.accountNumber
//             })({
//                 ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
//                 project: new cinerino.repository.Project(mongoose.connection)
//             });
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
// tslint:disable-next-line:no-magic-numbers
const UNIT_IN_SECONDS = 1;
// tslint:disable-next-line:no-magic-numbers
const THRESHOLD = 1;
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
accountsRouter.post('/transactions/deposit', permitScopes_1.default(['accounts.transactions.deposit.write']), 
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
    express_validator_1.body('recipient')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('object.amount')
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
    express_validator_1.body('object.toLocation.accountNumber')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, depositAccountRateLimiet, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        // ひとつ目のペイメントカードプロダクトを検索
        const productService = new cinerino.chevre.service.Product({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchProductsResult = yield productService.search({
            limit: 1,
            project: { id: { $eq: req.project.id } },
            typeOf: { $eq: cinerino.factory.chevre.product.ProductType.PaymentCard }
        });
        const product = searchProductsResult.data.shift();
        if (product === undefined) {
            throw new cinerino.factory.errors.NotFound('Product');
        }
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const fromLocation = Object.assign(Object.assign({ typeOf: cinerino.factory.personType.Person, name: (req.user.username !== undefined) ? req.user.username : req.user.sub }, req.body.agent), { id: req.user.sub });
        const toLocation = {
            typeOf: String((_a = product.serviceOutput) === null || _a === void 0 ? void 0 : _a.typeOf),
            identifier: (_c = (_b = req.body.object) === null || _b === void 0 ? void 0 : _b.toLocation) === null || _c === void 0 ? void 0 : _c.accountNumber
        };
        const recipient = Object.assign({ typeOf: cinerino.factory.personType.Person }, req.body.recipient);
        const amount = Number((_d = req.body.object) === null || _d === void 0 ? void 0 : _d.amount);
        const description = (typeof ((_e = req.body.object) === null || _e === void 0 ? void 0 : _e.description) === 'string') ? req.body.object.description : '入金';
        yield deposit({
            project: req.project,
            agent: fromLocation,
            object: {
                amount: {
                    typeOf: 'MonetaryAmount',
                    currency: '',
                    value: amount
                },
                fromLocation: fromLocation,
                toLocation: toLocation,
                description: description
            },
            recipient: recipient
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
function deposit(params) {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        try {
            const project = yield repos.project.findById({ id: params.project.id });
            const transactionNumberService = new cinerino.chevre.service.TransactionNumber({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { transactionNumber } = yield transactionNumberService.publish({
                project: { id: project.id }
            });
            // Chevreで入金
            const moneyTransferService = new cinerino.chevre.service.transaction.MoneyTransfer({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            yield moneyTransferService.start({
                transactionNumber: transactionNumber,
                project: { typeOf: project.typeOf, id: project.id },
                typeOf: cinerino.chevre.factory.transactionType.MoneyTransfer,
                agent: params.agent,
                expires: moment()
                    .add(1, 'minutes')
                    .toDate(),
                object: {
                    amount: params.object.amount,
                    fromLocation: params.object.fromLocation,
                    toLocation: params.object.toLocation,
                    description: params.object.description,
                    pendingTransaction: {
                        typeOf: cinerino.factory.pecorino.transactionType.Deposit,
                        id: '' // 空でok
                    }
                },
                recipient: params.recipient
            });
            yield moneyTransferService.confirm({ transactionNumber: transactionNumber });
        }
        catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            throw error;
        }
    });
}
exports.deposit = deposit;
exports.default = accountsRouter;
