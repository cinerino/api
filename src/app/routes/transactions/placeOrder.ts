/**
 * 注文取引ルーター
 */
import * as cinerino from '@cinerino/domain';
// import * as createDebug from 'debug';
import { Request, Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, query } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import lockTransaction from '../../middlewares/lockTransaction';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import { createPassportValidator, validateWaiterPassport } from '../../middlewares/validateWaiterPassport';
import validator from '../../middlewares/validator';

import placeOrder4cinemasunshineRouter from './placeOrder4cinemasunshine';

import { connectMongo } from '../../../connectMongo';
import * as redis from '../../../redis';

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

const NUM_ORDER_ITEMS_MAX_VALUE = (process.env.NUM_ORDER_ITEMS_MAX_VALUE !== undefined)
    ? Number(process.env.NUM_ORDER_ITEMS_MAX_VALUE)
    // tslint:disable-next-line:no-magic-numbers
    : 50;

const DEFAULT_ORDER_NAME = process.env.DEFAULT_ORDER_NAME;

const placeOrderTransactionsRouter = Router();
// const debug = createDebug('cinerino-api:router');

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

// Cinemasunshine対応
placeOrderTransactionsRouter.use(placeOrder4cinemasunshineRouter);

// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/start',
    permitScopes(['transactions']),
    // Cinemasunshine互換性維持のため
    (req, _, next) => {
        if (typeof req.body.sellerId === 'string') {
            req.body.seller = { id: req.body.sellerId };
        }

        if (typeof req.body.passportToken === 'string') {
            req.body.object = {
                passport: { token: req.body.passportToken }
            };
        }

        next();
    },
    ...[
        body('expires')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isISO8601()
            .toDate(),
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
        body('seller.id')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')

    ],
    validator,
    validateWaiterPassport,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const startParams = await createStartParams(req)({ project: projectRepo });

            const transaction = await cinerino.service.transaction.placeOrderInProgress.start(startParams)({
                project: projectRepo,
                transaction: transactionRepo
            });

            // tslint:disable-next-line:no-string-literal
            // const host = req.headers['host'];
            // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
            res.json(transaction);
        } catch (error) {
            next(error);
        }
    }
);

function createStartParams(req: Request) {
    return async (repos: {
        project: cinerino.repository.Project;
    }): Promise<cinerino.service.transaction.placeOrderInProgress.IStartParams> => {
        const expires: Date = req.body.expires;

        const sellerService = new cinerino.chevre.service.Seller({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const seller = await sellerService.findById({ id: <string>req.body.seller.id });

        const passportValidator = createPassportValidator({
            transaction: { typeOf: cinerino.factory.transactionType.PlaceOrder },
            seller,
            clientId: req.user.client_id
        });

        const project = await repos.project.findById({ id: req.project.id });
        const useTransactionClientUser = project.settings?.useTransactionClientUser === true;

        const orderName: string | undefined = (typeof req.body.object?.name === 'string') ? req.body.object?.name : DEFAULT_ORDER_NAME;

        const broker: cinerino.factory.order.IBroker | undefined = (req.isAdmin) ? req.agent : undefined;

        const agent: cinerino.factory.transaction.placeOrder.IAgent = {
            ...req.agent,
            identifier: [
                ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                ...(Array.isArray(req.body.agent?.identifier))
                    ? (<any[]>req.body.agent.identifier).map((p: any) => {
                        return { name: String(p.name), value: String(p.value) };
                    })
                    : []
            ]
        };

        // object.customerを指定
        let customer: cinerino.factory.order.ICustomer = {
            id: req.agent.id,
            typeOf: req.agent.typeOf
        };
        // 管理者がbrokerとして注文する場合、customerはWebApplicationとする
        if (broker !== undefined) {
            customer = {
                id: req.user.client_id,
                typeOf: <any>cinerino.factory.chevre.creativeWorkType.WebApplication
            };
        }
        if (Array.isArray(agent.identifier)) {
            customer.identifier = agent.identifier;
        }
        if (typeof agent.memberOf?.typeOf === 'string') {
            customer.memberOf = agent.memberOf;
        }

        // customerの指定があれば、存在確認の上で上書き
        // const customerTypeOfByRequest = req.body.object?.customer?.typeOf;
        const customerIdByRequest = req.body.object?.customer?.id;
        if (typeof customerIdByRequest === 'string' && customerIdByRequest.length > 0) {
            const customerService = new cinerino.chevre.service.Customer({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const customerFromChevre = await customerService.findById({ id: customerIdByRequest });
            if (customerFromChevre.project?.id !== req.project.id) {
                throw new cinerino.factory.errors.NotFound('Customer');
            }
            customer.typeOf = customerFromChevre.typeOf;
            customer.id = customerFromChevre.id;
        }

        return {
            project: req.project,
            expires: expires,
            agent: agent,
            seller: req.body.seller,
            object: {
                ...(typeof req.waiterPassport?.token === 'string') ? { passport: req.waiterPassport } : undefined,
                ...(useTransactionClientUser) ? { clientUser: req.user } : undefined,
                ...(typeof orderName === 'string') ? { name: orderName } : undefined,
                customer
            },
            passportValidator,
            ...(broker !== undefined) ? { broker } : undefined
        };
    };
}

/**
 * カスタマー変更
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
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
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.updateAgent({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
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

/**
 * 座席仮予約
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/offer/seatReservation',
    permitScopes(['transactions']),
    ...[
        body('object.acceptedOffer.additionalProperty')
            .optional()
            .isArray({ max: 10 }),
        body('object.acceptedOffer.additionalProperty.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('object.acceptedOffer.additionalProperty.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const action = await cinerino.service.offer.seatReservation.create({
                project: req.project,
                object: {
                    ...req.body,
                    broker: (req.isAdmin) ? req.agent : undefined
                },
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: projectRepo,
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 座席仮予約取消
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/offer/seatReservation/:actionId/cancel',
    permitScopes(['transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.offer.seatReservation.cancel({
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                project: new cinerino.repository.Project(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * インセンティブ承認アクション
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/actions/authorize/award/accounts/point',
    permitScopes(['transactions']),
    ...[],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const givePointAwardParams = await authorizePointAward(req);

            // 特典注文口座番号発行
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            await cinerino.service.transaction.placeOrderInProgress.publishAwardAccountNumberIfNotExist({
                id: req.params.transactionId,
                object: {
                    awardAccounts: givePointAwardParams
                        .filter((p) => typeof p.object?.toLocation.typeOf === 'string')
                        .map((p) => {
                            return { typeOf: <string>p.object?.toLocation.typeOf };
                        })
                }
            })({ transaction: transactionRepo });

            res.status(CREATED)
                .json({
                    id: 'dummy',
                    purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
                });
        } catch (error) {
            next(error);
        }
    }
);

// tslint:disable-next-line:max-func-body-length
export async function authorizePointAward(req: Request): Promise<cinerino.factory.transaction.placeOrder.IGivePointAwardParams[]> {
    const now = new Date();
    const notes = req.body.notes;

    const actionRepo = new cinerino.repository.Action(mongoose.connection);
    const projectRepo = new cinerino.repository.Project(mongoose.connection);
    const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

    const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
        endpoint: cinerino.credentials.chevre.endpoint,
        auth: chevreAuthClient
    });
    const productService = new cinerino.chevre.service.Product({
        endpoint: cinerino.credentials.chevre.endpoint,
        auth: chevreAuthClient
    });

    // 所有メンバーシップを検索
    const searchOwnershipInfosResult = await ownershipInfoService.search({
        project: { id: { $eq: req.project.id } },
        typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
        ownedBy: { id: req.agent.id },
        ownedFrom: now,
        ownedThrough: now
    });
    const programMembershipOwnershipInfos = searchOwnershipInfosResult.data;

    const programMemberships = programMembershipOwnershipInfos.map((o) => o.typeOfGood);
    const givePointAwardParams: cinerino.factory.transaction.placeOrder.IGivePointAwardParams[] = [];

    if (programMemberships.length > 0) {
        for (const programMembership of programMemberships) {
            const membershipServiceId = <string>(<any>programMembership).membershipFor?.id;
            const membershipService = await productService.findById({ id: membershipServiceId });

            // 登録時の獲得ポイント
            const membershipServiceOutput = membershipService.serviceOutput;

            if (membershipServiceOutput !== undefined) {
                const membershipPointsEarnedName = (<any>membershipServiceOutput).membershipPointsEarned?.name;
                const membershipPointsEarnedValue = (<any>membershipServiceOutput).membershipPointsEarned?.value;
                const membershipPointsEarnedUnitText = (<any>membershipServiceOutput).membershipPointsEarned?.unitText;

                if (typeof membershipPointsEarnedValue === 'number' && typeof membershipPointsEarnedUnitText === 'string') {
                    const toAccount = await cinerino.service.account.findAccount({
                        customer: { id: req.agent.id },
                        project: { id: req.project.id },
                        now: now,
                        accountType: membershipPointsEarnedUnitText
                    })({ project: projectRepo, ownershipInfo: ownershipInfoService });

                    givePointAwardParams.push({
                        object: {
                            typeOf: cinerino.factory.action.authorize.award.point.ObjectType.PointAward,
                            amount: membershipPointsEarnedValue,
                            toLocation: {
                                typeOf: toAccount.typeOf,
                                accountType: toAccount.accountType,
                                accountNumber: toAccount.accountNumber
                            },
                            description: (typeof notes === 'string') ? notes : String(membershipPointsEarnedName)
                        }
                    });
                }
            }
        }

        await cinerino.service.transaction.placeOrderInProgress.authorizeAward({
            transaction: { id: req.params.transactionId },
            agent: { id: req.agent.id },
            object: {
                potentialActions: {
                    givePointAwardParams: givePointAwardParams
                }
            }
        })({
            action: actionRepo,
            transaction: transactionRepo
        });
    }

    return givePointAwardParams;
}

/**
 * インセンティブ承認アクション取消
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/actions/authorize/award/accounts/point/:actionId/cancel',
    permitScopes(['transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.voidAward({
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/confirm',
    permitScopes(['transactions']),
    ...[
        // Eメールカスタマイズのバリデーション
        body([
            'emailTemplate',
            'email.about',
            'email.template',
            'email.sender.email',
            'email.toRecipient.email',
            'options.email.about',
            'options.email.template',
            'options.email.sender.email',
            'options.email.toRecipient.email'
        ])
            .optional()
            .not()
            .isEmpty()
            .withMessage((_, options) => `${options.path} must not be empty`)
            .isString()
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const orderDate = new Date();

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            const sendEmailMessage = req.body.sendEmailMessage === true;
            let email: cinerino.factory.creativeWork.message.email.ICustomization | undefined = req.body.email;

            // 互換性維持のため、テンプレートオプションを変換
            if (req.body.emailTemplate !== undefined) {
                if (email === undefined) {
                    email = {};
                }
                email.template = String(req.body.emailTemplate);
            }

            const potentialActions: cinerino.factory.transaction.placeOrder.IPotentialActionsParams | undefined = {
                ...req.body.potentialActions,
                order: {
                    ...req.body.potentialActions?.order,
                    potentialActions: {
                        ...req.body.potentialActions?.order?.potentialActions,
                        sendOrder: {
                            ...req.body.potentialActions?.order?.potentialActions?.sendOrder,
                            potentialActions: {
                                ...req.body.potentialActions?.order?.potentialActions?.sendOrder?.potentialActions,
                                sendEmailMessage: [
                                    // tslint:disable-next-line:max-line-length
                                    ...(Array.isArray(req.body.potentialActions?.order?.potentialActions?.sendOrder?.potentialActions?.sendEmailMessage))
                                        // tslint:disable-next-line:max-line-length
                                        ? req.body.potentialActions?.order?.potentialActions?.sendOrder?.potentialActions?.sendEmailMessage
                                        : [],
                                    ...(sendEmailMessage) ? [{ object: email }] : []
                                ]

                            }

                        }
                    }
                }
            };

            const resultOrderParams: cinerino.service.transaction.placeOrderInProgress.IResultOrderParams = {
                ...req.body.result?.order,
                confirmationNumber: undefined,
                orderDate: orderDate,
                numItems: {
                    maxValue: NUM_ORDER_ITEMS_MAX_VALUE
                    // minValue: 0
                }
            };

            const result = await cinerino.service.transaction.placeOrderInProgress.confirm({
                ...req.body,
                agent: { id: req.user.sub },
                id: req.params.transactionId,
                potentialActions: potentialActions,
                project: req.project,
                result: {
                    ...req.body.result,
                    order: resultOrderParams
                }
            })({
                action: actionRepo,
                project: projectRepo,
                transaction: transactionRepo,
                confirmationNumber: confirmationNumberRepo,
                orderNumber: orderNumberRepo
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Confirmed,
                typeOf: { $in: [cinerino.factory.transactionType.PlaceOrder] }
            })({
                project: projectRepo,
                task: taskRepo,
                transaction: transactionRepo
            })
                .then(async (tasks) => {
                    // タスクがあればすべて実行
                    if (Array.isArray(tasks)) {
                        await Promise.all(tasks.map(async (task) => {
                            await cinerino.service.task.executeByName(task)({
                                connection: mongoose.connection,
                                redisClient: redis.getClient()
                            });
                        }));
                    }
                });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 取引を明示的に中止
 */
placeOrderTransactionsRouter.put(
    '/:transactionId/cancel',
    permitScopes(['transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        await lockTransaction({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            await transactionRepo.cancel({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: req.params.transactionId
            });

            // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
            // tslint:disable-next-line:no-floating-promises
            cinerino.service.transaction.exportTasks({
                project: req.project,
                status: cinerino.factory.transactionStatusType.Canceled,
                typeOf: { $in: [cinerino.factory.transactionType.PlaceOrder] }
            })({
                project: projectRepo,
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
placeOrderTransactionsRouter.get(
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
            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.PlaceOrder> = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                typeOf: cinerino.factory.transactionType.PlaceOrder
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
placeOrderTransactionsRouter.get(
    '/:transactionId/actions',
    permitScopes(['transactions.*', 'transactions.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const actions = await actionRepo.searchByPurpose({
                purpose: {
                    typeOf: cinerino.factory.transactionType.PlaceOrder,
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

/**
 * 取引レポート
 */
placeOrderTransactionsRouter.get(
    '/report',
    permitScopes([]),
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
        let connection: mongoose.Connection | undefined;

        try {
            connection = await connectMongo({
                defaultConnection: false,
                disableCheck: true
            });
            const transactionRepo = new cinerino.repository.Transaction(connection);

            const searchConditions: cinerino.factory.transaction.ISearchConditions<cinerino.factory.transactionType.PlaceOrder> = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: undefined,
                page: undefined,
                typeOf: cinerino.factory.transactionType.PlaceOrder
            };

            const format = req.query.format;

            const stream = await cinerino.service.report.transaction.stream({
                conditions: searchConditions,
                format: format
            })({ transaction: transactionRepo });

            res.type(`${req.query.format}; charset=utf-8`);
            stream.pipe(res)
                .on('error', async () => {
                    if (connection !== undefined) {
                        await connection.close();
                    }
                })
                .on('finish', async () => {
                    if (connection !== undefined) {
                        await connection.close();
                    }
                });
        } catch (error) {
            if (connection !== undefined) {
                await connection.close();
            }

            next(error);
        }
    }
);

export default placeOrderTransactionsRouter;
