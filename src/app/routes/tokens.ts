/**
 * トークンルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

export const TOKEN_EXPIRES_IN = 1800;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const tokensRouter = Router();

/**
 * コードからトークンを発行する
 */
tokensRouter.post(
    '',
    permitScopes(['tokens']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const token = await cinerino.service.code.getToken({
                project: req.project,
                code: req.body.code,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                expiresIn: TOKEN_EXPIRES_IN
            })({
                authorization: new cinerino.chevre.service.Authorization({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                })
            });

            res.json({ token });
        } catch (error) {
            next(error);
        }
    }
);

export default tokensRouter;
