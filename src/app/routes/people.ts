/**
 * 会員ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as moment from 'moment';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const peopleRouter = Router();
peopleRouter.use(authentication);

/**
 * 会員検索
 */
peopleRouter.get(
    '',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const people = await personRepo.search({
                userPooId: <string>process.env.COGNITO_USER_POOL_ID,
                id: req.query.id,
                username: req.query.username,
                email: req.query.email,
                telephone: req.query.telephone,
                givenName: req.query.givenName,
                familyName: req.query.familyName
            });
            res.set('X-Total-Count', people.length.toString());
            res.json(people);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDで検索
 */
peopleRouter.get(
    '/:id',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const person = await personRepo.findById({
                userPooId: <string>process.env.COGNITO_USER_POOL_ID,
                userId: req.params.id
            });
            res.json(person);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 所有権検索
 */
peopleRouter.get(
    '/:id/ownershipInfos',
    permitScopes(['aws.cognito.signin.user.admin']),
    (_1, _2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const query = <cinerino.factory.ownershipInfo.ISearchConditions<cinerino.factory.ownershipInfo.IGoodType>>req.query;
            const typeOfGood = query.typeOfGood;
            let ownershipInfos:
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail<typeof typeOfGood.typeOf>>[];
            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions<typeof typeOfGood.typeOf> = {
                // tslint:disable-next-line:no-magic-numbers
                limit: (query.limit !== undefined) ? Math.min(query.limit, 100) : 100,
                page: (query.page !== undefined) ? Math.max(query.page, 1) : 1,
                sort: (query.sort !== undefined) ? query.sort : { ownedFrom: cinerino.factory.sortType.Descending },
                ownedBy: { id: req.params.id },
                ownedFrom: (query.ownedFrom !== undefined) ? moment(query.ownedFrom).toDate() : undefined,
                ownedThrough: (query.ownedThrough !== undefined) ? moment(query.ownedThrough).toDate() : undefined,
                typeOfGood: typeOfGood
            };
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const totalCount = await ownershipInfoRepo.count(searchConditions);
            switch (typeOfGood.typeOf) {
                case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                    const accountService = new cinerino.pecorinoapi.service.Account({
                        endpoint: <string>process.env.PECORINO_ENDPOINT,
                        auth: pecorinoAuthClient
                    });
                    ownershipInfos = await cinerino.service.account.search({ ...searchConditions, typeOfGood: typeOfGood })({
                        ownershipInfo: ownershipInfoRepo,
                        accountService: accountService
                    });
                    break;
                case cinerino.factory.chevre.reservationType.EventReservation:
                    const reservationService = new cinerino.chevre.service.Reservation({
                        endpoint: <string>process.env.CHEVRE_ENDPOINT,
                        auth: chevreAuthClient
                    });
                    ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(
                        { ...searchConditions, typeOfGood: typeOfGood }
                    )({
                        ownershipInfo: ownershipInfoRepo,
                        reservationService: reservationService
                    });
                    break;

                default:
                    throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
            }
            res.set('X-Total-Count', totalCount.toString());
            res.json(ownershipInfos);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * クレジットカード検索
 */
peopleRouter.get(
    '/:id/ownershipInfos/creditCards',
    permitScopes(['admin']),
    async (req, res, next) => {
        try {
            const searchCardResults = await cinerino.service.person.creditCard.find(req.params.id)();
            res.json(searchCardResults);
        } catch (error) {
            next(error);
        }
    }
);

export default peopleRouter;
