/**
 * イベント予約ルーター
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

type IPayload =
    cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.chevre.reservationType>>;

const eventReservationRouter = Router();
eventReservationRouter.use(authentication);

/**
 * 管理者として上映イベント予約検索
 */
eventReservationRouter.get(
    '/screeningEvent',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            // クエリをそのままChevre検索へパス
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const searchResult = await reservationService.searchScreeningEventReservations(req.query);
            res.set('X-Total-Count', searchResult.totalCount.toString());
            res.json(searchResult.data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * トークンで予約照会
 */
eventReservationRouter.post(
    '/screeningEvent/findByToken',
    permitScopes(['admin', 'tokens', 'tokens.read-only']),
    (req, _, next) => {
        req.checkBody('token', 'invalid token')
            .notEmpty()
            .withMessage('token is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const payload =
                await cinerino.service.code.verifyToken<IPayload>({
                    agent: req.agent,
                    token: req.body.token,
                    secret: <string>process.env.TOKEN_SECRET,
                    issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
                })({ action: new cinerino.repository.Action(mongoose.connection) });
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const ownershipInfo = await ownershipInfoRepo.search<cinerino.factory.chevre.reservationType.EventReservation>({
                typeOfGood: {
                    typeOf: cinerino.factory.chevre.reservationType.EventReservation,
                    id: payload.typeOfGood.id
                }
            })
                .then((infos) => {
                    if (infos.length === 0) {
                        throw new cinerino.factory.errors.NotFound('OwnershipInfo');
                    }

                    return infos[0];
                });

            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const reservation = await reservationService.findScreeningEventReservationById({ id: ownershipInfo.typeOfGood.id });

            // 入場
            await reservationService.attendScreeningEvent(reservation);

            res.json({ ...ownershipInfo, typeOfGood: reservation });
        } catch (error) {
            next(error);
        }
    }
);

export default eventReservationRouter;
