"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * me(今ログイン中のユーザー)ルーター
 */
const express_1 = require("express");
const authentication_1 = require("../../middlewares/authentication");
const requireMember_1 = require("../../middlewares/requireMember");
const point_1 = require("./me/accounts/point");
const contacts_1 = require("./me/contacts");
const creditCards_1 = require("./me/creditCards");
const ownershipInfos_1 = require("./me/ownershipInfos");
const meRouter = express_1.Router();
meRouter.use(authentication_1.default);
meRouter.use(requireMember_1.default); // 自分のリソースへのアクセスなので、もちろんログイン必須
meRouter.use('/accounts/point', point_1.default);
meRouter.use('/contacts', contacts_1.default);
meRouter.use('/creditCards', creditCards_1.default);
meRouter.use('/ownershipInfos', ownershipInfos_1.default);
exports.default = meRouter;
