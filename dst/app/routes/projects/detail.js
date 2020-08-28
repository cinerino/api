"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * プロジェクト詳細ルーター
 */
const cinerino = require("@cinerino/domain");
const express = require("express");
const health_1 = require("../health");
const stats_1 = require("../stats");
const accounts_1 = require("../accounts");
const actions_1 = require("../actions");
const authorizations_1 = require("../authorizations");
const creativeWorks_1 = require("../creativeWorks");
const events_1 = require("../events");
const iam_1 = require("../iam");
const invoices_1 = require("../invoices");
const members_1 = require("../members");
const offers_1 = require("../offers");
const orders_1 = require("../orders");
const ownershipInfos_1 = require("../ownershipInfos");
const payment_1 = require("../payment");
const paymentMethods_1 = require("../paymentMethods");
const people_1 = require("../people");
const me_1 = require("../people/me");
const place_1 = require("../place");
const products_1 = require("../products");
const reservations_1 = require("../reservations");
const sellers_1 = require("../sellers");
const serviceOutputs_1 = require("../serviceOutputs");
const tasks_1 = require("../tasks");
const transactions_1 = require("../transactions");
const ttts_1 = require("../ttts");
const userPools_1 = require("../userPools");
const projectDetailRouter = express.Router();
projectDetailRouter.use((req, _, next) => {
    var _a;
    // プロジェクト未指定は拒否
    if (typeof ((_a = req.project) === null || _a === void 0 ? void 0 : _a.id) !== 'string') {
        next(new cinerino.factory.errors.Forbidden('project not specified'));
        return;
    }
    next();
});
projectDetailRouter.use('/health', health_1.default);
projectDetailRouter.use('/stats', stats_1.default);
projectDetailRouter.use('/accounts', accounts_1.default);
projectDetailRouter.use('/actions', actions_1.default);
projectDetailRouter.use('/authorizations', authorizations_1.default);
projectDetailRouter.use('/creativeWorks', creativeWorks_1.default);
projectDetailRouter.use('/events/screeningEvent', events_1.default);
projectDetailRouter.use('/events', events_1.default);
projectDetailRouter.use('/iam', iam_1.default);
projectDetailRouter.use('/invoices', invoices_1.default);
projectDetailRouter.use('/members', members_1.default);
projectDetailRouter.use('/offers', offers_1.default);
projectDetailRouter.use('/orders', orders_1.default);
projectDetailRouter.use('/ownershipInfos', ownershipInfos_1.default);
projectDetailRouter.use('/payment', payment_1.default);
projectDetailRouter.use('/paymentMethods', paymentMethods_1.default);
projectDetailRouter.use('/people/me', me_1.default);
projectDetailRouter.use('/people', people_1.default);
projectDetailRouter.use('/places', place_1.default);
projectDetailRouter.use('/products', products_1.default);
projectDetailRouter.use('/reservations', reservations_1.default);
projectDetailRouter.use('/sellers', sellers_1.default);
projectDetailRouter.use('/serviceOutputs', serviceOutputs_1.default);
projectDetailRouter.use('/tasks', tasks_1.default);
projectDetailRouter.use('/transactions', transactions_1.default);
projectDetailRouter.use('/ttts', ttts_1.default);
projectDetailRouter.use('/userPools', userPools_1.default);
exports.default = projectDetailRouter;
