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
 * 注文返品取引ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const redis = require("../../../redis");
const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';
const returnOrderTransactionsRouter = express_1.Router();
returnOrderTransactionsRouter.use(authentication_1.default);
/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}
returnOrderTransactionsRouter.post('/start', permitScopes_1.default(['admin']), ...[
    check_1.body('expires')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isISO8601()
        .toDate(),
    check_1.body('object.order.orderNumber')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
        const orderRepo = new cinerino.repository.Order(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        let order;
        let returnableOrder = req.body.object.order;
        // APIユーザーが管理者の場合、顧客情報を自動取得
        if (req.isAdmin) {
            order = yield orderRepo.findByOrderNumber({ orderNumber: returnableOrder.orderNumber });
            returnableOrder = Object.assign(Object.assign({}, returnableOrder), { customer: { email: order.customer.email, telephone: order.customer.telephone } });
        }
        else {
            const returnableOrderCustomer = returnableOrder.customer;
            if (returnableOrderCustomer === undefined) {
                throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
            }
            if (returnableOrderCustomer.email === undefined && returnableOrderCustomer.telephone === undefined) {
                throw new cinerino.factory.errors.ArgumentNull('Order Customer', 'Order customer info required');
            }
            // 管理者でない場合は、個人情報完全一致で承認
            const orders = yield orderRepo.search({
                orderNumbers: [returnableOrder.orderNumber],
                customer: {
                    email: (returnableOrderCustomer.email !== undefined)
                        ? `^${escapeRegExp(returnableOrderCustomer.email)}$`
                        : undefined,
                    telephone: (returnableOrderCustomer.telephone !== undefined)
                        ? `^${escapeRegExp(returnableOrderCustomer.telephone)}$`
                        : undefined
                }
            });
            order = orders.shift();
            if (order === undefined) {
                throw new cinerino.factory.errors.NotFound('Order');
            }
            returnableOrder = order;
        }
        const transaction = yield cinerino.service.transaction.returnOrder.start({
            project: req.project,
            agent: Object.assign(Object.assign({}, req.agent), { identifier: [
                    ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                    ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                        ? req.body.agent.identifier.map((p) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : []
                ] }),
            expires: req.body.expires,
            object: {
                cancellationFee: 0,
                clientUser: req.user,
                order: returnableOrder,
                reason: cinerino.factory.transaction.returnOrder.Reason.Seller
            },
            seller: order.seller
        })({
            action: actionRepo,
            invoice: invoiceRepo,
            order: orderRepo,
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
// tslint:disable-next-line:use-default-type-parameter
returnOrderTransactionsRouter.put('/:transactionId/confirm', permitScopes_1.default(['admin']), ...[
    // Eメールカスタマイズのバリデーション
    check_1.body([
        'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.about',
        'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.template',
        'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.sender.email',
        // tslint:disable-next-line:max-line-length
        'potentialActions.returnOrder.potentialActions.refundCreditCard.potentialActions.sendEmailMessage.object.toRecipient.email'
    ])
        .optional()
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} must not be empty`)
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        yield cinerino.service.transaction.returnOrder.confirm(Object.assign(Object.assign({}, req.body), { id: req.params.transactionId, agent: { id: req.user.sub } }))({
            action: actionRepo,
            transaction: transactionRepo,
            seller: sellerRepo
        });
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.returnOrder.exportTasks({
            project: (MULTI_TENANT_SUPPORTED) ? req.project : undefined,
            status: cinerino.factory.transactionStatusType.Confirmed
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
returnOrderTransactionsRouter.get('', permitScopes_1.default(['admin']), ...[
    check_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, typeOf: cinerino.factory.transactionType.ReturnOrder });
        const transactions = yield transactionRepo.search(searchConditions);
        const totalCount = yield transactionRepo.count(searchConditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(transactions);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = returnOrderTransactionsRouter;
