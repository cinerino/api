/**
 * 会員プログラムルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
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

const programMembershipsRouter = Router();

/**
 * 会員プログラム検索
 * @deprecated ssktsでのみ仕様可能
 */
programMembershipsRouter.get(
    '',
    permitScopes(['programMemberships.*', 'programMemberships.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            if (typeof project.settings?.chevre?.endpoint !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
            }

            const productService = new cinerino.chevre.service.Product({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });

            const searchResult = await productService.search({
                project: { id: { $eq: req.project.id } },
                typeOf: { $eq: 'MembershipService' },
                ...{
                    limit: 1
                }
            });

            let membershipServices = searchResult.data;

            // api使用側への互換性維持のため、offers属性を補完
            membershipServices = membershipServices.map((m) => {
                return {
                    ...m,
                    offers: [
                        {
                            project: m.project,
                            typeOf: cinerino.factory.chevre.offerType.Offer,
                            identifier: 'AnnualPlan',
                            price: 500,
                            priceCurrency: cinerino.factory.chevre.priceCurrency.JPY
                        }
                    ]
                };
            });

            res.json(membershipServices);
        } catch (error) {
            next(error);
        }
    }
);

export default programMembershipsRouter;
