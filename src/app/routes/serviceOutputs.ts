/**
 * サービスアウトプットルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// import { query } from 'express-validator';
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

const serviceOutputsRouter = Router();

/**
 * 検索
 */
serviceOutputsRouter.get(
    '',
    permitScopes(['serviceOutputs.*', 'serviceOutputs.read']),
    rateLimit,
    ...[
        // query('typeOf')
        //     .not()
        //     .isEmpty()
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

            const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { data } = await serviceOutputService.search(searchConditions);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

export default serviceOutputsRouter;
