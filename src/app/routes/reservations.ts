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

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

type IPayload = cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>;

const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;

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

            // totalCount対応
            if (typeof searchResult.totalCount === 'number') {
                res.set('X-Total-Count', String(searchResult.totalCount));
            }

            res.json(searchResult.data);
        } catch (error) {
            error = cinerino.errorHandler.handleChevreError(error);
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
        body('agent.identifier')
            .optional()
            .isArray({ max: 10 }),
        body('agent.identifier.*.name')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
        body('agent.identifier.*.value')
            .optional()
            .not()
            .isEmpty()
            .isString()
            .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
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
                    const orderService = new cinerino.chevre.service.Order({
                        endpoint: cinerino.credentials.chevre.endpoint,
                        auth: chevreAuthClient
                    });

                    // 注文検索
                    const order = await orderService.findByOrderNumber({ orderNumber: (<any>payload).orderNumber });

                    const acceptedOffer = order.acceptedOffers.find((offer) => {
                        return offer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation
                            && (<cinerino.factory.order.IReservation>offer.itemOffered).id === reservationId;
                    });
                    if (acceptedOffer === undefined) {
                        throw new cinerino.factory.errors.NotFound('AcceptedOffer');
                    }

                    const chevreUseAction = await useReservation({
                        project: { id: req.project.id },
                        agent: {
                            ...req.agent,
                            identifier: [
                                ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                                ...(Array.isArray(req.body.agent?.identifier))
                                    ? (<any[]>req.body.agent.identifier).map((p: any) => {
                                        return { name: String(p.name), value: String(p.value) };
                                    })
                                    : []
                            ]
                        },
                        object: { id: (<cinerino.factory.order.IReservation>acceptedOffer.itemOffered).id },
                        instrument: { token },
                        location: { identifier: (typeof locationIdentifier === 'string') ? locationIdentifier : undefined }
                    })();

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
    return async () => {
        // 予約検索
        const reservationService = new cinerino.chevre.service.Reservation({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const reservation = await reservationService.findById<cinerino.factory.chevre.reservationType.EventReservation>({
            id: params.object.id
        });

        let chevreUseAction: { id: string } | undefined;

        try {
            // 入場
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
            throw error;
        }

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
            const reservationId = req.params.id;

            // Chevreアクション検索で実装する
            const actionService = new cinerino.chevre.service.Action({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const searchActionsResult = await actionService.search({
                limit: 100,
                sort: { startDate: cinerino.factory.sortType.Descending },
                project: { id: { $eq: req.project.id } },
                typeOf: { $eq: cinerino.factory.chevre.actionType.UseAction },
                actionStatus: { $in: [cinerino.factory.chevre.actionStatusType.CompletedActionStatus] },
                object: {
                    typeOf: { $eq: cinerino.factory.chevre.reservationType.EventReservation },
                    ...{
                        id: { $eq: reservationId }
                    }
                }
            });

            res.json(searchActionsResult.data);
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
