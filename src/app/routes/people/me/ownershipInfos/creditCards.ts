/**
 * 自分のクレジットカードルーター
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.gmo === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: project.settings.gmo.siteId,
                sitePass: project.settings.gmo.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.gmo === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: project.settings.gmo.siteId,
                sitePass: project.settings.gmo.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.gmo === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: project.settings.gmo.siteId,
                sitePass: project.settings.gmo.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
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
