/**
 * 所有権ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

import * as redis from '../../redis';

const ownershipInfosRouter = Router();
ownershipInfosRouter.use(authentication);

/**
 * コードから所有権に対するアクセストークンを発行する
 */
ownershipInfosRouter.post(
    '/tokens',
    permitScopes(['aws.cognito.signin.user.admin', 'tokens']),
    validator,
    async (req, res, next) => {
        try {
            const codeRepo = new cinerino.repository.Code(redis.getClient());
            const token = await cinerino.service.code.getToken({
                code: req.body.code,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                // tslint:disable-next-line:no-magic-numbers
                expiresIn: 1800
            })({ code: codeRepo });
            res.json({ token });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 所有権に対するトークン検証アクションを検索する
 */
ownershipInfosRouter.get(
    '/:id/actions/checkToken',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
            const actions = await actionRepo.actionModel.find(
                {
                    typeOf: cinerino.factory.actionType.CheckAction,
                    'result.typeOf': 'OwnershipInfo',
                    'result.id': req.params.id
                },
                {
                    __v: 0,
                    createdAt: 0,
                    updatedAt: 0
                }
            ).exec().then((docs) => docs.map((doc) => doc.toObject()));
            res.set('X-Total-Count', actions.length.toString());
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

export default ownershipInfosRouter;
