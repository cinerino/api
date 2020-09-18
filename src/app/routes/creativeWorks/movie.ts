/**
 * 映画ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

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
    permitScopes(['creativeWorks.*', 'creativeWorks.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const creativeWorkService = new cinerino.chevre.service.CreativeWork({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { data } = await creativeWorkService.searchMovies({
                ...req.query,
                project: { ids: [req.project.id] }
            });

            res.json(data);
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            next(error);
        }
    }
);

export default movieRouter;
