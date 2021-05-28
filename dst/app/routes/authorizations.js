"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 承認ルーター
 */
// import * as cinerino from '@cinerino/domain';
const express_1 = require("express");
// import permitScopes from '../middlewares/permitScopes';
// import rateLimit from '../middlewares/rateLimit';
// import validator from '../middlewares/validator';
const authorizationsRouter = express_1.Router();
/**
 * 承認検索
 */
// authorizationsRouter.get(
//     '',
//     permitScopes(['authorizations.*', 'authorizations.read']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             const searchConditions: cinerino.factory.authorization.ISearchConditions = {
//                 ...req.query,
//                 project: { id: { $eq: req.project.id } },
//                 // tslint:disable-next-line:no-magic-numbers
//                 limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
//                 page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
//             };
//             const authorizationService = new cinerino.chevre.service.Authorization({
//                 endpoint: cinerino.credentials.chevre.endpoint,
//                 auth: chevreAuthClient,
//                 project: { id: req.project.id }
//             });
//             const { data } = await authorizationService.search(searchConditions);
//             res.json(data);
//         } catch (error) {
//             next(error);
//         }
//     }
// );
exports.default = authorizationsRouter;
