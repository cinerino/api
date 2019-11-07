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

// const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';

const placeOrderTransactionsRouter = Router();

import authentication from '../../../middlewares/authentication';
import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

import * as redis from '../../../../redis';

placeOrderTransactionsRouter.use(authentication);

/**
 * 座席仮予約
 */
placeOrderTransactionsRouter.post(
    '/:transactionId/actions/authorize/seatReservation',
    permitScopes(['transactions', 'pos']),
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
                    })
                }
            })(
                new cinerino.repository.Action(mongoose.connection),
                new cinerino.repository.PaymentNo(redis.getClient()),
                new cinerino.repository.rateLimit.TicketTypeCategory(redis.getClient()),
                new cinerino.repository.Transaction(mongoose.connection),
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
    permitScopes(['transactions', 'pos']),
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
    permitScopes(['transactions', 'pos']),
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
            const paymentNoRepo = new cinerino.repository.PaymentNo(redis.getClient());
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
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

            const authorizePaymentMethodAction = await authorizeOtherPayment({
                transaction: { id: req.params.transactionId }
            })({
                action: actionRepo
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

            let paymentNo: string | undefined;
            if (chevreReservations[0].underName !== undefined && Array.isArray(chevreReservations[0].underName.identifier)) {
                const paymentNoProperty = chevreReservations[0].underName.identifier.find((p) => p.name === 'paymentNo');
                if (paymentNoProperty !== undefined) {
                    paymentNo = paymentNoProperty.value;
                }
            }
            if (paymentNo === undefined) {
                paymentNo = await paymentNoRepo.publish(eventStartDateStr);
            }

            const confirmationNumber: string = `${eventStartDateStr}${paymentNo}`;

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
                    transaction: transaction,
                    paymentNo: <string>paymentNo,
                    gmoOrderId: authorizePaymentMethodActionResult.paymentMethodId,
                    paymentSeatIndex: index.toString(),
                    paymentMethodName: authorizePaymentMethodActionResult.name
                });
            });

            let confirmReservationParams: cinerino.factory.transaction.placeOrder.IConfirmReservationParams[] = [];
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
            let informOrderParams: cinerino.factory.transaction.placeOrder.IInformOrderParams[] = [
                { recipient: { url: <string>req.body.informOrderUrl } }
            ];

            // アプリケーション側でpotentialActionsの指定があればそちらを優先
            const potentialActionsParams: cinerino.factory.transaction.placeOrder.IPotentialActionsParams | undefined
                = req.body.potentialActions;

            if (potentialActionsParams !== undefined) {
                if (potentialActionsParams.order !== undefined) {
                    if (potentialActionsParams.order.potentialActions !== undefined) {
                        if (Array.isArray(potentialActionsParams.order.potentialActions.informOrder)) {
                            informOrderParams = potentialActionsParams.order.potentialActions.informOrder;
                        }

                        if (potentialActionsParams.order.potentialActions.sendOrder !== undefined) {
                            if (potentialActionsParams.order.potentialActions.sendOrder.potentialActions !== undefined) {
                                if (Array.isArray(
                                    potentialActionsParams.order.potentialActions.sendOrder.potentialActions.confirmReservation
                                )) {
                                    confirmReservationParams
                                        = potentialActionsParams.order.potentialActions.sendOrder.potentialActions.confirmReservation;
                                }
                            }
                        }
                    }
                }
            }

            const potentialActions: cinerino.factory.transaction.placeOrder.IPotentialActionsParams = {
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
            };

            // 決済承認後に注文日時を確定しなければ、取引条件を満たさないので注意
            const orderDate = new Date();

            const transactionResult = await cinerino.service.transaction.placeOrderInProgress.confirm({
                project: { typeOf: req.project.typeOf, id: req.project.id },
                agent: { id: req.user.sub },
                id: req.params.transactionId,
                potentialActions: potentialActions,
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
                .json(transactionResult);
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
        const seatReservationAuthorizeActions
            = <cinerino.factory.action.authorize.offer.seatReservation.IAction<cinerino.factory.service.webAPI.Identifier.Chevre>[]>
            authorizeActions
                .filter((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus)
                .filter((a) => a.object.typeOf === cinerino.factory.action.authorize.offer.seatReservation.ObjectType.SeatReservation);
        if (seatReservationAuthorizeActions.length > 1) {
            throw new cinerino.factory.errors.Argument('Transaction', 'Number of seat reservations must be 1');
        }
        const seatReservationAuthorizeAction = seatReservationAuthorizeActions.shift();
        if (seatReservationAuthorizeAction === undefined || seatReservationAuthorizeAction.result === undefined) {
            throw new cinerino.factory.errors.Argument('Transaction', 'Seat reservation authorize action required');
        }

        return seatReservationAuthorizeAction.result;
    };
}

function authorizeOtherPayment(params: {
    transaction: { id: string };
}) {
    return async (repos: {
        action: cinerino.repository.Action;
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
            // 仮予約のidentifierを引き継ぐ?
            // ...(params.chevreReservation.underName !== undefined && Array.isArray(params.chevreReservation.underName.identifier))
            //     ? params.chevreReservation.underName.identifier
            //     : [],
            { name: 'paymentNo', value: params.paymentNo },
            { name: 'transaction', value: params.transaction.id },
            { name: 'gmoOrderId', value: params.gmoOrderId },
            ...(typeof customer.age === 'string')
                ? [{ name: 'age', value: customer.age }]
                : [],
            ...(Array.isArray(customer.identifier)) ? customer.identifier : [],
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
