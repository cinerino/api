/**
 * プロダクトルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { query } from 'express-validator';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const productsRouter = Router();

/**
 * 検索
 */
productsRouter.get(
    '',
    permitScopes(['products.*', 'products.read']),
    rateLimit,
    ...[
        query('typeOf')
            .not()
            .isEmpty()
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings?.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
            }

            const searchConditions: any = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined
            };

            const productService = new cinerino.chevre.service.Product({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { data } = await productService.search(searchConditions);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * オファー検索
 */
// tslint:disable-next-line:use-default-type-parameter
productsRouter.get<ParamsDictionary>(
    '/:id/offers',
    permitScopes(['products.*', 'products.read']),
    rateLimit,
    ...[
        query('seller.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const offers = await cinerino.service.offer.product.search({
                project: { id: req.project.id },
                itemOffered: { id: req.params.id },
                seller: { id: req.query.seller?.id },
                availableAt: { id: req.user.client_id }
            })({
                project: projectRepo
            });

            res.json(offers);
        } catch (error) {
            next(error);
        }
    }
);

export default productsRouter;
