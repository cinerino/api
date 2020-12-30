/**
 * 予約ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, query } from 'express-validator';
import { NO_CONTENT } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const reservationsRouter = Router();

/**
 * 管理者として予約検索
 */
reservationsRouter.get(
    '',
    permitScopes(['reservations.*', 'reservations.read']),
    rateLimit,
    ...[
        query('bookingFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('bookingThrough')
            .optional()
            .isISO8601()
            .toDate(),
        query('modifiedFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('modifiedThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            // クエリをそのままChevre検索へパス
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const searchResult = await reservationService.search({
                ...req.query,
                project: { ids: [req.project.id] },
                typeOf: cinerino.factory.chevre.reservationType.EventReservation
            });

            res.json(searchResult.data);
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            next(error);
        }
    }
);

/**
 * ストリーミングダウンロード
 */
reservationsRouter.get(
    '/download',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            // クエリをそのままChevre検索へパス
            const reservationService = new cinerino.chevre.service.Reservation({
                endpoint: <string>process.env.CHEVRE_STREAMING_API_ENDPOINT,
                auth: chevreAuthClient
            });
            const stream = <NodeJS.ReadableStream>await reservationService.download({
                ...req.query,
                project: { ids: [req.project.id] }
            });

            res.type(`${req.query.format}; charset=utf-8`);
            stream.pipe(res);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * トークンで予約を使用する
 */
reservationsRouter.post(
    '/use',
    permitScopes(['reservations.read', 'reservations.findByToken']),
    rateLimit,
    ...[
        // どのトークンを使って
        body('instrument.token')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        // どの予約を
        body('object.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            const includesActionId = req.body.includesActionId === '1';
            const token = <string>req.body.instrument?.token;
            const reservationId = <string>req.body.object?.id;
            const locationIdentifier = req.body.location?.identifier;

            const payload = await cinerino.service.code.verifyToken<IPayload>({
                project: req.project,
                agent: req.agent,
                token: token,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: [<string>process.env.RESOURCE_SERVER_IDENTIFIER]
            })({});

            switch (payload.typeOf) {
                case <any>'Order':
                    const orderRepo = new cinerino.repository.Order(mongoose.connection);

                    // 注文検索
                    const order = await orderRepo.findByOrderNumber({ orderNumber: (<any>payload).orderNumber });

                    const acceptedOffer = order.acceptedOffers.find((offer) => {
                        return offer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation
                            && (<cinerino.factory.order.IReservation>offer.itemOffered).id === reservationId;
                    });
                    if (acceptedOffer === undefined) {
                        throw new cinerino.factory.errors.NotFound('AcceptedOffer');
                    }

                    const chevreUseAction = await useReservation({
                        project: { id: req.project.id },
                        agent: req.agent,
                        object: { id: (<cinerino.factory.order.IReservation>acceptedOffer.itemOffered).id },
                        instrument: { token },
                        location: { identifier: (typeof locationIdentifier === 'string') ? locationIdentifier : undefined }
                    })({ action: new cinerino.repository.Action(mongoose.connection) });

                    // 指定があれば、アクションIDをレスポンスに含める
                    if (includesActionId && typeof chevreUseAction?.id === 'string') {
                        res.json({ id: chevreUseAction.id });
                    } else {
                        res.status(NO_CONTENT)
                            .end();
                    }

                    break;

                default:
                    throw new cinerino.factory.errors.NotImplemented(`Payload type ${payload.typeOf} not implemented`);
            }
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            next(error);
        }
    }
);

function useReservation(params: {
    project: { id: string };
    agent: cinerino.factory.person.IPerson;
    object: {
        id: string;
    };
    instrument?: {
        token?: string;
    };
    location?: {
        identifier?: string;
    };
}) {
    return async (repos: {
        action: cinerino.repository.Action;
    }) => {
        // 予約検索
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const reservation = await reservationService.findById<cinerino.factory.chevre.reservationType.EventReservation>({
            id: params.object.id
        });

        // 入場
        // 予約使用アクションを追加
        const actionAttributes: cinerino.factory.action.IAttributes<cinerino.factory.actionType.UseAction, any, any> = {
            project: { typeOf: cinerino.factory.chevre.organizationType.Project, id: params.project.id },
            typeOf: cinerino.factory.actionType.UseAction,
            agent: params.agent,
            instrument: params.instrument,
            object: [reservation]
            // purpose: params.purpose
        };
        const action = await repos.action.start(actionAttributes);
        let chevreUseAction: { id: string } | undefined;

        try {
            const useResult = await reservationService.use({
                agent: params.agent,
                object: { id: reservation.id },
                instrument: { token: (typeof params.instrument?.token === 'string') ? params.instrument.token : undefined },
                location: { identifier: (typeof params.location?.identifier === 'string') ? params.location.identifier : undefined }
            });
            if (useResult !== undefined) {
                chevreUseAction = useResult;
            }
        } catch (error) {
            // actionにエラー結果を追加
            try {
                const actionError = { ...error, message: error.message, name: error.name };
                await repos.action.giveUp({ typeOf: actionAttributes.typeOf, id: action.id, error: actionError });
            } catch (__) {
                // 失敗したら仕方ない
            }

            throw error;
        }

        await repos.action.complete({ typeOf: action.typeOf, id: action.id, result: {} });

        return chevreUseAction;
    };
}

/**
 * 予約に対する使用アクションを検索する
 */
// tslint:disable-next-line:use-default-type-parameter
reservationsRouter.get<ParamsDictionary>(
    '/:id/actions/use',
    permitScopes(['reservations.read']),
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
            // const now = new Date();
            const reservationId = req.params.id;

            const actionRepo = new cinerino.repository.Action(mongoose.connection);

            // 予約使用アクションを検索
            const searchConditions: cinerino.factory.action.ISearchConditions<cinerino.factory.actionType.UseAction> = {
                // ページング未実装、いったん100限定でも要件は十分満たされるか
                // tslint:disable-next-line:no-magic-numbers
                limit: 100,
                sort: { startDate: cinerino.factory.sortType.Descending },
                project: { id: { $eq: req.project.id } },
                typeOf: cinerino.factory.actionType.UseAction,
                object: {
                    typeOf: { $in: [cinerino.factory.chevre.reservationType.EventReservation] },
                    id: { $in: [reservationId] }
                },
                startFrom: (req.query.startFrom instanceof Date)
                    ? req.query.startFrom
                    : undefined,
                startThrough: (req.query.startThrough instanceof Date)
                    ? req.query.startThrough
                    : undefined
            };

            const actions = await actionRepo.search(searchConditions);

            res.json(actions);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * chevre予約使用アクション取消
 */
// tslint:disable-next-line:use-default-type-parameter
reservationsRouter.put<ParamsDictionary>(
    `/:id/actions/use/:actionId/${cinerino.factory.actionStatusType.CanceledActionStatus}`,
    // ひとまずuserロールで実行できるように↓
    permitScopes(['projects.read']),
    rateLimit,
    ...[
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionService = new cinerino.chevre.service.Action({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            await actionService.cancelById({
                id: req.params.actionId
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 予約取消
 */
reservationsRouter.put(
    '/cancel',
    permitScopes(['reservations.*', 'reservations.cancel']),
    validator,
    async (req, res, next) => {
        try {
            const cancelReservationService = new cinerino.chevre.service.transaction.CancelReservation({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            await cancelReservationService.startAndConfirm({
                project: { typeOf: req.project.typeOf, id: req.project.id },
                typeOf: cinerino.factory.chevre.transactionType.CancelReservation,
                expires: moment()
                    .add(1, 'minute')
                    .toDate(),
                agent: {
                    ...req.body.agent
                },
                object: {
                    ...req.body.object
                },
                potentialActions: {
                    ...req.body.potentialActions
                }
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
            next(error);
        }
    }
);

export default reservationsRouter;
