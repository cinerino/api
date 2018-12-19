/**
 * 決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { CREATED } from 'http-status';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: <string>process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: <string>process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const paymentRouter = Router();
paymentRouter.use(authentication);
/**
 * ムビチケ購入番号確認
 */
paymentRouter.post(
    '/movieTicket/actions/check',
    permitScopes(['aws.cognito.signin.user.admin', 'tokens']),
    validator,
    async (req, res, next) => {
        try {
            const action = await cinerino.service.payment.movietTicket.checkMovieTicket({
                typeOf: cinerino.factory.actionType.CheckAction,
                agent: req.agent,
                object: req.body
            })({
                action: new cinerino.repository.Action(cinerino.mongoose.connection),
                event: new cinerino.repository.Event(cinerino.mongoose.connection),
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
                movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                    endpoint: <string>process.env.MVTK_RESERVE_ENDPOINT,
                    auth: mvtkReserveAuthClient
                }),
                paymentMethod: new cinerino.repository.PaymentMethod(cinerino.mongoose.connection)
            });
            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);
export default paymentRouter;
