/**
 * 自分の予約ルーター
 */
// import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// import { CREATED, NO_CONTENT } from 'http-status';
// import * as moment from 'moment';

// import permitScopes from '../../../../middlewares/permitScopes';
// import validator from '../../../../middlewares/validator';

const reservationsRouter = Router();
// const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
//     domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
//     clientId: <string>process.env.CHEVRE_CLIENT_ID,
//     clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
//     scopes: [],
//     state: ''
// });
/**
 * 上映イベント予約検索
 */
// reservationsRouter.get(
//     '/eventReservation/screeningEvent',
//     permitScopes(['aws.cognito.signin.user.admin']),
//     validator,
//     async (req, res, next) => {
//         try {
//             const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
//             const reservationService = new cinerino.chevre.service.Reservation({
//                 endpoint: <string>process.env.CHEVRE_ENDPOINT,
//                 auth: chevreAuthClient
//             });
//             const searchConditions:
//                 cinerino.factory.ownershipInfo.ISearchConditions<cinerino.factory.chevre.reservationType.EventReservation> = {
//                 // tslint:disable-next-line:no-magic-numbers
//                 limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
//                 page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
//                 sort: (req.query.sort !== undefined) ? req.query.sort : { ownedFrom: cinerino.factory.sortType.Descending },
//                 ownedBy: {
//                     id: req.user.sub
//                 },
//                 ownedFrom: (req.query.ownedFrom !== undefined) ? moment(req.query.ownedFrom).toDate() : undefined,
//                 ownedThrough: (req.query.ownedThrough !== undefined) ? moment(req.query.ownedThrough).toDate() : undefined,
//                 typeOfGood: {
//                     typeOf: cinerino.factory.chevre.reservationType.EventReservation,
//                     id: req.query.typeOfGood.id
//                 }
//             };
//             const totalCount = await ownershipInfoRepo.count(searchConditions);
//             const ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(searchConditions)({
//                 ownershipInfo: ownershipInfoRepo,
//                 reservationService: reservationService
//             });
//             res.set('X-Total-Count', totalCount.toString());
//             res.json(ownershipInfos);
//         } catch (error) {
//             next(error);
//         }
//     }
// );
export default reservationsRouter;
