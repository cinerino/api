/**
 * 映画ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const movieRouter = Router();
movieRouter.use(authentication);

/**
 * 映画作品検索
 */
movieRouter.get(
    '',
    permitScopes(['admin', 'creativeWorks', 'creativeWorks.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });

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
