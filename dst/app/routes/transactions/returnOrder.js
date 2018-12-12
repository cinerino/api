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
 * 注文返品取引ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const moment = require("moment");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const returnOrderTransactionsRouter = express_1.Router();
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
returnOrderTransactionsRouter.use(authentication_1.default);
returnOrderTransactionsRouter.post('/start', permitScopes_1.default(['admin']), (req, _, next) => {
    req.checkBody('expires', 'invalid expires').notEmpty().withMessage('expires is required').isISO8601();
    req.checkBody('object.order.orderNumber', 'invalid order number').notEmpty().withMessage('object.order.orderNumber is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
        const invoiceRepo = new cinerino.repository.Invoice(cinerino.mongoose.connection);
        const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
        const cancelReservationService = new cinerino.chevre.service.transaction.CancelReservation({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const transaction = yield cinerino.service.transaction.returnOrder.start({
            expires: moment(req.body.expires).toDate(),
            agent: Object.assign({}, req.agent, { identifier: [
                    ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                    ...(req.body.agent !== undefined && req.body.agent.identifier !== undefined) ? req.body.agent.identifier : []
                ] }),
            object: {
                order: { orderNumber: req.body.object.order.orderNumber },
                clientUser: req.user,
                cancellationFee: 0,
                // forcibly: true,
                reason: cinerino.factory.transaction.returnOrder.Reason.Seller
            }
        })({
            action: actionRepo,
            invoice: invoiceRepo,
            transaction: transactionRepo,
            order: orderRepo,
            cancelReservationService: cancelReservationService
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
returnOrderTransactionsRouter.put('/:transactionId/confirm', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
        const organizationRepo = new cinerino.repository.Organization(cinerino.mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
        yield cinerino.service.transaction.returnOrder.confirm({
            id: req.params.transactionId,
            agent: { id: req.user.sub }
        })({
            action: actionRepo,
            transaction: transactionRepo,
            organization: organizationRepo
        });
        res.status(http_status_1.NO_CONTENT).end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引検索
 */
returnOrderTransactionsRouter.get('', permitScopes_1.default(['admin']), ...[
    check_1.query('startFrom').optional().isISO8601().toDate(),
    check_1.query('startThrough').optional().isISO8601().toDate(),
    check_1.query('endFrom').optional().isISO8601().toDate(),
    check_1.query('endThrough').optional().isISO8601().toDate()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
        const searchConditions = Object.assign({}, req.query, { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, sort: (req.query.sort !== undefined) ? req.query.sort : { orderDate: cinerino.factory.sortType.Descending }, typeOf: cinerino.factory.transactionType.ReturnOrder });
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
