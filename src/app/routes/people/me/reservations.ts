/**
 * 自分の予約ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// import { CREATED, NO_CONTENT } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

// import * as redis from '../../../../redis';

const reservationsRouter = Router();
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

/**
 * 上映イベント予約検索
 */
reservationsRouter.get(
    '/eventReservation/screeningEvent',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations({
                personId: req.user.sub,
                ownedAt: new Date()
            })({
                ownershipInfo: ownershipInfoRepo,
                reservationService: reservationService
            });
            res.json(ownershipInfos);
        } catch (error) {
            next(error);
        }
    }
);

export default reservationsRouter;
