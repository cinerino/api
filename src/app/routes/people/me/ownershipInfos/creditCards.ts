/**
 * 自分のクレジットカードルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';

import permitScopes from '../../../../middlewares/permitScopes';
import rateLimit from '../../../../middlewares/rateLimit';
import validator from '../../../../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

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
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });

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
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });

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
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });

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
