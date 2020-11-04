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
        body('instrument.token')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('object.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            const token = <string>req.body.instrument?.token;
            const reservationId = <string>req.body.object?.id;

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

                    await useReservation({
                        project: { id: req.project.id },
                        agent: req.agent,
                        object: { id: (<cinerino.factory.order.IReservation>acceptedOffer.itemOffered).id },
                        instrument: { token }
                    })({ action: new cinerino.repository.Action(mongoose.connection) });

                    res.status(NO_CONTENT)
                        .end();

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

/**
 * トークンで予約照会
 * @deprecated Use /reservations/use
 */
reservationsRouter.post(
    '/eventReservation/screeningEvent/findByToken',
    permitScopes(['reservations.read', 'reservations.findByToken']),
    rateLimit,
    ...[
        body('token')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
    ],
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);

            const payload = await cinerino.service.code.verifyToken<IPayload>({
                project: req.project,
                agent: req.agent,
                token: req.body.token,
                secret: <string>process.env.TOKEN_SECRET,
                issuer: [<string>process.env.RESOURCE_SERVER_IDENTIFIER]
            })({});

            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);

            // 所有権検索
            const ownershipInfo = await ownershipInfoRepo.findById({
                id: payload.id
            });
            const typeOfGood = <cinerino.factory.ownershipInfo.IReservation>ownershipInfo.typeOfGood;
            if (typeOfGood.typeOf !== cinerino.factory.chevre.reservationType.EventReservation) {
                throw new cinerino.factory.errors.Argument('token', 'Not reservation');
            }

            await useReservation({
                project: { id: req.project.id },
                agent: req.agent,
                object: { id: <string>typeOfGood.id },
                instrument: { token: req.body.token }
            })({ action: actionRepo });

            // const reservation = useAction.object[0];

            // レスポンスをフロントアプリ側で使用していなかったので削除
            // res.json({ ...ownershipInfo, typeOfGood: reservation });
            res.json({});
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

        try {
            await reservationService.attendScreeningEvent({ id: reservation.id });
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

        return repos.action.complete({ typeOf: action.typeOf, id: action.id, result: {} });
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
