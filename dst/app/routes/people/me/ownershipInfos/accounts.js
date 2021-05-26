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
 * 自分の口座ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../../../../middlewares/permitScopes");
const rateLimit_1 = require("../../../../middlewares/rateLimit");
const validator_1 = require("../../../../middlewares/validator");
const redis = require("../../../../../redis");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const accountsRouter = express_1.Router();
/**
 * 口座開設
 * @deprecated 注文取引サービスを使用すべし
 */
// tslint:disable-next-line:use-default-type-parameter
accountsRouter.post('/:accountType', permitScopes_1.default(['people.me.*']), rateLimit_1.default, ...[
    express_validator_1.body('name')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const registerActionInProgressRepo = new cinerino.repository.action.RegisterServiceInProgress(redis.getClient());
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
        const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
        const project = yield projectRepo.findById({ id: req.project.id });
        if (typeof ((_c = (_b = (_a = project.settings) === null || _a === void 0 ? void 0 : _a.cognito) === null || _b === void 0 ? void 0 : _b.customerUserPool) === null || _c === void 0 ? void 0 : _c.id) !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satidfied');
        }
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.customerUserPool.id
        });
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const productService = new cinerino.chevre.service.Product({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const result = yield cinerino.service.transaction.orderAccount.orderAccount({
            project: { typeOf: project.typeOf, id: project.id },
            agent: { typeOf: req.agent.typeOf, id: req.agent.id },
            name: req.body.name,
            accountType: req.params.accountType,
            location: { id: req.user.client_id }
        })({
            action: actionRepo,
            categoryCode: new cinerino.chevre.service.CategoryCode({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            }),
            confirmationNumber: confirmationNumberRepo,
            orderNumber: orderNumberRepo,
            ownershipInfo: ownershipInfoService,
            person: personRepo,
            product: productService,
            registerActionInProgress: registerActionInProgressRepo,
            project: projectRepo,
            seller: new cinerino.chevre.service.Seller({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            }),
            transaction: transactionRepo
        });
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.exportTasks({
            project: req.project,
            status: cinerino.factory.transactionStatusType.Confirmed,
            typeOf: { $in: [cinerino.factory.transactionType.PlaceOrder] }
        })({
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
        res.status(http_status_1.CREATED)
            .json(result);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座解約
 * 口座の状態を変更するだけで、所有権は変更しない
 */
accountsRouter.put('/:accountType/:accountNumber/close', permitScopes_1.default(['people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const accountService = new cinerino.chevre.service.Account({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        yield cinerino.service.account.close({
            project: req.project,
            ownedBy: { id: req.user.sub },
            accountNumber: req.params.accountNumber
        })({
            account: accountService,
            ownershipInfo: ownershipInfoService
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座取引履歴検索
 */
accountsRouter.get('/actions/moneyTransfer', permitScopes_1.default(['people.me.*']), rateLimit_1.default, ...[
    express_validator_1.query('accountNumber')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const accountService = new cinerino.chevre.service.Account({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient,
            project: { id: req.project.id }
        });
        let actions = yield cinerino.service.account.searchMoneyTransferActions({
            project: req.project,
            ownedBy: { id: req.user.sub },
            conditions: req.query,
            typeOfGood: { accountNumber: String(req.query.accountNumber) }
        })({
            account: accountService,
            ownershipInfo: ownershipInfoService
        });
        actions = actions.map((a) => {
            return Object.assign(Object.assign({}, a), { amount: (typeof a.amount === 'number')
                    ? {
                        typeOf: 'MonetaryAmount',
                        currency: 'Point',
                        value: a.amount
                    }
                    : a.amount });
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountsRouter;
