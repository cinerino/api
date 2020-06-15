"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 組織ルーター
 */
// import * as cinerino from '@cinerino/domain';
const express_1 = require("express");
// import * as mongoose from 'mongoose';
// import permitScopes from '../middlewares/permitScopes';
// import rateLimit from '../middlewares/rateLimit';
// import validator from '../middlewares/validator';
const organizationsRouter = express_1.Router();
/**
 * @deprecated Use /sellers
 */
// organizationsRouter.get(
//     '/movieTheater',
//     permitScopes(['sellers.read']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             const searchCoinditions: cinerino.factory.seller.ISearchConditions = {
//                 ...req.query,
//                 project: { id: { $eq: req.project.id } },
//                 // tslint:disable-next-line:no-magic-numbers
//                 limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
//                 page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
//             };
//             const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
//             const sellers = await sellerRepo.search(
//                 searchCoinditions,
//                 // 管理者以外にセキュアな情報を露出しないように
//                 (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined
//             );
//             res.set('X-Total-Count', sellers.length.toString());
//             res.json(sellers);
//         } catch (error) {
//             next(error);
//         }
//     }
// );
exports.default = organizationsRouter;
