/**
 * 自分の口座ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../../../middlewares/permitScopes';
import rateLimit from '../../../../middlewares/rateLimit';
import validator from '../../../../middlewares/validator';

import * as redis from '../../../../../redis';

// const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
//     domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
//     clientId: <string>process.env.CHEVRE_CLIENT_ID,
//     clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
//     scopes: [],
//     state: ''
// });

const accountsRouter = Router();

/**
 * 口座開設
 */
// tslint:disable-next-line:use-default-type-parameter
accountsRouter.post<ParamsDictionary>(
    '/:accountType',
    permitScopes(['people.me.*']),
    rateLimit,
    ...[
        body('name')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            // tslint:disable-next-line:max-line-length
            let ownershipInfo: cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood<cinerino.factory.ownershipInfo.AccountGoodType.Account>>;

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const registerActionInProgressRepo = new cinerino.repository.action.RegisterServiceInProgress(redis.getClient());
            const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
            const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
            const orderRepo = new cinerino.repository.Order(mongoose.connection);
            const invoiceRepo = new cinerino.repository.Invoice(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);
            const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
            const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());

            const project = await projectRepo.findById({ id: req.project.id });
            if (typeof project.settings?.cognito?.customerUserPool?.id !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satidfied');
            }
            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });

            const result = await cinerino.service.transaction.orderAccount.orderAccount({
                project: { typeOf: project.typeOf, id: project.id },
                agent: { typeOf: req.agent.typeOf, id: req.agent.id },
                name: req.body.name,
                accountType: req.params.accountType,
                location: { id: req.user.client_id }
            })({
                action: actionRepo,
                confirmationNumber: confirmationNumberRepo,
                orderNumber: orderNumberRepo,
                ownershipInfo: ownershipInfoRepo,
                person: personRepo,
                registerActionInProgress: registerActionInProgressRepo,
                project: projectRepo,
                seller: sellerRepo,
                transaction: transactionRepo
            });

            const order = result.order;

            const orderActionAttributes: cinerino.factory.action.trade.order.IAttributes = {
                agent: order.customer,
                object: order,
                potentialActions: {},
                project: order.project,
                typeOf: cinerino.factory.actionType.OrderAction
            };

            await cinerino.service.order.placeOrder(orderActionAttributes)({
                action: actionRepo,
                invoice: invoiceRepo,
                order: orderRepo,
                task: taskRepo,
                transaction: transactionRepo
            });

            // 注文配送を実行する
            const sendOrderActionAttributes: cinerino.factory.action.transfer.send.order.IAttributes = {
                agent: order.seller,
                object: order,
                potentialActions: {
                    sendEmailMessage: undefined
                },
                project: order.project,
                recipient: order.customer,
                typeOf: cinerino.factory.actionType.SendAction
            };

            const ownershipInfos = await cinerino.service.delivery.sendOrder(sendOrderActionAttributes)({
                action: actionRepo,
                order: orderRepo,
                ownershipInfo: ownershipInfoRepo,
                registerActionInProgress: registerActionInProgressRepo,
                task: taskRepo,
                transaction: transactionRepo
            });
            ownershipInfo = ownershipInfos[0];

            const itemOffered = <cinerino.factory.order.IServiceOutput>order.acceptedOffers[0].itemOffered;
            ownershipInfo = {
                project: order.project,
                id: '',
                typeOf: 'OwnershipInfo',
                ownedBy: order.customer,
                ownedFrom: new Date(),
                ownedThrough: new Date(),
                typeOfGood: {
                    // project: order.project,
                    typeOf: (<any>itemOffered).typeOf,
                    accountNumber: (<any>itemOffered).accountNumber,
                    accountType: (<any>itemOffered).accountType,
                    // name: (<any>itemOffered).name,
                    ...{
                        identifier: <string>itemOffered.identifier
                    }
                }
            };

            res.status(CREATED)
                .json(ownershipInfo);
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
    permitScopes(['people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            await cinerino.service.account.close({
                project: req.project,
                ownedBy: {
                    id: req.user.sub
                },
                accountType: req.params.accountType,
                accountNumber: req.params.accountNumber
            })({
                ownershipInfo: ownershipInfoRepo,
                project: projectRepo
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);
/**
 * 口座取引履歴検索
 */
accountsRouter.get(
    '/actions/moneyTransfer',
    permitScopes(['people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const actions = await cinerino.service.account.searchMoneyTransferActions({
                project: req.project,
                ownedBy: {
                    id: req.user.sub
                },
                conditions: req.query
            })({
                ownershipInfo: ownershipInfoRepo,
                project: projectRepo
            });

            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);
export default accountsRouter;
