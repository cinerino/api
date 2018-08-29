"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 予約ルーター
 */
const express_1 = require("express");
const eventReservation_1 = require("./reservations/eventReservation");
const reservationsRouter = express_1.Router();
reservationsRouter.use('/eventReservation', eventReservation_1.default);
exports.default = reservationsRouter;
