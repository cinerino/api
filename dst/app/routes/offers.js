"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * オファールーター
 */
const express_1 = require("express");
const monetaryAmount_1 = require("./offers/monetaryAmount");
const product_1 = require("./offers/product");
const offersRouter = express_1.Router();
offersRouter.use('/monetaryAmount', monetaryAmount_1.default);
offersRouter.use('/product', product_1.default);
exports.default = offersRouter;
