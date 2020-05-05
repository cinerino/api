"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * オファールーター
 */
const express_1 = require("express");
const monetaryAmount_1 = require("./offers/monetaryAmount");
const paymentCard_1 = require("./offers/paymentCard");
const offersRouter = express_1.Router();
offersRouter.use('/monetaryAmount', monetaryAmount_1.default);
offersRouter.use('/paymentCard', paymentCard_1.default);
exports.default = offersRouter;
