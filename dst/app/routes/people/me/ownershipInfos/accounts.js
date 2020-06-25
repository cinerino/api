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
const DEFAULT_ACCOUNT_SELLER = process.env.DEFAULT_ACCOUNT_SELLER;
// const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
//     domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
//     clientId: <string>process.env.CHEVRE_CLIENT_ID,
//     clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
//     scopes: [],
//     state: ''
// });
const accountsRouter = express_1.Router();
/**
 * 口座開設
 */
// tslint:disable-next-line:use-default-type-parameter
accountsRouter.post('/:accountType', permitScopes_1.default(['people.me.*']), rateLimit_1.default, ...[
    express_validator_1.body('name')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        // tslint:disable-next-line:max-line-length
        let ownershipInfo;
        if (typeof DEFAULT_ACCOUNT_SELLER === 'string') {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const registerActionInProgressRepo = new cinerino.repository.action.RegisterServiceInProgress(redis.getClient());
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
            const project = yield projectRepo.findById({ id: req.project.id });
            if (typeof ((_c = (_b = (_a = project.settings) === null || _a === void 0 ? void 0 : _a.cognito) === null || _b === void 0 ? void 0 : _b.customerUserPool) === null || _c === void 0 ? void 0 : _c.id) !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satidfied');
            }
            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const seller = yield sellerRepo.findById({ id: DEFAULT_ACCOUNT_SELLER });
            const result = yield cinerino.service.transaction.orderAccount.orderAccount({
                project: { typeOf: project.typeOf, id: project.id },
                agent: { typeOf: req.agent.typeOf, id: req.agent.id },
                name: req.body.name,
                accountType: req.params.accountType,
                seller: { typeOf: seller.typeOf, id: seller.id }
            })({
                action: actionRepo,
                orderNumber: orderNumberRepo,
                ownershipInfo: ownershipInfoRepo,
                person: personRepo,
                registerActionInProgress: registerActionInProgressRepo,
                project: projectRepo,
                seller: sellerRepo,
                transaction: transactionRepo
            });
            const order = result.order;
            const orderActionAttributes = {
                agent: order.customer,
                object: order,
                potentialActions: {},
                project: order.project,
                typeOf: cinerino.factory.actionType.OrderAction
            };
            yield cinerino.service.order.placeOrder(orderActionAttributes)({
                action: actionRepo,
                invoice: invoiceRepo,
                order: orderRepo,
                task: taskRepo,
                transaction: transactionRepo
            });
            // 注文配送を実行する
            const sendOrderActionAttributes = {
                agent: order.seller,
                object: order,
                potentialActions: {
                    sendEmailMessage: undefined
                },
                project: order.project,
                recipient: order.customer,
                typeOf: cinerino.factory.actionType.SendAction
            };
            const ownershipInfos = yield cinerino.service.delivery.sendOrder(sendOrderActionAttributes)({
                action: actionRepo,
                order: orderRepo,
                ownershipInfo: ownershipInfoRepo,
                registerActionInProgress: registerActionInProgressRepo,
                task: taskRepo,
                transaction: transactionRepo
            });
            ownershipInfo = ownershipInfos[0];
        }
        else {
            // const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            ownershipInfo = yield cinerino.service.account.open({
                project: req.project,
                agent: req.agent,
                name: req.body.name,
                accountType: req.params.accountType
            })({
                // accountNumber: accountNumberRepo,
                ownershipInfo: ownershipInfoRepo,
                project: projectRepo
            });
        }
        res.status(http_status_1.CREATED)
            .json(ownershipInfo);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
 */
accountsRouter.put('/:accountType/:accountNumber/close', permitScopes_1.default(['people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        yield cinerino.service.account.close({
            project: req.project,
            ownedBy: {
                id: req.user.sub
            },
            accountType: req.params.accountType,
            accountNumber: req.params.accountNumber
        })({
            ownershipInfo: ownershipInfoRepo,
            project: projectRepo
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
accountsRouter.get('/actions/moneyTransfer', permitScopes_1.default(['people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const actions = yield cinerino.service.account.searchMoneyTransferActions({
            project: req.project,
            ownedBy: {
                id: req.user.sub
            },
            conditions: req.query
        })({
            ownershipInfo: ownershipInfoRepo,
            project: projectRepo
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = accountsRouter;
