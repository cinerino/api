/**
 * 注文ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body, query } from 'express-validator/check';
// tslint:disable-next-line:no-submodule-imports
import { CustomValidator } from 'express-validator/src/base';
import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';
import { NO_CONTENT } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

import * as redis from '../../redis';

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';
const USE_TELEPHONE_LAST_DIGIT_ORDER_INQUIRY = process.env.USE_TELEPHONE_LAST_DIGIT_ORDER_INQUIRY === '1';

/**
 * 正規表現をエスケープする
 */
function escapeRegExp(params: string) {
    return params.replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&');
}

type EventReservationGoodType = cinerino.factory.ownershipInfo.IGood<cinerino.factory.chevre.reservationType.EventReservation>;
const CODE_EXPIRES_IN_SECONDS = Number(process.env.CODE_EXPIRES_IN_SECONDS);
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ordersRouter = Router();
ordersRouter.use(authentication);

const isNotAdmin: CustomValidator = (_, { req }) => !req.isAdmin;

/**
 * 注文検索
 */
ordersRouter.get(
    '',
    permitScopes(['admin', 'customer', 'orders', 'orders.read-only']),
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
            .isLength({ max: 256 }),
        query('identifier.$all.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
        query('identifier.$in.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 256 }),
        query('identifier.$in.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: 512 }),
        query('orderDateFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDateThrough')
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
            .toDate()
    ],
    // 管理者でなければバリデーション追加
    ...[
        query('identifier.$all')
            .if(isNotAdmin)
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

            let searchConditions: cinerino.factory.order.ISearchConditions = {
                ...req.query,
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            // 管理者でない場合、検索条件を限定
            if (!req.isAdmin) {
                const orderDateThrough = (req.query.orderDateThrough instanceof Date)
                    ? req.query.orderDateThrough
                    : moment()
                        .toDate();
                const orderDateFrom = (req.query.orderDateFrom instanceof Date)
                    ? req.query.orderDateFrom
                    : moment(orderDateThrough)
                        // tslint:disable-next-line:no-magic-numbers
                        .add(-3, 'months') // とりあえず直近3カ月をデフォルト動作に設定
                        .toDate();

                searchConditions = {
                    project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
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
            }

            const totalCount = await orderRepo.count(searchConditions);
            const orders = await orderRepo.search(searchConditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(orders);
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
    permitScopes(['admin']),
    ...[
        query('orderDateFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('orderDateThrough')
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
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(mongoose.connection);

            const searchConditions: cinerino.factory.order.ISearchConditions = {
                ...req.query,
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined
            };

            const format = req.query.format;

            const stream = await cinerino.service.report.order.stream({
                conditions: searchConditions,
                format: format
            })({ order: orderRepo });

            res.type(`${req.query.format}; charset=utf-8`);
            stream.pipe(res);
        } catch (error) {
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
    permitScopes(['customer', 'orders', 'orders.read-only']),
    ...[
        body('theaterCode')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('confirmationNumber')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('telephone')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const phoneUtil = PhoneNumberUtil.getInstance();
            const phoneNumber = phoneUtil.parse(<string>req.body.telephone, 'JP');
            if (!phoneUtil.isValidNumber(phoneNumber)) {
                next(new cinerino.factory.errors.Argument('telephone', 'Invalid phone number format'));

                return;
            }

            const key = {
                theaterCode: <string>req.body.theaterCode,
                reservationNumber: Number(<string>req.body.confirmationNumber),
                telephone: phoneUtil.format(phoneNumber, PhoneNumberFormat.E164)
            };

            const orderRepo = new cinerino.repository.Order(mongoose.connection);

            // 劇場枝番号、予約番号、個人情報完全一致で検索する
            const orders = await orderRepo.search({
                limit: 1,
                sort: { orderDate: cinerino.factory.sortType.Descending },
                customer: { telephone: `^${escapeRegExp(key.telephone)}$` },
                acceptedOffers: {
                    itemOffered: {
                        reservationFor: { superEvent: { location: { branchCodes: [key.theaterCode] } } },
                        reservationNumbers: [key.reservationNumber.toString()]
                    }
                }
            });
            const order = orders.shift();
            if (order === undefined) {
                // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
                throw new cinerino.factory.errors.NotFound('Order');
            }

            res.json(order);
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
    permitScopes(['admin']),
    ...[
        body('orderNumber')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const orderNumber = <string>req.body.orderNumber;

            // 注文検索
            const orders = await orderRepo.search({
                limit: 1,
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
                orderNumbers: [orderNumber]
            });
            let order = orders.shift();

            // 注文未作成であれば作成
            if (order === undefined) {
                // 注文取引検索
                const placeOrderTransactions = await transactionRepo.search<cinerino.factory.transactionType.PlaceOrder>({
                    limit: 1,
                    typeOf: cinerino.factory.transactionType.PlaceOrder,
                    result: { order: { orderNumbers: [orderNumber] } }
                });
                const placeOrderTransaction = placeOrderTransactions.shift();
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
                    typeOf: cinerino.factory.actionType.OrderAction
                };

                await cinerino.service.order.placeOrder(orderActionAttributes)({
                    action: actionRepo,
                    invoice: invoiceRepo,
                    order: orderRepo,
                    task: taskRepo,
                    transaction: transactionRepo
                });

                order =
                    (<cinerino.factory.transaction.IResult<cinerino.factory.transactionType.PlaceOrder>>placeOrderTransaction.result).order;
            }

            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 注文配送
 */
ordersRouter.post(
    '/:orderNumber/deliver',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const registerActionInProgressRepo = new cinerino.repository.action.RegisterProgramMembershipInProgress(redis.getClient());

            const orderNumber = req.params.orderNumber;

            // 注文検索
            const order = await orderRepo.findByOrderNumber({
                orderNumber: orderNumber
            });

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
                    task: taskRepo
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
 * 確認番号で注文照会
 */
ordersRouter.post(
    '/findByConfirmationNumber',
    permitScopes(['customer', 'orders', 'orders.read-only']),
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
        body('confirmationNumber')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('customer')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const customer = req.body.customer;
            if (customer.email !== undefined && customer.telephone !== undefined) {
                throw new cinerino.factory.errors.Argument('customer');
            }

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
                limit: 1,
                sort: { orderDate: cinerino.factory.sortType.Descending },
                project: (MULTI_TENANT_SUPPORTED) ? { ids: [req.project.id] } : undefined,
                confirmationNumbers: [<string>req.body.confirmationNumber],
                customer: {
                    email: (customer.email !== undefined)
                        ? `^${escapeRegExp(customer.email)}$`
                        : undefined,
                    telephone: (customer.telephone !== undefined)
                        ? (USE_TELEPHONE_LAST_DIGIT_ORDER_INQUIRY)
                            ? `${escapeRegExp(customer.telephone)}$`
                            : `^${escapeRegExp(customer.telephone)}$`

                        : undefined
                },
                orderDateFrom: orderDateFrom,
                orderDateThrough: orderDateThrough
            });

            const order = orders.shift();
            if (order === undefined) {
                // まだ注文が作成されていなければ、注文取引から検索するか検討中だが、いまのところ取引検索条件が足りない...
                throw new cinerino.factory.errors.NotFound('Order');
            }

            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 確認番号で注文アイテムに対してコードを発行する
 */
// tslint:disable-next-line:use-default-type-parameter
ordersRouter.post<ParamsDictionary>(
    '/:orderNumber/ownershipInfos/authorize',
    permitScopes(['customer', 'orders', 'orders.read-only']),
    ...[
        body('customer')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const now = new Date();

            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });

            const customer = req.body.customer;
            if (customer.email !== undefined && customer.telephone !== undefined) {
                throw new cinerino.factory.errors.Argument('customer');
            }
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const codeRepo = new cinerino.repository.Code(mongoose.connection);

            const order = await orderRepo.findByOrderNumber({ orderNumber: req.params.orderNumber });
            if (order.customer.email !== customer.email && order.customer.telephone !== customer.telephone) {
                throw new cinerino.factory.errors.Argument('customer');
            }
            // まだ配送済でない場合
            if (order.orderStatus !== cinerino.factory.orderStatus.OrderDelivered) {
                throw new cinerino.factory.errors.Argument('orderNumber', 'Not delivered yet');
            }

            // 配送サービスに問い合わせて、注文から所有権を検索
            const actionsOnOrder = await actionRepo.searchByOrderNumber({ orderNumber: order.orderNumber });
            const sendOrderAction = <cinerino.factory.action.transfer.send.order.IAction>actionsOnOrder
                .filter((a) => a.typeOf === cinerino.factory.actionType.SendAction)
                .filter((a) => a.object.typeOf === 'Order')
                .find((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);
            // まだ配送済でない場合
            if (sendOrderAction === undefined || sendOrderAction.result === undefined) {
                throw new cinerino.factory.errors.Argument('orderNumber', 'Not delivered yet');
            }

            // 配送された所有権情報を注文に付加する
            type IOwnershipInfo =
                // tslint:disable-next-line:max-line-length
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.IGoodType>>;
            const ownershipInfos: IOwnershipInfo[] = (Array.isArray(sendOrderAction.result))
                ? sendOrderAction.result
                : (<any>sendOrderAction.result).ownershipInfos; // 旧型に対する互換性維持のため
            const reservationIds = ownershipInfos
                .filter((o) => o.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
                .map((o) => <string>(<EventReservationGoodType>o.typeOfGood).id);

            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.chevre === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: project.settings.chevre.endpoint,
                auth: chevreAuthClient
            });
            const searchReservationsResult = await reservationService.search<cinerino.factory.chevre.reservationType.EventReservation>({
                limit: reservationIds.length,
                typeOf: cinerino.factory.chevre.reservationType.EventReservation,
                ids: reservationIds
            });
            // 所有権に対してコード発行
            order.acceptedOffers = await Promise.all(order.acceptedOffers.map(async (offer) => {
                // 実際の予約データで置き換え
                const reservation = searchReservationsResult.data.find((r) => r.id === offer.itemOffered.id);
                if (reservation !== undefined) {
                    offer.itemOffered = reservation;
                }

                // 所有権コード情報を追加
                const ownershipInfo = ownershipInfos
                    .filter((o) => o.typeOfGood.typeOf === offer.itemOffered.typeOf)
                    .find((o) => (<EventReservationGoodType>o.typeOfGood).id === offer.itemOffered.id);
                if (ownershipInfo !== undefined) {
                    if (offer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                        const authorization = await cinerino.service.code.publish({
                            project: req.project,
                            agent: req.agent,
                            recipient: req.agent,
                            object: ownershipInfo,
                            purpose: {},
                            validFrom: now,
                            expiresInSeconds: CODE_EXPIRES_IN_SECONDS
                        })({
                            action: actionRepo,
                            code: codeRepo
                        });

                        offer.itemOffered.reservedTicket.ticketToken = authorization.code;
                        // offer.itemOffered.reservedTicket.ticketToken = await codeRepo.publish({
                        //     project: req.project,
                        //     data: ownershipInfo,
                        //     validFrom: now,
                        //     expiresInSeconds: CODE_EXPIRES_IN_SECONDS
                        // });
                    }
                }

                return offer;
            }));

            // 予約番号でChevreチェックイン
            let reservationNumbers = ownershipInfos
                .filter((o) => o.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
                .map((o) => (<EventReservationGoodType>o.typeOfGood).reservationNumber);
            reservationNumbers = [...new Set(reservationNumbers)];
            await Promise.all(reservationNumbers.map(async (reservationNumber) => {
                await reservationService.checkInScreeningEventReservations({
                    reservationNumber: reservationNumber
                });
            }));

            res.json(order);
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
    permitScopes(['admin']),
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

export default ordersRouter;
