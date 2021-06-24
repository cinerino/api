/**
 * 場所ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const placesRouter = Router();

placesRouter.get(
    `/${cinerino.factory.placeType.MovieTheater}`,
    permitScopes(['places.*', 'places.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const placeService = new cinerino.chevre.service.Place({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const { data } = await placeService.searchMovieTheaters({
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

placesRouter.get(
    `/${cinerino.factory.placeType.ScreeningRoom}`,
    permitScopes(['places.*', 'places.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const placeService = new cinerino.chevre.service.Place({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const { data } = await placeService.searchScreeningRooms({
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

placesRouter.get(
    `/${cinerino.factory.placeType.Seat}`,
    permitScopes(['places.*', 'places.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const placeService = new cinerino.chevre.service.Place({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const { data } = await placeService.searchSeats({
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

export default placesRouter;
