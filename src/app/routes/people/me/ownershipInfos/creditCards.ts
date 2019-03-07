/**
 * 自分のクレジットカードルーター
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';

import permitScopes from '../../../../middlewares/permitScopes';
import validator from '../../../../middlewares/validator';

/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';

const creditCardsRouter = Router();

const debug = createDebug('cinerino-api:router');

/**
 * 会員クレジットカード追加
 */
creditCardsRouter.post(
    '',
    permitScopes(['aws.cognito.signin.user.admin']),
    validator,
    async (req, res, next) => {
        try {
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCard = await cinerino.service.person.creditCard.save(memberId, req.body)();
            res.status(CREATED)
                .json(creditCard);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員クレジットカード検索
 */
creditCardsRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin']),
    async (req, res, next) => {
        try {
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const searchCardResults = await cinerino.service.person.creditCard.find(memberId)();
            debug('searchCardResults:', searchCardResults);
            res.json(searchCardResults);
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
    permitScopes(['aws.cognito.signin.user.admin']),
    validator,
    async (req, res, next) => {
        try {
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            await cinerino.service.person.creditCard.unsubscribe(memberId, req.params.cardSeq)();
            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default creditCardsRouter;
