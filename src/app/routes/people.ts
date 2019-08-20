/**
 * 会員ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { query } from 'express-validator/check';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../middlewares/authentication';
import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';

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
            const personRepo = new cinerino.repository.Person();
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
            const personRepo = new cinerino.repository.Person();
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
 * IDで削除
 */
peopleRouter.delete(
    '/:id',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const personRepo = new cinerino.repository.Person();
            const person = await personRepo.findById({
                userPooId: USER_POOL_ID,
                userId: req.params.id
            });

            const deleteActionAttributes = {
                agent: req.agent,
                object: person,
                project: { typeOf: req.project.typeOf, id: req.project.id },
                typeOf: <any>'DeleteAction'
            };
            const action = await actionRepo.start(deleteActionAttributes);

            try {
                await personRepo.deleteById({
                    userPooId: USER_POOL_ID,
                    userId: req.params.id
                });
            } catch (error) {
                // actionにエラー結果を追加
                try {
                    const actionError = { ...error, message: error.message, name: error.name };
                    await actionRepo.giveUp({ typeOf: action.typeOf, id: action.id, error: actionError });
                } catch (__) {
                    // 失敗したら仕方ない
                }

                throw error;
            }

            await actionRepo.complete({ typeOf: action.typeOf, id: action.id, result: {} });

            res.status(NO_CONTENT)
                .end();
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
    ...[
        query('typeOfGood')
            .not()
            .isEmpty(),
        query('offers.ownedFrom')
            .optional()
            .isISO8601()
            .toDate(),
        query('offers.ownedThrough')
            .optional()
            .isISO8601()
            .toDate()
    ],
    validator,
    async (req, res, next) => {
        try {
            let ownershipInfos:
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail<typeof typeOfGood.typeOf>>[];
            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions<typeof typeOfGood.typeOf> = {
                ...req.query,
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                ownedBy: { id: req.params.id }
            };
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const totalCount = await ownershipInfoRepo.count(searchConditions);

            const typeOfGood = <cinerino.factory.ownershipInfo.ITypeOfGoodSearchConditions<any>>req.query.typeOfGood;
            switch (typeOfGood.typeOf) {
                case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                    ownershipInfos = await cinerino.service.account.search({
                        project: req.project,
                        conditions: searchConditions
                    })({
                        ownershipInfo: ownershipInfoRepo,
                        project: projectRepo
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.gmo === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            let memberId = req.params.id;

            if (USE_USERNAME_AS_GMO_MEMBER_ID) {
                const personRepo = new cinerino.repository.Person();
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
                siteId: project.settings.gmo.siteId,
                sitePass: project.settings.gmo.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
            });
            const searchCardResults = await creditCardRepo.search({ personId: memberId });

            res.json(searchCardResults);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員クレジットカード削除
 */
peopleRouter.delete(
    '/:id/ownershipInfos/creditCards/:cardSeq',
    permitScopes(['admin']),
    validator,
    async (req, res, next) => {
        try {
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }
            if (project.settings.gmo === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
            }

            let memberId = req.params.id;

            if (USE_USERNAME_AS_GMO_MEMBER_ID) {
                const personRepo = new cinerino.repository.Person();
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
                siteId: project.settings.gmo.siteId,
                sitePass: project.settings.gmo.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
            });
            await creditCardRepo.remove({
                personId: memberId,
                cardSeq: req.params.cardSeq
            });

            res.status(NO_CONTENT)
                .end();
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
            const personRepo = new cinerino.repository.Person();
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
            const personRepo = new cinerino.repository.Person();
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
