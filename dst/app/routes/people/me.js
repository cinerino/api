"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * me(今ログイン中のユーザー)ルーター
 */
const express_1 = require("express");
const authentication_1 = require("../../middlewares/authentication");
const requireMember_1 = require("../../middlewares/requireMember");
const orders_1 = require("./me/orders");
const ownershipInfos_1 = require("./me/ownershipInfos");
const profile_1 = require("./me/profile");
const me4cinemasunshine_1 = require("./me4cinemasunshine");
const meRouter = express_1.Router();
meRouter.use(authentication_1.default);
meRouter.use(requireMember_1.default); // 自分のリソースへのアクセスなので、ログイン必須
meRouter.use('/orders', orders_1.default);
meRouter.use('/ownershipInfos', ownershipInfos_1.default);
meRouter.use('/profile', profile_1.default);
// Cinemasunshine対応(上記ルーターとの順番に注意)
meRouter.use(me4cinemasunshine_1.default); // 自分のリソースへのアクセスなので、ログイン必須
exports.default = meRouter;
