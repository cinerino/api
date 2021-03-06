/**
 * 自分のクレジットカードルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../../../middlewares/permitScopes';
import rateLimit from '../../../../middlewares/rateLimit';
import validator from '../../../../middlewares/validator';

function checkUseMyCreditCards(project: cinerino.factory.project.IProject) {
    if (project.settings?.useMyCreditCards !== true) {
        throw new cinerino.factory.errors.Forbidden('my credit cards service unavailable');
    }
}

const creditCardsRouter = Router();

/**
 * 会員クレジットカード追加
 */
creditCardsRouter.post(
    '',
    permitScopes(['people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });

            checkUseMyCreditCards(project);

            const credentials = await cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
                project: { id: req.project.id },
                paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
            });

            const useUsernameAsGMOMemberId = project.settings?.useUsernameAsGMOMemberId === true;
            const memberId = (useUsernameAsGMOMemberId) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: credentials.siteId,
                sitePass: credentials.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
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
    permitScopes(['people.me.*']),
    rateLimit,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });

            checkUseMyCreditCards(project);

            const credentials = await cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
                project: { id: req.project.id },
                paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
            });

            const useUsernameAsGMOMemberId = project.settings?.useUsernameAsGMOMemberId === true;
            const memberId = (useUsernameAsGMOMemberId) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: credentials.siteId,
                sitePass: credentials.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
            });
            const searchCardResults = await creditCardRepo.search({ personId: memberId });

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
    permitScopes(['people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });

            checkUseMyCreditCards(project);

            const credentials = await cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
                project: { id: req.project.id },
                paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
            });

            const useUsernameAsGMOMemberId = project.settings?.useUsernameAsGMOMemberId === true;
            const memberId = (useUsernameAsGMOMemberId) ? <string>req.user.username : req.user.sub;
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: credentials.siteId,
                sitePass: credentials.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
            });
            await creditCardRepo.deleteBySequenceNumber({
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
