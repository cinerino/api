/**
 * 自分のクレジットカードルーター
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

const creditCardsRouter = Router();

const debug = createDebug('cinerino-api:router');

/**
 * 会員クレジットカード検索
 */
creditCardsRouter.get(
    '/',
    permitScopes(['aws.cognito.signin.user.admin', 'people.creditCards', 'people.creditCards.read-only']),
    async (req, res, next) => {
        try {
            const searchCardResults = await cinerino.service.person.creditCard.find(req.user.sub)();
            debug('searchCardResults:', searchCardResults);
            res.json(searchCardResults);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員クレジットカード追加
 */
creditCardsRouter.post(
    '/',
    permitScopes(['aws.cognito.signin.user.admin', 'people.creditCards']),
    (__1, __2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const creditCard = await cinerino.service.person.creditCard.save(req.user.sub, req.body)();
            res.status(CREATED).json(creditCard);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員クレジットカード削除
 */
creditCardsRouter.delete(
    '/:cardSeq',
    permitScopes(['aws.cognito.signin.user.admin', 'people.creditCards']),
    validator,
    async (req, res, next) => {
        try {
            await cinerino.service.person.creditCard.unsubscribe(req.user.sub, req.params.cardSeq)();
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);

export default creditCardsRouter;
