/**
 * 販売者ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const sellersRouter = Router();

/**
 * 販売者作成
 */
sellersRouter.post(
    '',
    permitScopes(['sellers']),
    rateLimit,
    ...[
        body('typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('name.ja')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('name.en')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('parentOrganization.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('parentOrganization.name.ja')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('parentOrganization.name.en')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('telephone')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('url')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isURL(),
        body('paymentAccepted')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isArray(),
        body('hasPOS')
            .isArray(),
        body('areaServed')
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        try {
            const attributes: cinerino.factory.seller.IAttributes<typeof req.body.typeOf> = {
                ...req.body,
                project: req.project
            };

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const seller = await sellerRepo.save({ attributes: attributes });

            res.status(CREATED)
                .json(seller);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 販売者検索
 */
sellersRouter.get(
    '',
    permitScopes(['customer', 'sellers', 'sellers.read-only', 'pos']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: cinerino.factory.seller.ISearchConditions = {
                ...req.query,
                project: { ids: [req.project.id] },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const sellers = await sellerRepo.search(
                searchCoinditions,
                // 管理者以外にセキュアな情報を露出しないように
                (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined
            );
            const totalCount = await sellerRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(sellers);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDで販売者検索
 */
sellersRouter.get(
    '/:id',
    permitScopes(['customer', 'sellers', 'sellers.read-only']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const seller = await sellerRepo.findById(
                {
                    id: req.params.id
                },
                // 管理者以外にセキュアな情報を露出しないように
                (!req.isAdmin) ? { 'paymentAccepted.gmoInfo.shopPass': 0 } : undefined
            );
            res.json(seller);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 販売者更新
 */
// tslint:disable-next-line:use-default-type-parameter
sellersRouter.put<ParamsDictionary>(
    '/:id',
    permitScopes(['sellers']),
    rateLimit,
    ...[
        body('typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('name.ja')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('name.en')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('parentOrganization.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('parentOrganization.name.ja')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('parentOrganization.name.en')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('telephone')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('url')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isURL(),
        body('paymentAccepted')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isArray(),
        body('hasPOS')
            .isArray(),
        body('areaServed')
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        try {
            const attributes: cinerino.factory.seller.IAttributes<typeof req.body.typeOf> = {
                ...req.body,
                project: req.project
            };

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            await sellerRepo.save({ id: req.params.id, attributes: attributes });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 販売者削除
 */
sellersRouter.delete(
    '/:id',
    permitScopes(['sellers']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            await sellerRepo.deleteById({
                id: req.params.id
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default sellersRouter;
