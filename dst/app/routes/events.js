"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * イベントルーター
 */
const express_1 = require("express");
const screeningEvent_1 = require("./events/screeningEvent");
const authentication_1 = require("../middlewares/authentication");
const eventsRouter = express_1.Router();
eventsRouter.use(authentication_1.default);
eventsRouter.use('/screeningEvent', screeningEvent_1.default);
exports.default = eventsRouter;
