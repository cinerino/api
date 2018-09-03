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
const http_status_1 = require("http-status");
const moment = require("moment");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const validator_1 = require("../../middlewares/validator");
const returnOrderTransactionsRouter = express_1.Router();
const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
const transactionRepo = new cinerino.repository.Transaction(cinerino.mongoose.connection);
const organizationRepo = new cinerino.repository.Organization(cinerino.mongoose.connection);
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
    req.checkBody('transactionId', 'invalid transactionId').notEmpty().withMessage('transactionId is required');
    next();
}, validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const cancelReservationService = new cinerino.chevre.service.transaction.CancelReservation({
            endpoint: process.env.CHEVRE_ENDPOINT,
            auth: chevreAuthClient
        });
        const transaction = yield cinerino.service.transaction.returnOrder.start({
            expires: moment(req.body.expires).toDate(),
            agentId: req.user.sub,
            transactionId: req.body.transactionId,
            clientUser: req.user,
            cancellationFee: 0,
            forcibly: true,
            reason: cinerino.factory.transaction.returnOrder.Reason.Seller
        })({
            action: actionRepo,
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
        yield cinerino.service.transaction.returnOrder.confirm(req.user.sub, req.params.transactionId)({
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
exports.default = returnOrderTransactionsRouter;
