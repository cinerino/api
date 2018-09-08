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
            // 配送サービスに問い合わせて、注文から所有権を検索
            const actionsOnOrder = await actionRepo.findByOrderNumber({ orderNumber: order.orderNumber });
            const sendAction = <cinerino.factory.action.transfer.send.order.IAction>actionsOnOrder
                .filter((a) => a.typeOf === cinerino.factory.actionType.SendAction)
                .find((a) => a.actionStatus === cinerino.factory.actionStatusType.CompletedActionStatus);
            if (sendAction === undefined) {
                throw new cinerino.factory.errors.NotFound('OwnershipInfo');
            }
            if (sendAction.result === undefined) {
                throw new cinerino.factory.errors.NotFound('OwnershipInfo');
            }
            const ownershipInfos = sendAction.result.ownershipInfos;
            // 所有権に対してコード発行
            order.acceptedOffers = await Promise.all(order.acceptedOffers.map(async (offer) => {
                const ownershipInfo = ownershipInfos
                    .filter((o) => o.typeOfGood.typeOf === offer.itemOffered.typeOf)
                    .find((o) => (<any>o.typeOfGood).id === offer.itemOffered.id);
                offer.itemOffered.reservedTicket.ticketToken = await codeRepo.publish({ data: ownershipInfo });

                return offer;
            }));
            res.json(order);
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
                sellerIds: (Array.isArray(req.query.sellerIds)) ? req.query.sellerIds : undefined,
                customerMembershipNumbers: (Array.isArray(req.query.customerMembershipNumbers))
                    ? req.query.customerMembershipNumbers
                    : undefined,
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
