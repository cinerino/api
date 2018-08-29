/**
 * 劇場組織ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

const movieTheaterRouter = Router();
movieTheaterRouter.use(authentication);
movieTheaterRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']),
    validator,
    async (__, res, next) => {
        try {
            const repository = new cinerino.repository.Organization(cinerino.mongoose.connection);
            await repository.searchMovieTheaters({
            }).then((movieTheaters) => {
                res.json(movieTheaters);
            });
        } catch (error) {
            next(error);
        }
    }
);
movieTheaterRouter.get(
    '/:branchCode',
    permitScopes(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const repository = new cinerino.repository.Organization(cinerino.mongoose.connection);
            await repository.findMovieTheaterByBranchCode(req.params.branchCode).then((movieTheater) => {
                res.json(movieTheater);
            });
        } catch (error) {
            next(error);
        }
    });
export default movieTheaterRouter;
