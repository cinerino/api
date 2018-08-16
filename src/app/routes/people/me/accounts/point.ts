/**
 * 自分のポイント口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { BAD_REQUEST, CREATED, FORBIDDEN, NO_CONTENT, NOT_FOUND, TOO_MANY_REQUESTS, UNAUTHORIZED } from 'http-status';
import * as moment from 'moment';

import authentication from '../../../../middlewares/authentication';
import permitScopes from '../../../../middlewares/permitScopes';
import requireMember from '../../../../middlewares/requireMember';
import validator from '../../../../middlewares/validator';

import * as redis from '../../../../../redis';

const pointAccountsRouter = Router();
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

pointAccountsRouter.use(authentication);
pointAccountsRouter.use(requireMember); // 自分のリソースへのアクセスなので、もちろんログイン必須

/**
 * ポイント口座開設
 */
pointAccountsRouter.post(
    '/',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts']),
    (req, _, next) => {
        req.checkBody('name', 'invalid name').notEmpty().withMessage('name is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const now = new Date();
            const accountNumberRepo = new cinerino.repository.AccountNumber(redis.getClient());
            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const account = await cinerino.service.account.open({
                name: req.body.name
            })({
                accountNumber: accountNumberRepo,
                accountService: accountService
            });
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const ownershipInfo: cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.AccountGoodType.Account>
                = {
                typeOf: 'OwnershipInfo',
                // 十分にユニーク
                // tslint:disable-next-line:max-line-length
                identifier: `${req.user.sub}-${cinerino.factory.ownershipInfo.AccountGoodType.Account}-${cinerino.factory.accountType.Point}-${account.accountNumber}`,
                typeOfGood: {
                    typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                    accountType: cinerino.factory.accountType.Point,
                    accountNumber: account.accountNumber
                },
                ownedBy: req.agent,
                ownedFrom: now,
                // tslint:disable-next-line:no-magic-numbers
                ownedThrough: moment(now).add(100, 'years').toDate() // 十分に無期限
            };
            await ownershipInfoRepo.save(ownershipInfo);
            res.status(CREATED).json(account);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ポイント口座解約
 * 口座の状態を変更するだけで、所有口座リストから削除はしない
 */
pointAccountsRouter.put(
    '/:accountNumber/close',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts']),
    validator,
    async (req, res, next) => {
        try {
            // 口座所有権を検索
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountOwnershipInfos = await ownershipInfoRepo.search({
                goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                ownedBy: req.user.sub
            });
            const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
            if (accountOwnershipInfo === undefined) {
                throw new cinerino.factory.errors.NotFound('Account');
            }

            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            await accountService.close({
                accountType: cinerino.factory.accountType.Point,
                accountNumber: accountOwnershipInfo.typeOfGood.accountNumber
            });
            res.status(NO_CONTENT).end();
        } catch (error) {
            // PecorinoAPIのレスポンスステータスコードが4xxであればクライアントエラー
            if (error.name === 'PecorinoRequestError') {
                // Pecorino APIのステータスコード4xxをハンドリング
                const message = `${error.name}:${error.message}`;
                switch (error.code) {
                    case BAD_REQUEST: // 400
                        error = new cinerino.factory.errors.Argument('accountNumber', message);
                        break;
                    case UNAUTHORIZED: // 401
                        error = new cinerino.factory.errors.Unauthorized(message);
                        break;
                    case FORBIDDEN: // 403
                        error = new cinerino.factory.errors.Forbidden(message);
                        break;
                    case NOT_FOUND: // 404
                        error = new cinerino.factory.errors.NotFound(message);
                        break;
                    case TOO_MANY_REQUESTS: // 429
                        error = new cinerino.factory.errors.RateLimitExceeded(message);
                        break;
                    default:
                        error = new cinerino.factory.errors.ServiceUnavailable(message);
                }
            }

            next(error);
        }
    }
);

/**
 * ポイント口座削除
 */
pointAccountsRouter.delete(
    '/:accountNumber',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts']),
    validator,
    async (req, res, next) => {
        try {
            const now = new Date();
            // 口座所有権を検索
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountOwnershipInfos = await ownershipInfoRepo.search({
                goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                ownedBy: req.user.sub,
                ownedAt: now
            });
            const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
            if (accountOwnershipInfo === undefined) {
                throw new cinerino.factory.errors.NotFound('Account');
            }

            // 所有期限を更新
            await ownershipInfoRepo.ownershipInfoModel.findOneAndUpdate(
                { identifier: accountOwnershipInfo.identifier },
                { ownedThrough: now }
            ).exec();
            res.status(NO_CONTENT).end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ポイント口座検索
 */
pointAccountsRouter.get(
    '',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const now = new Date();

            // 口座所有権を検索
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountOwnershipInfos = await ownershipInfoRepo.search({
                goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                ownedBy: req.user.sub,
                ownedAt: now
            });
            let accounts: cinerino.factory.pecorino.account.IAccount<cinerino.factory.accountType.Point>[] = [];
            if (accountOwnershipInfos.length > 0) {
                const accountService = new cinerino.pecorinoapi.service.Account({
                    endpoint: <string>process.env.PECORINO_ENDPOINT,
                    auth: pecorinoAuthClient
                });

                accounts = await accountService.search({
                    accountType: cinerino.factory.accountType.Point,
                    accountNumbers: accountOwnershipInfos.map((o) => o.typeOfGood.accountNumber),
                    statuses: [],
                    limit: 100
                });
            }
            res.json(accounts);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ポイント取引履歴検索
 */
pointAccountsRouter.get(
    '/:accountNumber/actions/moneyTransfer',
    permitScopes(['aws.cognito.signin.user.admin', 'people.accounts.actions.read-only']),
    validator,
    async (req, res, next) => {
        try {
            const now = new Date();
            // 口座所有権を検索
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const accountOwnershipInfos = await ownershipInfoRepo.search({
                goodType: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                ownedBy: req.user.sub,
                ownedAt: now
            });
            const accountOwnershipInfo = accountOwnershipInfos.find((o) => o.typeOfGood.accountNumber === req.params.accountNumber);
            if (accountOwnershipInfo === undefined) {
                throw new cinerino.factory.errors.NotFound('Account');
            }

            const accountService = new cinerino.pecorinoapi.service.Account({
                endpoint: <string>process.env.PECORINO_ENDPOINT,
                auth: pecorinoAuthClient
            });
            const actions = await accountService.searchMoneyTransferActions({
                accountType: cinerino.factory.accountType.Point,
                accountNumber: accountOwnershipInfo.typeOfGood.accountNumber
            });
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

export default pointAccountsRouter;
