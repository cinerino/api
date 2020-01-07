/**
 * アプリケーションルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
// import { body } from 'express-validator';
// import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const applicationsRouter = Router();

/**
 * アプリケーション作成
 */
// applicationsRouter.post(
//     '',
//     permitScopes(['applications.*']),
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
applicationsRouter.get(
    '',
    permitScopes(['applications.*', 'applications.read-only']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: any = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const applicationRepo = new cinerino.repository.Application(mongoose.connection);
            const applications = await applicationRepo.search(searchCoinditions);
            const totalCount = await applicationRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(applications);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDでアプリケーション検索
 */
applicationsRouter.get(
    '/:id',
    permitScopes(['applications.*', 'applications.read-only']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const applicationRepo = new cinerino.repository.Application(mongoose.connection);
            const application = await applicationRepo.findById(
                {
                    id: req.params.id
                }
            );
            res.json(application);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * アプリケーション更新
 */
// tslint:disable-next-line:use-default-type-parameter
// applicationsRouter.put<ParamsDictionary>(
//     '/:id',
//     permitScopes(['applications.*']),
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
//     permitScopes(['applications.*']),
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

export default applicationsRouter;
