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
    async (req, res, next) => {
        try {
            const organizationRepo = new cinerino.repository.Organization(cinerino.mongoose.connection);
            const searchCoinditions: cinerino.factory.organization.movieTheater.ISearchConditions = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : /* istanbul ignore next*/ 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : /* istanbul ignore next*/ 1,
                name: req.query.name
            };
            const movieTheaters = await organizationRepo.searchMovieTheaters(searchCoinditions);
            const totalCount = await organizationRepo.countMovieTheaters(searchCoinditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(movieTheaters);
        } catch (error) {
            next(error);
        }
    }
);
movieTheaterRouter.get(
    '/:id',
    permitScopes(['aws.cognito.signin.user.admin', 'organizations', 'organizations.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const organizationRepo = new cinerino.repository.Organization(cinerino.mongoose.connection);
            const movieTheater = await organizationRepo.findById({
                typeOf: cinerino.factory.organizationType.MovieTheater,
                id: req.params.id
            });
            res.json(movieTheater);
        } catch (error) {
            next(error);
        }
    });
export default movieTheaterRouter;
