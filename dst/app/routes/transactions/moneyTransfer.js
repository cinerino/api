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
 * 通貨転送取引ルーター
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const lockTransaction_1 = require("../../middlewares/lockTransaction");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
const redis = require("../../../redis");
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
// const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const moneyTransferTransactionsRouter = express_1.Router();
const debug = createDebug('cinerino-api:router');
// tslint:disable-next-line:use-default-type-parameter
moneyTransferTransactionsRouter.post('/start', permitScopes_1.default(['transactions']), ...[
    express_validator_1.body('expires', 'invalid expires')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isISO8601()
        .toDate(),
    express_validator_1.body('object')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isInt()
        .toInt(),
    express_validator_1.body('object.fromLocation')
        .not()
        .isEmpty(),
    express_validator_1.body('object.toLocation')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('agent.identifier')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('agent.identifier.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('agent.identifier.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('recipient')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('recipient.typeOf')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('seller')
        .not()
        .isEmpty()
        .withMessage(() => 'required'),
    express_validator_1.body('seller.typeOf')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('seller.id')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
    // if (!WAITER_DISABLED) {
    // }
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined || project.settings.pecorino === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        // const accountService = new cinerino.pecorinoapi.service.Account({
        //     endpoint: project.settings.pecorino.endpoint,
        //     auth: pecorinoAuthClient
        // });
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const fromLocation = yield validateFromLocation(req);
        const transaction = yield cinerino.service.transaction.moneyTransfer.start({
            project: req.project,
            expires: req.body.expires,
            agent: Object.assign(Object.assign(Object.assign({}, req.agent), (req.body.agent !== undefined && req.body.agent.name !== undefined) ? { name: req.body.agent.name } : {}), { identifier: [
                    ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                    ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                        ? req.body.agent.identifier.map((p) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : []
                ] }),
            object: Object.assign({ amount: req.body.object.amount, fromLocation: fromLocation, toLocation: req.body.object.toLocation, authorizeActions: [] }, (typeof req.body.object.description === 'string') ? { description: req.body.object.description } : {}),
            recipient: Object.assign(Object.assign({ typeOf: req.body.recipient.typeOf, id: req.body.recipient.id }, (typeof req.body.recipient.name === 'string') ? { name: req.body.recipient.name } : {}), (typeof req.body.recipient.url === 'string') ? { url: req.body.recipient.url } : {}),
            seller: req.body.seller
        })({
            // accountService: accountService,
            action: actionRepo,
            project: projectRepo,
            seller: sellerRepo,
            transaction: transactionRepo
        });
        // tslint:disable-next-line:no-string-literal
        // const host = req.headers['host'];
        // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
        res.json(transaction);
    }
    catch (error) {
        next(error);
    }
}));
function validateFromLocation(req) {
    return __awaiter(this, void 0, void 0, function* () {
        return req.body.object.fromLocation;
        // トークン化された口座情報でリクエストされた場合、実口座情報へ変換する
        // if (typeof fromLocation === 'string') {
        //     // tslint:disable-next-line:max-line-length
        // tslint:disable-next-line:max-line-length
        //     type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.AccountGoodType.Account>>;
        //     const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
        //         project: req.project,
        //         agent: req.agent,
        //         token: fromLocation,
        //         secret: <string>process.env.TOKEN_SECRET,
        //         issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
        //     })({ action: new cinerino.repository.Action(mongoose.connection) });
        //     const account = accountOwnershipInfo.typeOfGood;
        //     // if (account.accountType !== 'Coin') {
        //     //     throw new cinerino.factory.errors.Argument('fromAccount', 'Invalid token');
        //     // }
        //     fromLocation = <any>account;
        // } else {
        //     // 口座情報がトークンでない、かつ、APIユーザーが管理者でない場合、許可されるリクエストかどうか確認
        //     if (!req.isAdmin) {
        //         // 口座に所有権があるかどうか確認
        //         const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        //         const count = await ownershipInfoRepo.count<cinerino.factory.ownershipInfo.AccountGoodType.Account>({
        //             limit: 1,
        //             ownedBy: { id: req.user.sub },
        //             ownedFrom: new Date(),
        //             ownedThrough: new Date(),
        //             typeOfGood: {
        //                 typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
        //                 accountType: fromLocation.accountType,
        //                 accountNumber: fromLocation.accountNumber
        //             }
        //         });
        //         if (count === 0) {
        //             throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
        //         }
        //     }
        // }
        // return fromLocation;
    });
}
/**
 * 取引人プロフィール変更
 */
// tslint:disable-next-line:use-default-type-parameter
moneyTransferTransactionsRouter.put('/:transactionId/agent', permitScopes_1.default(['transactions']), ...[
    express_validator_1.body('additionalProperty')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('additionalProperty.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('additionalProperty.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.MoneyTransfer,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.MoneyTransfer,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.updateAgent({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId,
            agent: Object.assign(Object.assign({}, req.body), { typeOf: cinerino.factory.personType.Person, id: req.user.sub })
        })({
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
moneyTransferTransactionsRouter.put('/:transactionId/confirm', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.MoneyTransfer,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.MoneyTransfer,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        yield cinerino.service.transaction.moneyTransfer.confirm({
            id: req.params.transactionId
        })({
            action: actionRepo,
            transaction: transactionRepo
        });
        debug('transaction confirmed');
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.exportTasks({
            project: req.project,
            status: cinerino.factory.transactionStatusType.Confirmed,
            typeOf: { $in: [cinerino.factory.transactionType.MoneyTransfer] }
        })({
            project: projectRepo,
            task: taskRepo,
            transaction: transactionRepo
        })
            .then((tasks) => __awaiter(void 0, void 0, void 0, function* () {
            // タスクがあればすべて実行
            if (Array.isArray(tasks)) {
                yield Promise.all(tasks.map((task) => __awaiter(void 0, void 0, void 0, function* () {
                    yield cinerino.service.task.executeByName(task)({
                        connection: mongoose.connection,
                        redisClient: redis.getClient()
                    });
                })));
            }
        }));
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引を明示的に中止
 */
moneyTransferTransactionsRouter.put('/:transactionId/cancel', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.MoneyTransfer,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.MoneyTransfer,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        yield transactionRepo.cancel({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        });
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.exportTasks({
            project: req.project,
            status: cinerino.factory.transactionStatusType.Canceled,
            typeOf: { $in: [cinerino.factory.transactionType.MoneyTransfer] }
        })({
            project: projectRepo,
            task: taskRepo,
            transaction: transactionRepo
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引検索
 */
moneyTransferTransactionsRouter.get('', permitScopes_1.default(['transactions.*', 'transactions.read']), rateLimit_1.default, ...[
    express_validator_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, typeOf: cinerino.factory.transactionType.MoneyTransfer });
        const transactions = yield transactionRepo.search(searchConditions);
        res.json(transactions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引に対するアクション検索
 */
moneyTransferTransactionsRouter.get('/:transactionId/actions', permitScopes_1.default(['transactions.*', 'transactions.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const actions = yield actionRepo.searchByPurpose({
            purpose: {
                typeOf: cinerino.factory.transactionType.MoneyTransfer,
                id: req.params.transactionId
            },
            sort: req.query.sort
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = moneyTransferTransactionsRouter;
