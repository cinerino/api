/**
 * トークンルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

export const TOKEN_EXPIRES_IN = 1800;

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
            const codeRepo = new cinerino.repository.Code(mongoose.connection);

            const token = await cinerino.service.code.getToken({
                project: req.project,
                code: req.body.code,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                expiresIn: TOKEN_EXPIRES_IN
            })({ code: codeRepo });

            res.json({ token });
        } catch (error) {
            next(error);
        }
    }
);

export default tokensRouter;
