/**
 * 自分の口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { CREATED, NO_CONTENT } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

import * as redis from '../../../../redis';

const accountsRouter = Router();
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

/**
 * 口座開設
 */
accountsRouter.post(
    '/:accountType',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts']),
    (req, _, next) => {
        req.checkBody('name', 'invalid name').notEmpty().withMessage('name is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const ownershipInfo = await cinerino.service.account.open({
                agent: req.agent,
                name: req.body.name,
                accountType: req.params.accountType
            })({
                ownershipInfo: ownershipInfoRepo,
                accountNumber: accountNumberRepo,
                accountService: accountService
            });
            res.status(CREATED).json(ownershipInfo);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
 */
accountsRouter.put(
    '/:accountType/:accountNumber/close',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts']),
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            await cinerino.service.account.close({
                personId: req.user.sub,
                accountType: req.params.accountType,
                accountNumber: req.params.accountNumber
            })({
                ownershipInfo: ownershipInfoRepo,
                accountService: accountService
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座検索
 */
accountsRouter.get(
    '/:accountType',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const ownershipInfos = await cinerino.service.account.search({
                personId: req.user.sub,
                accountType: req.params.accountType,
                accountNumber: req.params.accountNumber,
                ownedAt: new Date()
            })({
                ownershipInfo: ownershipInfoRepo,
                accountService: accountService
            });
            res.json(ownershipInfos);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 口座取引履歴検索
 */
accountsRouter.get(
    '/:accountType/:accountNumber/actions/moneyTransfer',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts.actions.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const actions = await cinerino.service.account.searchMoneyTransferActions({
                personId: req.user.sub,
                accountType: req.params.accountType,
                accountNumber: req.params.accountNumber,
                ownedAt: new Date()
            })({
                ownershipInfo: ownershipInfoRepo,
                accountService: accountService
            });
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

export default accountsRouter;
