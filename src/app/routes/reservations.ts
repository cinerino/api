/**
 * 予約ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as jwt from 'jsonwebtoken';

// import authentication from '../middlewares/authentication';
// import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const reservationsRouter = Router();
// reservationsRouter.use(authentication);

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

/**
 * トークンで予約照会
 */
reservationsRouter.post(
    '/eventReservation/screeningEvent/findByToken',
    // permitScopes(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']),
    (req, _, next) => {
        req.checkBody('token', 'invalid token').notEmpty().withMessage('token is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const token = req.body.token;
            const payload = await new Promise<any>((resolve, reject) => {
                jwt.verify(
                    token,
                    <string>process.env.TOKEN_SECRET,
                    {},
                    (err, decoded) => {
                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            resolve(decoded);
                        }
                    });
            });
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const ownershipInfo = await ownershipInfoRepo.search({
                goodType: cinerino.factory.chevre.reservationType.EventReservation,
                identifier: payload.identifier
            }).then((infos) => {
                if (infos.length === 0) {
                    throw new cinerino.factory.errors.NotFound('OwnershipInfo');
                }

                return infos[0];
            });
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const reservations = await reservationService.searchScreeningEventReservations({
                ids: [ownershipInfo.typeOfGood.id]
            });
            res.json({ ...ownershipInfo, typeOfGood: reservations[0] });
        } catch (error) {
            next(error);
        }
    }
);

export default reservationsRouter;
