/**
 * 注文ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as moment from 'moment';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

import * as redis from '../../redis';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const ordersRouter = Router();
ordersRouter.use(authentication);
/**
 * 確認番号で注文照会
 */
ordersRouter.post(
    '/findByConfirmationNumber',
    permitScopes(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']),
    (req, _2, next) => {
        req.checkBody('confirmationNumber', 'invalid confirmationNumber').notEmpty().withMessage('confirmationNumber is required');
        req.checkBody('customer', 'invalid customer').notEmpty().withMessage('customer is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const customer = req.body.customer;
            if (customer.email !== undefined && customer.telephone !== undefined) {
                throw new cinerino.factory.errors.Argument('customer');
            }
            const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
            const order = await orderRepo.findByConfirmationNumber({
                confirmationNumber: req.body.confirmationNumber,
                customer: customer
            });
            res.json(order);
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 確認番号で注文アイテムに対してコードを発行する
 */
ordersRouter.post(
    '/:orderNumber/ownershipInfos/authorize',
    permitScopes(['aws.cognito.signin.user.admin', 'orders', 'orders.read-only']),
    (req, _2, next) => {
        req.checkBody('customer', 'invalid customer').notEmpty().withMessage('customer is required');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const customer = req.body.customer;
            if (customer.email !== undefined && customer.telephone !== undefined) {
                throw new cinerino.factory.errors.Argument('customer');
            }
            const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
            const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
            const codeRepo = new cinerino.repository.Code(redis.getClient());

            const order = await orderRepo.findByOrderNumber(req.params.orderNumber);
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
            const ownershipInfos = sendOrderAction.result.ownershipInfos;
            const reservationIds = ownershipInfos
                .filter((o) => o.typeOfGood.typeOf === cinerino.factory.chevre.reservationType.EventReservation)
                .map((o) => (<any>o.typeOfGood).id);
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });
            const searchReservationsResult = await reservationService.searchScreeningEventReservations({
                limit: reservationIds.length,
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
                    .find((o) => (<any>o.typeOfGood).id === offer.itemOffered.id);
                if (ownershipInfo !== undefined) {
                    offer.itemOffered.reservedTicket.ticketToken = await codeRepo.publish({ data: ownershipInfo });
                }

                return offer;
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
            const actionRepo = new cinerino.repository.Action(cinerino.mongoose.connection);
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
 * 注文検索
 */
ordersRouter.get(
    '',
    permitScopes(['admin']),
    (req, __2, next) => {
        req.checkQuery('orderDateFrom').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
        req.checkQuery('orderDateThrough').notEmpty().withMessage('required').isISO8601().withMessage('must be ISO8601');
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const orderRepo = new cinerino.repository.Order(cinerino.mongoose.connection);
            const searchConditions: cinerino.factory.order.ISearchConditions = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                sort: (req.query.sort !== undefined) ? req.query.sort : { orderDate: cinerino.factory.sortType.Descending },
                seller: req.query.seller,
                customer: req.query.customer,
                orderNumbers: (Array.isArray(req.query.orderNumbers)) ? req.query.orderNumbers : undefined,
                orderStatuses: (Array.isArray(req.query.orderStatuses)) ? req.query.orderStatuses : undefined,
                orderDateFrom: moment(req.query.orderDateFrom).toDate(),
                orderDateThrough: moment(req.query.orderDateThrough).toDate(),
                confirmationNumbers: (Array.isArray(req.query.confirmationNumbers))
                    ? req.query.confirmationNumbers
                    : undefined,
                reservedEventIds: (Array.isArray(req.query.reservedEventIds))
                    ? req.query.reservedEventIds
                    : undefined
            };
            const orders = await orderRepo.search(searchConditions);
            const totalCount = await orderRepo.count(searchConditions);
            res.set('X-Total-Count', totalCount.toString());
            res.json(orders);
        } catch (error) {
            next(error);
        }
    }
);
export default ordersRouter;
