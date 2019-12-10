"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * アプリケーションルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
// import { body } from 'express-validator/check';
// import { CREATED, NO_CONTENT } from 'http-status';
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const applicationsRouter = express_1.Router();
/**
 * アプリケーション作成
 */
// applicationsRouter.post(
//     '',
//     permitScopes(['applications']),
//     rateLimit,
//     ...[
//         body('typeOf')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required')
//     ],
//     validator,
//     async (req, res, next) => {
//         try {
//             const attributes: cinerino.factory.seller.IAttributes<typeof req.body.typeOf> = {
//                 ...req.body,
//                 project: req.project
//             };
//             const applicationRepo = new cinerino.repository.Application(mongoose.connection);
//             const application = await applicationRepo.save({ attributes: attributes });
//             res.status(CREATED)
//                 .json(application);
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * アプリケーション検索
 */
applicationsRouter.get('', permitScopes_1.default(['applications', 'applications.read-only']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchCoinditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const applicationRepo = new cinerino.repository.Application(mongoose.connection);
        const applications = yield applicationRepo.search(searchCoinditions);
        const totalCount = yield applicationRepo.count(searchCoinditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(applications);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDでアプリケーション検索
 */
applicationsRouter.get('/:id', permitScopes_1.default(['applications', 'applications.read-only']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const applicationRepo = new cinerino.repository.Application(mongoose.connection);
        const application = yield applicationRepo.findById({
            id: req.params.id
        });
        res.json(application);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * アプリケーション更新
 */
// tslint:disable-next-line:use-default-type-parameter
// applicationsRouter.put<ParamsDictionary>(
//     '/:id',
//     permitScopes(['applications']),
//     rateLimit,
//     ...[
//         body('typeOf')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required')
//     ],
//     validator,
//     async (req, res, next) => {
//         try {
//             const attributes: cinerino.factory.seller.IAttributes<typeof req.body.typeOf> = {
//                 ...req.body,
//                 project: req.project
//             };
//             const applicationRepo = new cinerino.repository.Application(mongoose.connection);
//             await applicationRepo.save({ id: req.params.id, attributes: attributes });
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
/**
 * アプリケーション削除
 */
// applicationsRouter.delete(
//     '/:id',
//     permitScopes(['applications']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//         try {
//             const applicationRepo = new cinerino.repository.Application(mongoose.connection);
//             await applicationRepo.deleteById({
//                 id: req.params.id
//             });
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );
exports.default = applicationsRouter;
