"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * me(今ログイン中のユーザー)ルーター
 */
const express_1 = require("express");
const authentication_1 = require("../../middlewares/authentication");
const requireMember_1 = require("../../middlewares/requireMember");
const contacts_1 = require("./me/contacts");
const orders_1 = require("./me/orders");
const ownershipInfos_1 = require("./me/ownershipInfos");
const meRouter = express_1.Router();
meRouter.use(authentication_1.default);
meRouter.use(requireMember_1.default); // 自分のリソースへのアクセスなので、もちろんログイン必須
meRouter.use('/contacts', contacts_1.default);
meRouter.use('/orders', orders_1.default);
meRouter.use('/ownershipInfos', ownershipInfos_1.default);
exports.default = meRouter;
