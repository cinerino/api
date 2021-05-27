/**
 * アクションルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { query } from 'express-validator';
import { CREATED } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const actionsRouter = Router();

/**
 * アクション検索
 */
actionsRouter.get(
    '',
    permitScopes(['actions.*', 'actions.read']),
    rateLimit,
    ...[
        query('startFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('startThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            const searchConditions: cinerino.factory.action.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            // chevreで検索
            const actionService = new cinerino.chevre.service.Action({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: req.project.id }
            });

            const { data } = await actionService.search(searchConditions);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * チケット印刷アクション追加
 */
actionsRouter.post(
    '/print/ticket',
    permitScopes(['actions.*', 'actions.printTicket.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const ticket = {
                ticketToken: req.body.ticketToken
            };

            const action = await new cinerino.repository.Action(mongoose.connection).printTicket(
                req.user.sub,
                ticket,
                req.project
            );

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    });

/**
 * チケット印刷アクション検索
 */
actionsRouter.get(
    '/print/ticket',
    permitScopes(['actions.*', 'actions.printTicket.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const actions = await new cinerino.repository.Action(mongoose.connection).searchPrintTicket({
                agentId: req.user.sub,
                ticketToken: req.query.ticketToken
            });

            res.json(actions);
        } catch (error) {
            next(error);
        }
    });

export default actionsRouter;
