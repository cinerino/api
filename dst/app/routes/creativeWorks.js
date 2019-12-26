"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 作品ルーター
 */
const express_1 = require("express");
const movie_1 = require("./creativeWorks/movie");
const creativeWorksRouter = express_1.Router();
creativeWorksRouter.use('/movie', movie_1.default);
exports.default = creativeWorksRouter;
