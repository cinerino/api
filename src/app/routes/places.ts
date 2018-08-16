/**
 * 場所ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
const placesRouter = Router();

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

placesRouter.use(authentication);

placesRouter.get(
    '/movieTheater/:branchCode',
    permitScopes(['aws.cognito.signin.user.admin', 'places', 'places.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const repository = new cinerino.repository.Place(cinerino.mongoose.connection);
            await repository.findMovieTheaterByBranchCode(req.params.branchCode).then((theater) => {
                res.json(theater);
            });
        } catch (error) {
            next(error);
        }
    });

placesRouter.get(
    '/movieTheater',
    permitScopes(['aws.cognito.signin.user.admin', 'places', 'places.read-only']),
    validator,
    async (__, res, next) => {
        try {
            const repository = new cinerino.repository.Place(cinerino.mongoose.connection);
            await repository.searchMovieTheaters({}).then((places) => {
                res.json(places);
            });
        } catch (error) {
            next(error);
        }
    }
);

export default placesRouter;
