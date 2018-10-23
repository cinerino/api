"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ルーター
 */
const express = require("express");
const events_1 = require("./events");
const health_1 = require("./health");
const orders_1 = require("./orders");
const organizations_1 = require("./organizations");
const ownershipInfos_1 = require("./ownershipInfos");
const payment_1 = require("./payment");
const people_1 = require("./people");
const me_1 = require("./people/me");
const reservations_1 = require("./reservations");
const tasks_1 = require("./tasks");
const transactions_1 = require("./transactions");
const userPools_1 = require("./userPools");
const router = express.Router();
// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })
router.use('/health', health_1.default);
router.use('/organizations', organizations_1.default);
router.use('/orders', orders_1.default);
router.use('/ownershipInfos', ownershipInfos_1.default);
router.use('/payment', payment_1.default);
router.use('/people/me', me_1.default);
router.use('/people', people_1.default);
router.use('/reservations', reservations_1.default);
router.use('/events', events_1.default);
router.use('/tasks', tasks_1.default);
router.use('/transactions', transactions_1.default);
router.use('/userPools', userPools_1.default);
exports.default = router;
