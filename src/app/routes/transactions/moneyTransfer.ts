/**
 * 通貨転送取引ルーター
 */
import * as cinerino from '@cinerino/domain';

import * as createDebug from 'debug';
import { Request, Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, query } from 'express-validator';
import { NO_CONTENT } from 'http-status';
import * as moment from 'moment-timezone';
import * as mongoose from 'mongoose';

import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import { createPassportValidator, validateWaiterPassport } from '../../middlewares/validateWaiterPassport';
import validator from '../../middlewares/validator';

import * as redis from '../../../redis';

// 注文→ペイメントカードの振替が有効な注文日時from
const USE_ORDER2PAYMENTCARD_FROM = process.env.USE_ORDER2PAYMENTCARD_FROM;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

const moneyTransferTransactionsRouter = Router();
const debug = createDebug('cinerino-api:router');

// tslint:disable-next-line:use-default-type-parameter
moneyTransferTransactionsRouter.post<ParamsDictionary>(
    '/start',
    permitScopes(['transactions']),
    ...[
        body('expires', 'invalid expires')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isISO8601()
            .toDate(),
        body('object.amount.value')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isInt()
            .toInt(),
        body('object.fromLocation.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('object.toLocation.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('object.toLocation.identifier')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('agent.identifier')
            .optional()
            .isArray({ max: 10 }),
        body('agent.identifier.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('agent.identifier.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('recipient.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('seller.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
    ],
    validator,
    validateWaiterPassport,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const sellerService = new cinerino.chevre.service.Seller({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const seller = await sellerService.findById({ id: <string>req.body.seller.id });

            const passportValidator = createPassportValidator({
                transaction: { typeOf: cinerino.factory.transactionType.MoneyTransfer },
                seller,
                clientId: req.user.client_id
            });

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const { fromLocation, pendingTransactionIdentifier } = await validateFromLocation(req);

            // ペイメントカードプロダクトを検索して、currencyを自動取得
            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });
            const searchProductsResult = await productService.search({
                limit: 1,
                project: { id: { $eq: req.project.id } },
                typeOf: { $eq: cinerino.factory.product.ProductType.PaymentCard },
                serviceOutput: { typeOf: { $eq: fromLocation.typeOf } }
            });
            const product = <cinerino.factory.product.IProduct | undefined>searchProductsResult.data.shift();
            if (product === undefined) {
                throw new cinerino.factory.errors.NotFound('Product');
            }
            const currency = product.serviceOutput?.amount?.currency;
            if (typeof currency !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('currency settings undefined for the product');
            }

            const transaction = await cinerino.service.transaction.moneyTransfer.start({
                project: req.project,
                expires: req.body.expires,
                agent: {
                    ...req.agent,
                    ...(req.body.agent !== undefined && req.body.agent.name !== undefined) ? { name: req.body.agent.name } : {},
                    identifier: [
                        ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                            ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                return { name: String(p.name), value: String(p.value) };
                            })
                            : []
                    ]
                },
                object: {
                    amount: {
                        typeOf: 'MonetaryAmount',
                        value: req.body.object?.amount?.value,
                        currency
                    },
                    fromLocation: fromLocation,
                    toLocation: req.body.object.toLocation,
                    ...(typeof req.waiterPassport?.token === 'string') ? { passport: req.waiterPassport } : undefined,
                    ...(typeof req.body.object.description === 'string') ? { description: req.body.object.description } : undefined,
                    ...(typeof pendingTransactionIdentifier === 'string')
                        ? { pendingTransaction: { identifier: pendingTransactionIdentifier } }
                        : undefined
                },
                recipient: {
                    project: req.project,
                    typeOf: req.body.recipient.typeOf,
                    ...(typeof req.body.recipient?.id === 'string') ? { id: req.body.recipient.id } : undefined,
                    ...(typeof req.body.recipient?.name === 'string') ? { name: req.body.recipient.name } : undefined,
                    ...(typeof req.body.recipient?.url === 'string') ? { url: req.body.recipient.url } : undefined
                },
                seller: req.body.seller,
                passportValidator
            })({
                action: actionRepo,
                seller: sellerService,
                transaction: transactionRepo,
                depositTransaction: new cinerino.chevre.service.accountTransaction.Deposit({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                }),
                transferTransaction: new cinerino.chevre.service.accountTransaction.Transfer({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                }),
                withdrawTransaction: new cinerino.chevre.service.accountTransaction.Withdraw({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                })
            });

            res.json(transaction);
        } catch (error) {
            next(error);
        }
    }
);

// tslint:disable-next-line:max-func-body-length
async function validateFromLocation(req: Request): Promise<{
    fromLocation: cinerino.factory.transaction.moneyTransfer.IFromLocation;
    pendingTransactionIdentifier: string | undefined;
}> {
    let fromLocation = <cinerino.factory.transaction.moneyTransfer.IFromLocationBeforeStart>req.body.object.fromLocation;
    let pendingTransactionIdentifier: string | undefined;

    // トークン化されたペイメントカード情報でリクエストされた場合、実ペイメントカード情報へ変換する
    if (typeof fromLocation === 'string') {
        throw new cinerino.factory.errors.NotImplemented('tokenized from location not implemented');
        // tslint:disable-next-line:max-line-length
        // type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>;
        // const accountOwnershipInfo = await cinerino.service.code.verifyToken<IPayload>({
        //     project: req.project,
        //     agent: req.agent,
        //     token: fromLocation,
        //     secret: <string>process.env.TOKEN_SECRET,
        //     issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER
        // })({ action: new cinerino.repository.Action(mongoose.connection) });

        // fromLocation = accountOwnershipInfo.typeOfGood;
    } else {
        // fromLocationが注文の場合に対応
        if (fromLocation.typeOf === cinerino.factory.order.OrderType.Order) {
            fromLocation = <cinerino.factory.transaction.moneyTransfer.IOrderAsFromLocation>fromLocation;

            // 注文検索
            const orderService = new cinerino.chevre.service.Order({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const searchOrdersResult = await orderService.search({
                limit: 1,
                project: { id: { $eq: req.project.id } },
                orderNumbers: [String(fromLocation.orderNumber)],
                confirmationNumbers: [String(fromLocation.confirmationNumber)]
            });
            const order = searchOrdersResult.data.shift();
            if (order === undefined) {
                throw new cinerino.factory.errors.NotFound('Order');
            }

            // 振替が有効な注文日時設定があれば確認
            if (typeof USE_ORDER2PAYMENTCARD_FROM === 'string' && USE_ORDER2PAYMENTCARD_FROM.length > 0) {
                const isEligibleOrder = moment(order.orderDate)
                    .isSameOrAfter(moment(USE_ORDER2PAYMENTCARD_FROM));
                if (!isEligibleOrder) {
                    throw new cinerino.factory.errors.NotFound('Eligible Order');
                }
            }

            let awardAccounts: cinerino.service.transaction.placeOrderInProgress.IAwardAccount[] = [];
            const awardAccounsValue = order.identifier?.find(
                (i) => i.name === cinerino.service.transaction.placeOrderInProgress.AWARD_ACCOUNTS_IDENTIFIER_NAME
            )?.value;
            if (typeof awardAccounsValue === 'string' && awardAccounsValue.length > 0) {
                awardAccounts = JSON.parse(awardAccounsValue);
            }

            // 口座種別はtoLocationに合わせる
            const locationTypeOf = req.body.object.toLocation.typeOf;

            const awardAccount = awardAccounts.find((a) => a.typeOf === locationTypeOf);
            if (awardAccount === undefined) {
                throw new cinerino.factory.errors.NotFound('award account');
            }
            fromLocation = { typeOf: awardAccount.typeOf, identifier: awardAccount.accountNumber };

            // ユニークネスを保証するために識別子を指定する
            pendingTransactionIdentifier = cinerino.service.delivery.createPointAwardIdentifier({
                project: { id: req.project.id },
                purpose: { orderNumber: order.orderNumber },
                toLocation: { accountNumber: req.body.object.toLocation.identifier }
            });
            // identifier: identifier,
        } else {
            fromLocation = <cinerino.factory.action.interact.confirm.moneyTransfer.IPaymentCard>fromLocation;

            const accessCode = fromLocation.accessCode;
            if (typeof accessCode === 'string') {
                throw new cinerino.factory.errors.NotImplemented('owned payment card not implemented');
                // アクセスコード情報があれば、認証
                // const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                //     endpoint: cinerino.credentials.chevre.endpoint,
                //     auth: chevreAuthClient
                // });
                // const searchPaymentCardResult = await serviceOutputService.search({
                //     limit: 1,
                //     page: 1,
                //     project: { typeOf: req.project.typeOf, id: req.project.id },
                //     typeOf: { $eq: fromLocation?.typeOf },
                //     identifier: { $eq: fromLocation?.identifier },
                //     accessCode: { $eq: accessCode }
                // });
                // if (searchPaymentCardResult.data.length === 0) {
                //     throw new cinerino.factory.errors.NotFound('PaymentCard');
                // }
                // const paymetCard = searchPaymentCardResult.data.shift();
                // fromLocation = {
                //     typeOf: paymetCard.typeOf,
                //     identifier: paymetCard.identifier
                // };
            } else {
                throw new cinerino.factory.errors.NotImplemented('owned payment card not implemented');
                // アクセスコード情報なし、かつ、会員の場合、所有権を確認
                // ペイメントカードに所有権があるかどうか確認
                // const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
                // const count = await ownershipInfoRepo.count<cinerino.factory.ownershipInfo.AccountGoodType.Account>({
                //     limit: 1,
                //     ownedBy: { id: req.user.sub },
                //     ownedFrom: new Date(),
                //     ownedThrough: new Date(),
                //     typeOfGood: {
                //         typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                //         accountType: fromLocation.accountType,
                //         accountNumber: fromLocation.accountNumber
                //     }
                // });
                // if (count === 0) {
                //     throw new cinerino.factory.errors.Forbidden('From Account access forbidden');
                // }
            }
        }
    }

    return { fromLocation, pendingTransactionIdentifier };
}

/**
 * 取引人プロフィール変更
 */
// tslint:disable-next-line:use-default-type-parameter
moneyTransferTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/agent',
    permitScopes(['transactions']),
    ...[
        body('additionalProperty')
            .optional()
            .isArray({ max: 10 }),
        body('additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.updateAgent({
                typeOf: cinerino.factory.transactionType.MoneyTransfer,
                id: req.params.transactionId,
                agent: {
                    ...req.body,
                    typeOf: cinerino.factory.personType.Person,
                    id: req.user.sub
                }
            })({
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

moneyTransferTransactionsRouter.put(
    '/:transactionId/confirm',
    permitScopes(['transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            await cinerino.service.transaction.moneyTransfer.confirm({
                id: req.params.transactionId
            })({
                action: actionRepo,
                transaction: transactionRepo
            });
            debug('transaction confirmed');

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Confirmed,
                typeOf: { $in: [cinerino.factory.transactionType.MoneyTransfer] }
            })({
                task: taskRepo,
                transaction: transactionRepo
            })
                .then(async (tasks) => {
                    // タスクがあればすべて実行
                    if (Array.isArray(tasks)) {
                        await Promise.all(tasks.map(async (task) => {
                            await cinerino.service.task.executeByName(task)({
                                connection: mongoose.connection,
                                redisClient: redis.getClient(),
                                chevreAuthClient
                            });
                        }));
                    }
                });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引を明示的に中止
 */
moneyTransferTransactionsRouter.put(
    '/:transactionId/cancel',
    permitScopes(['transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.MoneyTransfer,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.MoneyTransfer,
                id: req.params.transactionId
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Canceled,
                typeOf: { $in: [cinerino.factory.transactionType.MoneyTransfer] }
            })({
                task: taskRepo,
                transaction: transactionRepo
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引検索
 */
moneyTransferTransactionsRouter.get(
    '',
    permitScopes(['transactions.*', 'transactions.read']),
    rateLimit,
    ...[
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('endFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('endThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const searchConditions: cinerino.factory.transaction.moneyTransfer.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: cinerino.factory.transactionType.MoneyTransfer
            };
            const transactions = await transactionRepo.search(searchConditions);

            res.json(transactions);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引に対するアクション検索
 */
moneyTransferTransactionsRouter.get(
    '/:transactionId/actions',
    permitScopes(['transactions.*', 'transactions.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const actions = await actionRepo.searchByPurpose({
                purpose: {
                    typeOf: cinerino.factory.transactionType.MoneyTransfer,
                    id: req.params.transactionId
                },
                sort: req.query.sort
            });
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

export default moneyTransferTransactionsRouter;
