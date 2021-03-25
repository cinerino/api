/**
 * 注文ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, CustomValidator, oneOf, query } from 'express-validator';
import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';
import { NO_CONTENT } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

import { connectMongo } from '../../connectMongo';
import * as redis from '../../redis';

const CODE_EXPIRES_IN_SECONDS_DEFAULT = (typeof process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT === 'string')
    ? Number(process.env.CODE_EXPIRES_IN_SECONDS_DEFAULT)
    // tslint:disable-next-line:no-magic-numbers
    : 600;
const CODE_EXPIRES_IN_SECONDS_MAXIMUM = (typeof process.env.CODE_EXPIRES_IN_SECONDS_MAXIMUM === 'string')
    ? Number(process.env.CODE_EXPIRES_IN_SECONDS_MAXIMUM)
    // tslint:disable-next-line:no-magic-numbers
    : 600;
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params: string) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}

type EventReservationGoodType = cinerino.factory.ownershipInfo.IReservation;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ordersRouter = Router();

/**
 * 管理者でないかどうかの判定を担うカスタムバリデータ
 */
const isNotAdmin: CustomValidator = (__, { req }) => !req.isAdmin;

/**
 * 注文検索
 */
ordersRouter.get(
    '',
    permitScopes(['orders.*', 'orders.read']),
    rateLimit,
    ...[
        query('disableTotalCount')
            .optional()
            .isBoolean()
            .toBoolean(),
        query('identifier.$all')
            .optional()
            .isArray(),
        query('identifier.$in')
            .optional()
            .isArray(),
        query('identifier.$all.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$all.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$in.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$in.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('orderDateFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDateThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDate.$gte')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDate.$lte')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.inSessionFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.inSessionThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('price.$gte')
            .optional()
            .isInt()
            .toInt(),
        query('price.$lte')
            .optional()
            .isInt()
            .toInt()
    ],
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(mongoose.connection);

            const searchConditions: cinerino.factory.order.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const orders = await orderRepo.search(searchConditions);

            res.json(orders);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 識別子で注文検索
 */
ordersRouter.get(
    '/findByIdentifier',
    permitScopes(['orders.*', 'orders.read', 'orders.findByIdentifier']),
    rateLimit,
    ...[
        query('identifier.$all')
            .optional()
            .isArray(),
        query('identifier.$in')
            .optional()
            .isArray(),
        query('identifier.$all.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$all.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$in.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$in.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$all')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isArray({ min: 2, max: 10 })
            .withMessage(() => 'must be specified at least 2')
    ],
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(mongoose.connection);

            // 検索条件を限定
            const orderDateThrough = moment()
                .toDate();
            const orderDateFrom = moment(orderDateThrough)
                // tslint:disable-next-line:no-magic-numbers
                .add(-93, 'days') // とりあえず直近3カ月をデフォルト動作に設定
                .toDate();

            const searchConditions: cinerino.factory.order.ISearchConditions = {
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                sort: { orderDate: cinerino.factory.sortType.Descending },
                identifier: {
                    $all: req.query.identifier.$all
                },
                orderDateFrom: orderDateFrom,
                orderDateThrough: orderDateThrough
            };

            const orders = await orderRepo.search(searchConditions);

            res.json(orders);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 注文作成
 */
ordersRouter.post(
    '',
    permitScopes(['orders.*', 'orders.create']),
    rateLimit,
    ...[
        body('object.orderNumber')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('object.confirmationNumber')
            .if(isNotAdmin)
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('purpose.typeOf')
            .if(isNotAdmin)
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('purpose.id')
            .if(isNotAdmin)
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const orderNumber = <string>req.body.object?.orderNumber;

            // 注文検索
            const orders = await orderRepo.search({
                limit: 1,
                project: { id: { $eq: req.project.id } },
                orderNumbers: [orderNumber]
            });
            const order = orders.shift();

            // 注文未作成であれば作成
            if (order === undefined) {
                let placeOrderTransaction:
                    cinerino.factory.transaction.ITransaction<cinerino.factory.transactionType.PlaceOrder> | undefined;

                if (req.isAdmin) {
                    // 注文取引検索
                    const placeOrderTransactions = await transactionRepo.search<cinerino.factory.transactionType.PlaceOrder>({
                        limit: 1,
                        project: { id: { $eq: req.project.id } },
                        typeOf: cinerino.factory.transactionType.PlaceOrder,
                        statuses: [cinerino.factory.transactionStatusType.Confirmed],
                        result: { order: { orderNumbers: [orderNumber] } }
                    });
                    placeOrderTransaction = placeOrderTransactions.shift();
                } else {
                    const confirmationNumber = <string>req.body.object?.confirmationNumber;
                    const purposeTypeOf = <cinerino.factory.transactionType.PlaceOrder>req.body.purpose?.typeOf;
                    const purposeId = <string>req.body.purpose?.id;
                    // 注文番号と確認番号で、注文取引を検索
                    // if (typeof confirmationNumber !== 'string' || confirmationNumber.length === 0) {
                    //     throw new cinerino.factory.errors.ArgumentNull('confirmationNumber');
                    // }

                    // 取引IDで検索
                    placeOrderTransaction = await transactionRepo.findById<cinerino.factory.transactionType.PlaceOrder>({
                        typeOf: purposeTypeOf,
                        id: purposeId
                    });

                    // 注文取引検索
                    // const placeOrderTransactions = await transactionRepo.search<cinerino.factory.transactionType.PlaceOrder>({
                    //     limit: 1,
                    //     project: { id: { $eq: req.project.id } },
                    //     typeOf: cinerino.factory.transactionType.PlaceOrder,
                    //     statuses: [cinerino.factory.transactionStatusType.Confirmed],
                    //     result: {
                    //         order: {
                    //             orderNumbers: [orderNumber],
                    //             ...{
                    //                 confirmationNumber: { $eq: confirmationNumber }
                    //             }
                    //         }
                    //     }
                    // });
                    // placeOrderTransaction = placeOrderTransactions.shift();
                    if (placeOrderTransaction.result?.order.orderNumber !== orderNumber
                        || placeOrderTransaction.result?.order.confirmationNumber !== confirmationNumber) {
                        throw new cinerino.factory.errors.NotFound('Transaction', 'No transactions matched');
                    }
                }

                if (placeOrderTransaction === undefined) {
                    throw new cinerino.factory.errors.NotFound('Transaction');
                }
                const transactionResult = <cinerino.factory.transaction.IResult<cinerino.factory.transactionType.PlaceOrder>>
                    placeOrderTransaction.result;
                const orderActionAttributes: cinerino.factory.action.trade.order.IAttributes = {
                    agent: req.agent,
                    object: transactionResult.order,
                    potentialActions: {},
                    project: placeOrderTransaction.project,
                    purpose: { typeOf: placeOrderTransaction.typeOf, id: placeOrderTransaction.id },
                    typeOf: cinerino.factory.actionType.OrderAction
                };

                await cinerino.service.order.placeOrder(orderActionAttributes)({
                    action: actionRepo,
                    invoice: invoiceRepo,
                    order: orderRepo,
                    task: taskRepo,
                    transaction: transactionRepo
                });
            }

            res.json({});
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ストリーミングダウンロード
 */
ordersRouter.get(
    '/download',
    permitScopes([]),
    rateLimit,
    ...[
        query('disableTotalCount')
            .optional()
            .isBoolean()
            .toBoolean(),
        query('identifier.$all')
            .optional()
            .isArray(),
        query('identifier.$in')
            .optional()
            .isArray(),
        query('identifier.$all.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$all.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$in.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('identifier.$in.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        query('orderDateFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDateThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDate.$gte')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDate.$lte')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.inSessionFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.inSessionThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('acceptedOffers.itemOffered.reservationFor.startThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('price.$gte')
            .optional()
            .isInt()
            .toInt(),
        query('price.$lte')
            .optional()
            .isInt()
            .toInt()
    ],
    validator,
    async (req, res, next) => {
        let connection: mongoose.Connection | undefined;

        try {
            connection = await connectMongo({
                defaultConnection: false,
                disableCheck: true
            });
            const orderRepo = new cinerino.repository.Order(connection);

            const searchConditions: cinerino.factory.order.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } }
            };

            const format = req.query.format;

            const stream = await cinerino.service.report.order.stream({
                conditions: searchConditions,
                format: format
            })({ order: orderRepo });

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

/**
 * 確認番号と電話番号で注文照会
 * @deprecated 基本的にシネマサンシャイン互換性維持のためのエンドポイント
 */
ordersRouter.post(
    '/findByOrderInquiryKey',
    permitScopes(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']),
    rateLimit,
    ...[
        body('theaterCode')
            .not()
            .isEmpty()
            .withMessage(() => 'theaterCode required'),
        body('confirmationNumber')
            .not()
            .isEmpty()
            .withMessage(() => 'confirmationNumber required'),
        body('telephone')
            .not()
            .isEmpty()
            .withMessage(() => 'telephone required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const phoneUtil = PhoneNumberUtil.getInstance();
            const phoneNumber = phoneUtil.parse(<string>req.body.telephone, 'JP');
            if (!phoneUtil.isValidNumber(phoneNumber)) {
                throw new cinerino.factory.errors.Argument('telephone', 'Invalid phone number format');
            }

            const key = {
                theaterCode: <string>req.body.theaterCode,
                reservationNumber: <string>req.body.confirmationNumber,
                telephone: phoneUtil.format(phoneNumber, PhoneNumberFormat.E164)
            };

            const orderRepo = new cinerino.repository.Order(mongoose.connection);

            // 劇場枝番号、予約番号、個人情報完全一致で検索する
            const orders = await orderRepo.search({
                limit: 100,
                sort: { orderDate: cinerino.factory.sortType.Descending },
                project: { id: { $eq: req.project.id } },
                customer: { telephone: `^${escapeRegExp(key.telephone)}$` },
                acceptedOffers: {
                    itemOffered: {
                        reservationFor: { superEvent: { location: { branchCodes: [String(key.theaterCode)] } } },
                        reservationNumbers: [String(key.reservationNumber)]
                    }
                }
            });

            if (orders.length < 1) {
                // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
                throw new cinerino.factory.errors.NotFound(orderRepo.orderModel.modelName);
            }

            res.json(orders);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 確認番号で注文照会
 */
ordersRouter.post(
    '/findByConfirmationNumber',
    permitScopes(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']),
    rateLimit,
    ...[
        query('orderDateFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDateThrough')
            .optional()
            .isISO8601()
            .toDate(),
        body('orderDateFrom')
            .optional()
            .isISO8601()
            .toDate(),
        body('orderDateThrough')
            .optional()
            .isISO8601()
            .toDate(),
        body('orderDate.$gte')
            .optional()
            .isISO8601()
            .toDate(),
        body('orderDate.$lte')
            .optional()
            .isISO8601()
            .toDate(),
        body('confirmationNumber')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        oneOf([
            // confirmationNumberと、以下どれか1つ、の組み合わせで照会可能
            [
                body('customer.email')
                    .not()
                    .isEmpty()
                    .isString()
            ],
            [
                body('customer.telephone')
                    .not()
                    .isEmpty()
                    .isString()
            ],
            [
                body('orderNumber')
                    .not()
                    .isEmpty()
                    .isString()
            ]
        ])
    ],
    validator,
    async (req, res, next) => {
        try {
            const email = req.body.customer?.email;
            const telephone = req.body.customer?.telephone;
            const orderNumber = req.body.orderNumber;

            // 個人情報完全一致で検索する
            const orderRepo = new cinerino.repository.Order(mongoose.connection);

            const orderDateThrough = (req.query.orderDateThrough instanceof Date)
                ? req.query.orderDateThrough
                : (req.body.orderDateThrough instanceof Date)
                    ? req.body.orderDateThrough
                    : moment()
                        .toDate();
            const orderDateFrom = (req.query.orderDateFrom instanceof Date)
                ? req.query.orderDateFrom
                : (req.body.orderDateFrom instanceof Date)
                    ? req.body.orderDateFrom
                    : moment(orderDateThrough)
                        // tslint:disable-next-line:no-magic-numbers
                        .add(-3, 'months') // とりあえず直近3カ月をデフォルト動作に設定
                        .toDate();

            const orders = await orderRepo.search({
                limit: 100,
                sort: { orderDate: cinerino.factory.sortType.Descending },
                project: { id: { $eq: req.project.id } },
                confirmationNumbers: [<string>req.body.confirmationNumber],
                customer: {
                    email: (typeof email === 'string')
                        ? `^${escapeRegExp(email)}$`
                        : undefined,
                    telephone: (typeof telephone === 'string')
                        ? `^${escapeRegExp(telephone)}$`
                        : undefined
                },
                orderNumbers: (typeof orderNumber === 'string') ? [orderNumber] : undefined,
                orderDateFrom: orderDateFrom,
                orderDateThrough: orderDateThrough
            });

            if (orders.length < 1) {
                // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
                throw new cinerino.factory.errors.NotFound(orderRepo.orderModel.modelName);
            }

            res.json(orders);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 注文番号と何かしらで注文照会
 */
ordersRouter.post(
    '/findOneByOrderNumberAndSomething',
    permitScopes(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']),
    rateLimit,
    ...[
        body('orderNumber')
            .not()
            .isEmpty()
            .isString(),
        body('customer.telephone')
            .not()
            .isEmpty()
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            const telephone = <string>req.body.customer?.telephone;
            const orderNumber = <string>req.body.orderNumber;

            // 個人情報完全一致で検索する
            const orderRepo = new cinerino.repository.Order(mongoose.connection);

            const orders = await orderRepo.search({
                limit: 1,
                project: { id: { $eq: req.project.id } },
                customer: { telephone: { $eq: telephone } },
                orderNumbers: [orderNumber]
            });

            const order = orders.shift();
            if (order === undefined) {
                throw new cinerino.factory.errors.NotFound(orderRepo.orderModel.modelName);
            }

            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 注文取得
 */
ordersRouter.get(
    '/:orderNumber',
    permitScopes(['orders.*', 'orders.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const order = await orderRepo.findByOrderNumber({
                orderNumber: req.params.orderNumber
            });

            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 注文配送
 */
// tslint:disable-next-line:use-default-type-parameter
ordersRouter.post<ParamsDictionary>(
    '/:orderNumber/deliver',
    permitScopes(['orders.*', 'orders.deliver']),
    rateLimit,
    ...[
        body('object.confirmationNumber')
            .if(isNotAdmin)
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const registerActionInProgressRepo = new cinerino.repository.action.RegisterServiceInProgress(redis.getClient());

            const orderNumber = req.params.orderNumber;

            // 注文検索
            const order = await orderRepo.findByOrderNumber({
                orderNumber: orderNumber
            });

            if (req.isAdmin) {
                // no op
            } else {
                // 確認番号を検証
                const confirmationNumber = <string>req.body.object?.confirmationNumber;
                if (order.confirmationNumber !== confirmationNumber) {
                    throw new cinerino.factory.errors.NotFound(orderRepo.orderModel.modelName);
                }
            }

            if (order.orderStatus !== cinerino.factory.orderStatus.OrderDelivered) {
                // APIユーザーとして注文配送を実行する
                const sendOrderActionAttributes: cinerino.factory.action.transfer.send.order.IAttributes = {
                    agent: req.agent,
                    object: order,
                    potentialActions: {
                        sendEmailMessage: undefined
                    },
                    project: order.project,
                    recipient: order.customer,
                    typeOf: cinerino.factory.actionType.SendAction
                };

                await cinerino.service.delivery.sendOrder(sendOrderActionAttributes)({
                    action: actionRepo,
                    order: orderRepo,
                    ownershipInfo: ownershipInfoRepo,
                    registerActionInProgress: registerActionInProgressRepo,
                    task: taskRepo,
                    transaction: transactionRepo
                });
            }

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 注文に対するアクション検索
 */
ordersRouter.get(
    '/:orderNumber/actions',
    permitScopes(['orders.*', 'orders.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const actions = await actionRepo.searchByOrderNumber({
                orderNumber: req.params.orderNumber,
                sort: req.query.sort
            });
            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 確認番号で注文に対してコードを発行する
 */
// tslint:disable-next-line:use-default-type-parameter
ordersRouter.post<ParamsDictionary>(
    '/:orderNumber/authorize',
    permitScopes(['orders.*', 'orders.read', 'orders.findByConfirmationNumber']),
    rateLimit,
    ...[
        oneOf([
            [
                body('object.customer.email')
                    .not()
                    .isEmpty()
                    .isString()
            ],
            [
                body('object.customer.telephone')
                    .not()
                    .isEmpty()
                    .isString()
            ]
        ]),
        body('result.expiresInSeconds')
            .optional()
            .isInt({ min: 0, max: CODE_EXPIRES_IN_SECONDS_MAXIMUM })
            .toInt()
    ],
    validator,
    async (req, res, next) => {
        try {
            const now = new Date();

            const expiresInSeconds: number = (typeof req.body.result?.expiresInSeconds === 'number')
                ? Number(req.body.result.expiresInSeconds)
                : CODE_EXPIRES_IN_SECONDS_DEFAULT;

            const email = req.body.object?.customer?.email;
            const telephone = req.body.object?.customer?.telephone;

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const codeRepo = new cinerino.repository.Code(mongoose.connection);

            const order = await orderRepo.findByOrderNumber({ orderNumber: req.params.orderNumber });
            if (order.customer.email !== email && order.customer.telephone !== telephone) {
                throw new cinerino.factory.errors.NotFound(orderRepo.orderModel.modelName, 'No orders matched');
            }

            // const authorizationObject: cinerino.factory.order.ISimpleOrder = {
            //     project: order.project,
            //     typeOf: order.typeOf,
            //     seller: order.seller,
            //     customer: order.customer,
            //     confirmationNumber: order.confirmationNumber,
            //     orderNumber: order.orderNumber,
            //     price: order.price,
            //     priceCurrency: order.priceCurrency,
            //     orderDate: moment(order.orderDate)
            //         .toDate()
            // };

            // 注文に対してコード発行
            const authorizations = await cinerino.service.code.publish({
                project: req.project,
                agent: req.agent,
                recipient: req.agent,
                object: [order],
                purpose: {},
                validFrom: now,
                expiresInSeconds: expiresInSeconds
            })({
                action: actionRepo,
                code: codeRepo
            });

            // 予約番号でChevreチェックイン
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            let reservationNumbers = order.acceptedOffers
                .filter((o) => o.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
                .map((o) => (<EventReservationGoodType>o.itemOffered).reservationNumber);
            reservationNumbers = [...new Set(reservationNumbers)];
            await Promise.all(reservationNumbers.map(async (reservationNumber) => {
                await reservationService.checkInScreeningEventReservations({
                    reservationNumber: reservationNumber
                });
            }));

            res.json({
                code: authorizations[0].code
            });
        } catch (error) {
            next(error);
        }
    }
);

export default ordersRouter;
