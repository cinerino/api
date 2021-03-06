/**
 * 場所ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

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

const placesRouter = Router();

placesRouter.get(
    `/${cinerino.factory.chevre.placeType.MovieTheater}`,
    permitScopes(['places.*', 'places.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const placeService = new cinerino.chevre.service.Place({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const { data } = await placeService.searchMovieTheaters({
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

placesRouter.get(
    `/${cinerino.factory.chevre.placeType.ScreeningRoom}`,
    permitScopes(['places.*', 'places.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const placeService = new cinerino.chevre.service.Place({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
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
    `/${cinerino.factory.chevre.placeType.Seat}`,
    permitScopes(['places.*', 'places.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const placeService = new cinerino.chevre.service.Place({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
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
