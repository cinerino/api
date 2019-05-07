/**
 * 会員ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { NO_CONTENT } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});

const pecorinoAuthClient = new cinerino.pecorinoapi.auth.ClientCredentials({
    domain: <string>process.env.PECORINO_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.PECORINO_CLIENT_ID,
    clientSecret: <string>process.env.PECORINO_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const USER_POOL_ID = <string>process.env.COGNITO_USER_POOL_ID;

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
                userPooId: USER_POOL_ID,
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
                userPooId: USER_POOL_ID,
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
    permitScopes(['admin']),
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
                sort: query.sort,
                ownedBy: { id: req.params.id },
                ownedFrom: (query.ownedFrom !== undefined) ? moment(query.ownedFrom)
                    .toDate() : undefined,
                ownedThrough: (query.ownedThrough !== undefined) ? moment(query.ownedThrough)
                    .toDate() : undefined,
                typeOfGood: typeOfGood
            };
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const totalCount = await ownershipInfoRepo.count(searchConditions);

            switch (typeOfGood.typeOf) {
                case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                    const accountService = new cinerino.pecorinoapi.service.Account({
                        endpoint: <string>process.env.PECORINO_ENDPOINT,
                        auth: pecorinoAuthClient
                    });
                    ownershipInfos = await cinerino.service.account.search(searchConditions)({
                        ownershipInfo: ownershipInfoRepo,
                        accountService: accountService
                    });
                    break;

                case cinerino.factory.chevre.reservationType.EventReservation:
                    ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(searchConditions)({
                        ownershipInfo: ownershipInfoRepo,
                        project: projectRepo
                    });
                    break;

                default:
                    ownershipInfos = await ownershipInfoRepo.search(searchConditions);
                // throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
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
            let memberId = req.params.id;

            if (USE_USERNAME_AS_GMO_MEMBER_ID) {
                const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
                const person = await personRepo.findById({
                    userPooId: USER_POOL_ID,
                    userId: req.params.id
                });
                if (person.memberOf === undefined) {
                    throw new cinerino.factory.errors.NotFound('Person');
                }

                memberId = <string>person.memberOf.membershipNumber;
            }

            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: <string>process.env.GMO_SITE_ID,
                sitePass: <string>process.env.GMO_SITE_PASS,
                cardService: new cinerino.GMO.service.Card({ endpoint: <string>process.env.GMO_ENDPOINT })
            });
            const searchCardResults = await creditCardRepo.search({ personId: memberId });

            res.json(searchCardResults);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロフィール検索
 */
peopleRouter.get(
    '/:id/profile',
    permitScopes(['admin']),
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const person = await personRepo.findById({
                userPooId: USER_POOL_ID,
                userId: req.params.id
            });

            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf');
            }

            const username = person.memberOf.membershipNumber;
            if (username === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
            }

            const profile = await personRepo.getUserAttributes({
                userPooId: USER_POOL_ID,
                username: username
            });

            res.json(profile);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロフィール更新
 */
peopleRouter.patch(
    '/:id/profile',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const personRepo = new cinerino.repository.Person(cognitoIdentityServiceProvider);
            const person = await personRepo.findById({
                userPooId: USER_POOL_ID,
                userId: req.params.id
            });

            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf');
            }

            const username = person.memberOf.membershipNumber;
            if (username === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
            }

            await personRepo.updateProfile({
                userPooId: USER_POOL_ID,
                username: username,
                profile: req.body
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default peopleRouter;
