"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 組織ルーター
 */
const express_1 = require("express");
const movieTheater_1 = require("./organizations/movieTheater");
const organizationsRouter = express_1.Router();
organizationsRouter.use('/movieTheater', movieTheater_1.default);
exports.default = organizationsRouter;
