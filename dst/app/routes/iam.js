"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * IAMルーター
 */
const express = require("express");
const members_1 = require("./iam/members");
const iamRouter = express.Router();
iamRouter.use('/members', members_1.default);
exports.default = iamRouter;
