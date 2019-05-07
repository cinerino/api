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
    permitScopes(['customer']),
    validator,
    async (req, res, next) => {
        try {
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: <string>process.env.GMO_SITE_ID,
                sitePass: <string>process.env.GMO_SITE_PASS,
                cardService: new cinerino.GMO.service.Card({ endpoint: <string>process.env.GMO_ENDPOINT })
            });
            const creditCard = await creditCardRepo.save({
                personId: memberId,
                creditCard: req.body
            });

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
    permitScopes(['customer']),
    async (req, res, next) => {
        try {
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: <string>process.env.GMO_SITE_ID,
                sitePass: <string>process.env.GMO_SITE_PASS,
                cardService: new cinerino.GMO.service.Card({ endpoint: <string>process.env.GMO_ENDPOINT })
            });
            const searchCardResults = await creditCardRepo.search({ personId: memberId });
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
    permitScopes(['customer']),
    validator,
    async (req, res, next) => {
        try {
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: <string>process.env.GMO_SITE_ID,
                sitePass: <string>process.env.GMO_SITE_PASS,
                cardService: new cinerino.GMO.service.Card({ endpoint: <string>process.env.GMO_ENDPOINT })
            });
            await creditCardRepo.remove({
                personId: memberId,
                cardSeq: req.params.cardSeq
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default creditCardsRouter;
