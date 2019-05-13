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
 * ムビチケ決済ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../../middlewares/authentication");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const movieTicketPaymentRouter = express_1.Router();
movieTicketPaymentRouter.use(authentication_1.default);
/**
 * ムビチケ購入番号確認
 */
movieTicketPaymentRouter.post('/actions/check', permitScopes_1.default(['customer', 'tokens']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.mvtkReserve === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const action = yield cinerino.service.payment.movieTicket.checkMovieTicket({
            project: req.project,
            typeOf: cinerino.factory.actionType.CheckAction,
            agent: req.agent,
            object: req.body
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            event: new cinerino.repository.Event(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection),
            movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                endpoint: project.settings.mvtkReserve.endpoint,
                auth: mvtkReserveAuthClient
            }),
            paymentMethod: new cinerino.repository.PaymentMethod(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ムビチケ決済承認
 */
movieTicketPaymentRouter.post('/authorize', permitScopes_1.default(['customer', 'transactions']), ...[
    check_1.body('object.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    check_1.body('object.amount')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isInt(),
    check_1.body('object.additionalProperty')
        .optional()
        .isArray(),
    check_1.body('object.movieTickets')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isArray()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.mvtkReserve === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const action = yield cinerino.service.payment.movieTicket.authorize({
            agent: { id: req.user.sub },
            object: {
                typeOf: cinerino.factory.paymentMethodType.MovieTicket,
                amount: 0,
                additionalProperty: req.body.object.additionalProperty,
                movieTickets: req.body.object.movieTickets
            },
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            event: new cinerino.repository.Event(mongoose.connection),
            seller: new cinerino.repository.Seller(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection),
            movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                endpoint: project.settings.mvtkReserve.endpoint,
                auth: mvtkReserveAuthClient
            })
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * ムビチケ決済承認取消
 */
movieTicketPaymentRouter.put('/authorize/:actionId/void', permitScopes_1.default(['customer', 'transactions']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: req.body.purpose.typeOf,
        id: req.body.purpose.id
    })(req, res, next);
}), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        yield cinerino.service.payment.movieTicket.voidTransaction({
            agent: { id: req.user.sub },
            id: req.params.actionId,
            purpose: { typeOf: req.body.purpose.typeOf, id: req.body.purpose.id }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = movieTicketPaymentRouter;
