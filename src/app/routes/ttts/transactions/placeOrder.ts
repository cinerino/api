/**
 * 注文取引ルーター(ttts専用)
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as moment from 'moment-timezone';
import * as mongoose from 'mongoose';

const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const WEBHOOK_ON_RESERVATION_STATUS_CHANGED = (process.env.WEBHOOK_ON_RESERVATION_STATUS_CHANGED !== undefined)
    ? process.env.WEBHOOK_ON_RESERVATION_STATUS_CHANGED.split(',')
    : [];

const placeOrderTransactionsRouter = Router();

import authentication from '../../../middlewares/authentication';
import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

import * as redis from '../../../../redis';

placeOrderTransactionsRouter.use(authentication);

placeOrderTransactionsRouter.post(
    '/start',
    permitScopes(['transactions']),
    async (req, _, next) => {
        if (typeof req.body.seller_identifier === 'string') {
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);

            const doc = await sellerRepo.organizationModel.findOne({
                identifier: req.body.seller_identifier
            })
                .exec();
            if (doc === null) {
                next(new cinerino.factory.errors.NotFound('Seller'));

                return;
            }
            const seller = doc.toObject();

            req.body.seller = {
                typeOf: seller.typeOf,
                id: seller.id
            };
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
            .withMessage(() => 'required')
            .isISO8601()
            .toDate(),
        body('seller.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('seller.id')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        ...(!WAITER_DISABLED)
            ? [
                body('object.passport.token')
                    .not()
                    .isEmpty()
                    .withMessage((_, __) => 'required')
            ]
            : []
    ],
    validator,
    async (req, res, next) => {
        try {
            // WAITER有効設定であれば許可証をセット
            let passport: cinerino.factory.transaction.placeOrder.IPassportBeforeStart | undefined;
            if (!WAITER_DISABLED) {
                if (process.env.WAITER_PASSPORT_ISSUER === undefined) {
                    throw new cinerino.factory.errors.ServiceUnavailable('WAITER_PASSPORT_ISSUER undefined');
                }
                if (process.env.WAITER_SECRET === undefined) {
                    throw new cinerino.factory.errors.ServiceUnavailable('WAITER_SECRET undefined');
                }
                passport = {
                    token: req.body.object.passport.token,
                    issuer: process.env.WAITER_PASSPORT_ISSUER,
                    secret: process.env.WAITER_SECRET
                };
            }

            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const expires: Date = req.body.expires;

            const seller = await sellerRepo.findById({ id: <string>req.body.seller.id });

            /**
             * WAITER許可証の有効性チェック
             */
            const passportValidator: cinerino.service.transaction.placeOrderInProgress.IPassportValidator =
                (params) => {
                    // 許可証発行者確認
                    const validIssuer = params.passport.iss === process.env.WAITER_PASSPORT_ISSUER;

                    // スコープのフォーマットは、placeOrderTransaction.{sellerIdentifier}
                    const explodedScopeStrings = params.passport.scope.split('.');
                    const validScope = (
                        explodedScopeStrings[0] === 'placeOrderTransaction' && // スコープ接頭辞確認
                        explodedScopeStrings[1] === seller.identifier // 販売者識別子確認
                    );

                    return validIssuer && validScope;
                };

            const transaction = await cinerino.service.transaction.placeOrderInProgress.start({
                project: req.project,
                expires: expires,
                agent: {
                    ...req.agent,
                    identifier: [
                        ...(req.agent.identifier !== undefined) ? req.agent.identifier : [],
                        ...(req.body.agent !== undefined && Array.isArray(req.body.agent.identifier))
                            ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                return { name: String(p.name), value: String(p.value) };
                            })
                            : []
                    ]
                },
                seller: req.body.seller,
                object: {
                    clientUser: req.user,
                    passport: passport
                },
                passportValidator: passportValidator
            })({
                seller: sellerRepo,
                transaction: transactionRepo
            });

            // tslint:disable-next-line:no-string-literal
            // const host = req.headers['host'];
            // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
            res.status(CREATED)
                .json(transaction);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 購入者情報を変更する
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put<ParamsDictionary>(
    '/:transactionId/customerContact',
    permitScopes(['transactions']),
    ...[
        body('last_name')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('first_name')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('tel')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('email')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const profile = await cinerino.service.transaction.placeOrderInProgress.updateAgent({
                id: req.params.transactionId,
                agent: {
                    ...req.body,
                    id: req.user.sub,
                    givenName: (typeof req.body.first_name === 'string') ? req.body.first_name : '',
                    familyName: (typeof req.body.last_name === 'string') ? req.body.last_name : '',
                    telephone: (typeof req.body.tel === 'string') ? req.body.tel : '',
                    telephoneRegion: (typeof req.body.address === 'string') ? req.body.address : ''
                }
            })({
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(profile);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/seatReservation',
    permitScopes(['transactions']),
    validator,
    async (req, res, next) => {
        try {
            if (!Array.isArray(req.body.offers)) {
                req.body.offers = [];
            }

            const performanceId: string = req.body.performance_id;

            const action = await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4ttts.create({
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                object: {
                    event: { id: performanceId },
                    acceptedOffer: [],
                    acceptedOffers: (<any[]>req.body.offers).map((offer) => {
                        return {
                            ticket_type: offer.ticket_type,
                            watcher_name: offer.watcher_name
                        };
                    }),
                    onReservationStatusChanged: {
                        informReservation: WEBHOOK_ON_RESERVATION_STATUS_CHANGED.map((url) => {
                            return { recipient: { url: url } };
                        })
                    }
                }
            })(
                new cinerino.repository.Transaction(mongoose.connection),
                new cinerino.repository.Action(mongoose.connection),
                new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
                new cinerino.repository.Project(mongoose.connection)
            );

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 座席仮予約削除
 */
placeOrderTransactionsRouter.delete(
    '/:transactionId/actions/authorize/seatReservation/:actionId',
    permitScopes(['transactions']),
    validator,
    async (req, res, next) => {
        try {
            await cinerino.service.transaction.placeOrderInProgress.action.authorize.offer.seatReservation4ttts.cancel({
                project: req.project,
                agent: { id: req.user.sub },
                transaction: { id: req.params.transactionId },
                id: req.params.actionId
            })(
                new cinerino.repository.Transaction(mongoose.connection),
                new cinerino.repository.Action(mongoose.connection),
                new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
                new cinerino.repository.Project(mongoose.connection)
            );

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

placeOrderTransactionsRouter.post(
    '/:transactionId/confirm',
    permitScopes(['transactions']),
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const paymentMethodType = req.body.payment_method;

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
            const paymentNoRepo = new cinerino.repository.PaymentNo(redis.getClient());
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const tokenRepo = new cinerino.repository.Token(redis.getClient());
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

            const transaction = await transactionRepo.findInProgressById<cinerino.factory.transactionType.PlaceOrder>({
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: req.params.transactionId
            });

            const authorizeSeatReservationResult = await getTmpReservations({
                transaction: { id: req.params.transactionId }
            })({
                action: actionRepo
            });
            const acceptedOffers = (Array.isArray(authorizeSeatReservationResult.acceptedOffers))
                ? authorizeSeatReservationResult.acceptedOffers
                : [];
            const reserveTransaction = authorizeSeatReservationResult.responseBody;
            if (reserveTransaction === undefined) {
                throw new cinerino.factory.errors.Argument('Transaction', 'Reserve trasaction required');
            }
            const chevreReservations = (Array.isArray(reserveTransaction.object.reservations))
                ? reserveTransaction.object.reservations
                : [];
            const event = reserveTransaction.object.reservationFor;
            if (event === undefined || event === null) {
                throw new cinerino.factory.errors.Argument('Transaction', 'Event required');
            }

            // クライアントが内部予約の場合、決済方法承認アクションを自動生成
            const authorizePaymentMethodAction = await authorizeOtherPayment({
                agent: { id: req.user.sub },
                client: { id: req.user.client_id },
                paymentMethodType: paymentMethodType,
                amount: authorizeSeatReservationResult.price,
                transaction: { id: req.params.transactionId }
            })({
                action: actionRepo,
                seller: sellerRepo,
                transaction: transactionRepo
            });
            if (authorizePaymentMethodAction === undefined) {
                throw new cinerino.factory.errors.Argument('Transaction', 'Payment method authorization required');
            }
            const authorizePaymentMethodActionResult = <cinerino.factory.action.authorize.paymentMethod.any.IResult<any>>
                authorizePaymentMethodAction.result;

            // 確認番号を事前生成
            const eventStartDateStr = moment(event.startDate)
                .tz('Asia/Tokyo')
                .format('YYYYMMDD');
            const paymentNo = await paymentNoRepo.publish(eventStartDateStr);
            const confirmationNumber: string = `${eventStartDateStr}${paymentNo}`;

            const informOrderUrl = <string>req.body.informOrderUrl;

            // 予約確定パラメータを生成
            const eventReservations = acceptedOffers.map((acceptedOffer, index) => {
                const reservation = acceptedOffer.itemOffered;

                const chevreReservation = chevreReservations.find((r) => r.id === reservation.id);
                if (chevreReservation === undefined) {
                    throw new cinerino.factory.errors.Argument('Transaction', `Unexpected temporary reservation: ${reservation.id}`);
                }

                return temporaryReservation2confirmed({
                    reservation: reservation,
                    chevreReservation: chevreReservation,
                    transaction: <any>transaction,
                    paymentNo: paymentNo,
                    gmoOrderId: authorizePaymentMethodActionResult.paymentMethodId,
                    paymentSeatIndex: index.toString(),
                    paymentMethodName: authorizePaymentMethodActionResult.name
                });
            });

            const confirmReservationParams: cinerino.factory.transaction.placeOrder.IConfirmReservationParams[] = [];
            confirmReservationParams.push({
                object: {
                    typeOf: reserveTransaction.typeOf,
                    id: reserveTransaction.id,
                    object: {
                        reservations: [
                            ...eventReservations.map((r) => {
                                // プロジェクト固有の値を連携
                                return {
                                    id: r.id,
                                    additionalTicketText: r.additionalTicketText,
                                    underName: r.underName,
                                    additionalProperty: r.additionalProperty
                                };
                            }),
                            // 余分確保分の予約にもextraプロパティを連携
                            ...chevreReservations.filter((r) => {
                                // 注文アイテムに存在しない予約(余分確保分)にフィルタリング
                                const orderItem = eventReservations.find(
                                    (eventReservation) => eventReservation.id === r.id
                                );

                                return orderItem === undefined;
                            })
                                .map((r) => {
                                    return {
                                        id: r.id,
                                        additionalProperty: [
                                            { name: 'extra', value: '1' }
                                        ]
                                    };
                                })
                        ]
                    },
                    potentialActions: {
                        reserve: {
                            potentialActions: {
                                informReservation: []
                            }
                        }
                    }
                }
            });

            // 注文通知パラメータを生成
            const informOrderParams: cinerino.factory.transaction.placeOrder.IInformOrderParams[] = [
                { recipient: { url: informOrderUrl } }
            ];

            // 決済承認後に注文日時を確定しなければ、取引条件を満たさないので注意
            const orderDate = new Date();

            // 印刷トークンを事前に発行
            const printToken = await tokenRepo.createPrintToken(acceptedOffers.map((o) => o.itemOffered.id));

            const transactionResult = await cinerino.service.transaction.placeOrderInProgress.confirm({
                project: { typeOf: req.project.typeOf, id: req.project.id },
                agent: { id: req.user.sub },
                id: req.params.transactionId,
                potentialActions: {
                    order: {
                        potentialActions: {
                            sendOrder: {
                                potentialActions: {
                                    confirmReservation: confirmReservationParams
                                }
                            },
                            informOrder: informOrderParams
                        }
                    }
                },
                result: {
                    order: {
                        orderDate: orderDate,
                        confirmationNumber: confirmationNumber
                    }
                }
            })({
                action: actionRepo,
                orderNumber: orderNumberRepo,
                seller: sellerRepo,
                transaction: transactionRepo
            });

            res.status(CREATED)
                .json({
                    ...transactionResult,
                    // 印刷トークン情報を追加
                    printToken: printToken
                });
        } catch (error) {
            next(error);
        }
    }
);

function getTmpReservations(params: {
    transaction: { id: string };
}) {
    return async (repos: {
        action: cinerino.repository.Action;
    }): Promise<cinerino.factory.action.authorize.offer.seatReservation.IResult<cinerino.factory.service.webAPI.Identifier.Chevre>> => {
        const authorizeActions = await repos.action.searchByPurpose({
            typeOf: cinerino.factory.actionType.AuthorizeAction,
            purpose: {
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: params.transaction.id
            }
        });
        const seatReservationAuthorizeAction
            // tslint:disable-next-line:max-line-length
            = <cinerino.factory.action.authorize.offer.seatReservation.IAction<cinerino.factory.service.webAPI.Identifier.Chevre> | undefined>
            authorizeActions
                .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus)
                .find((a) => a.object.typeOf === cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation);
        if (seatReservationAuthorizeAction === undefined || seatReservationAuthorizeAction.result === undefined) {
            throw new cinerino.factory.errors.Argument('Transaction', 'Seat reservation authorize action required');
        }

        return seatReservationAuthorizeAction.result;
    };
}

function authorizeOtherPayment(params: {
    agent: { id: string };
    client: { id: string };
    paymentMethodType: cinerino.factory.paymentMethodType;
    amount: number;
    transaction: { id: string };
}) {
    return async (repos: {
        action: cinerino.repository.Action;
        seller: cinerino.repository.Seller;
        transaction: cinerino.repository.Transaction;
    }) => {
        let authorizePaymentMethodAction: cinerino.factory.action.authorize.paymentMethod.any.IAction<any> | undefined;
        const authorizeActions = await repos.action.searchByPurpose({
            typeOf: cinerino.factory.actionType.AuthorizeAction,
            purpose: {
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: params.transaction.id
            }
        });
        authorizePaymentMethodAction = authorizeActions
            .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus)
            .find(
                (a) => a.object.typeOf === cinerino.factory.paymentMethodType.Cash
                    || a.object.typeOf === cinerino.factory.paymentMethodType.CreditCard
                    || a.object.typeOf === cinerino.factory.paymentMethodType.Others
            );

        return authorizePaymentMethodAction;
    };
}

/**
 * 仮予約から確定予約を生成する
 */
function temporaryReservation2confirmed(params: {
    reservation: cinerino.factory.order.IReservation;
    chevreReservation: cinerino.factory.chevre.reservation.IReservation<cinerino.factory.chevre.reservationType.EventReservation>;
    transaction: cinerino.factory.transaction.ITransaction<cinerino.factory.transactionType.PlaceOrder>;
    paymentNo: string;
    gmoOrderId: string;
    paymentSeatIndex: string;
    paymentMethodName: string;
}): cinerino.factory.chevre.reservation.IReservation<cinerino.factory.chevre.reservationType.EventReservation> {
    const customer = params.transaction.agent;

    const underName: cinerino.factory.chevre.reservation.IUnderName<cinerino.factory.chevre.reservationType.EventReservation> = {
        typeOf: cinerino.factory.personType.Person,
        id: customer.id,
        name: `${customer.givenName} ${customer.familyName}`,
        familyName: customer.familyName,
        givenName: customer.givenName,
        email: customer.email,
        telephone: customer.telephone,
        gender: customer.gender,
        identifier: [
            { name: 'paymentNo', value: params.paymentNo },
            { name: 'transaction', value: params.transaction.id },
            { name: 'gmoOrderId', value: params.gmoOrderId },
            ...(typeof customer.age === 'string')
                ? [{ name: 'age', value: customer.age }]
                : [],
            ...(customer.identifier !== undefined) ? customer.identifier : [],
            ...(customer.memberOf !== undefined && customer.memberOf.membershipNumber !== undefined)
                ? [{ name: 'username', value: customer.memberOf.membershipNumber }]
                : [],
            ...(params.paymentMethodName !== undefined)
                ? [{ name: 'paymentMethod', value: params.paymentMethodName }]
                : []
        ],
        ...{ address: customer.address }
    };

    return {
        ...params.chevreReservation,
        underName: underName,
        additionalProperty: [
            ...(Array.isArray(params.reservation.additionalProperty)) ? params.reservation.additionalProperty : [],
            { name: 'paymentSeatIndex', value: params.paymentSeatIndex }
        ],
        additionalTicketText: params.reservation.additionalTicketText
    };
}

// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post<ParamsDictionary>(
    '/:transactionId/tasks/sendEmailNotification',
    permitScopes(['transactions']),
    ...[
        body('sender.name')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('sender.email')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('toRecipient.name')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('toRecipient.email')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isEmail(),
        body('about')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('text')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const task = await cinerino.service.transaction.placeOrder.sendEmail(
                req.params.transactionId,
                {
                    typeOf: cinerino.factory.creativeWorkType.EmailMessage,
                    sender: {
                        name: req.body.sender.name,
                        email: req.body.sender.email
                    },
                    toRecipient: {
                        name: req.body.toRecipient.name,
                        email: req.body.toRecipient.email
                    },
                    about: req.body.about,
                    text: req.body.text
                }
            )({
                task: new cinerino.repository.Task(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(CREATED)
                .json(task);
        } catch (error) {
            next(error);
        }
    }
);

export default placeOrderTransactionsRouter;
