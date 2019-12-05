/**
 * 映画ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const movieRouter = Router();

/**
 * 映画作品検索
 */
movieRouter.get(
    '',
    permitScopes(['creativeWorks', 'creativeWorks.read-only']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const creativeWorkService = new cinerino.chevre.service.CreativeWork({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { totalCount, data } = await creativeWorkService.searchMovies({
                ...req.query,
                project: { ids: [req.project.id] }
            });
            res.set('X-Total-Count', totalCount.toString());
            res.json(data);
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            next(error);
        }
    }
);

export default movieRouter;
