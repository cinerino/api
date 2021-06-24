/**
 * 映画ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

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
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const { data } = await creativeWorkService.searchMovies({
                ...req.query,
                project: { id: { $eq: req.project.id } }
            });

            res.json(data);
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            next(error);
        }
    }
);

export default movieRouter;
