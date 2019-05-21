"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ルーター
 */
const express = require("express");
const accounts_1 = require("./accounts");
const actions_1 = require("./actions");
const authorizations_1 = require("./authorizations");
const creativeWorks_1 = require("./creativeWorks");
const events_1 = require("./events");
const health_1 = require("./health");
const iam_1 = require("./iam");
const invoices_1 = require("./invoices");
const orders_1 = require("./orders");
const organizations_1 = require("./organizations");
const ownershipInfos_1 = require("./ownershipInfos");
const payment_1 = require("./payment");
const paymentMethods_1 = require("./paymentMethods");
const people_1 = require("./people");
const me_1 = require("./people/me");
const places_1 = require("./places");
const programMembership_1 = require("./programMembership");
const projects_1 = require("./projects");
const reservations_1 = require("./reservations");
const sellers_1 = require("./sellers");
const stats_1 = require("./stats");
const tasks_1 = require("./tasks");
const transactions_1 = require("./transactions");
const userPools_1 = require("./userPools");
const router = express.Router();
// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })
router.use('/accounts', accounts_1.default);
router.use('/actions', actions_1.default);
router.use('/authorizations', authorizations_1.default);
router.use('/creativeWorks', creativeWorks_1.default);
router.use('/events', events_1.default);
router.use('/health', health_1.default);
router.use('/iam', iam_1.default);
router.use('/invoices', invoices_1.default);
router.use('/organizations', organizations_1.default);
router.use('/orders', orders_1.default);
router.use('/ownershipInfos', ownershipInfos_1.default);
router.use('/payment', payment_1.default);
router.use('/paymentMethods', paymentMethods_1.default);
router.use('/people/me', me_1.default);
router.use('/people', people_1.default);
router.use('/places', places_1.default);
router.use('/programMemberships', programMembership_1.default);
router.use('/projects', projects_1.default);
router.use('/reservations', reservations_1.default);
router.use('/sellers', sellers_1.default);
router.use('/stats', stats_1.default);
router.use('/tasks', tasks_1.default);
router.use('/transactions', transactions_1.default);
router.use('/userPools', userPools_1.default);
exports.default = router;
