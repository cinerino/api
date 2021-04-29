/**
 * 会員ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { query } from 'express-validator';
import { NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const peopleRouter = Router();

/**
 * 会員検索
 */
peopleRouter.get(
    '',
    permitScopes(['people.*', 'people.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });
            if (project.settings?.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const people = await personRepo.search({
                id: req.query.id,
                username: req.query.username,
                email: req.query.email,
                telephone: req.query.telephone,
                givenName: req.query.givenName,
                familyName: req.query.familyName
            });

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
    permitScopes(['people.*', 'people.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });
            if (project.settings?.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const person = await personRepo.findById({
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
    permitScopes(['people.*', 'people.delete']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });
            if (project.settings?.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const credentials = await cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
                project: { id: req.project.id },
                paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
            });

            const actionRepo = new cinerino.repository.Action(mongoose.connection);
            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: credentials.siteId,
                sitePass: credentials.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
            });
            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            const person = await personRepo.findById({
                userId: req.params.id
            });

            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            // 現在所有している会員プログラムを全て検索
            const now = new Date();
            const searchOwnershipInfosResult = await ownershipInfoService.search({
                project: { id: { $eq: req.project.id } },
                typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
                ownedBy: { id: person.id },
                ownedFrom: now,
                ownedThrough: now
            });
            const ownershipInfos = searchOwnershipInfosResult.data;

            // 所有が確認できれば、会員プログラム登録解除タスクを作成する
            const unRegisterActionAttributes: cinerino.factory.action.interact.unRegister.programMembership.IAttributes[]
                = ownershipInfos.map((o) => {
                    return {
                        project: { id: o.project?.id, typeOf: o.project?.typeOf },
                        typeOf: cinerino.factory.actionType.UnRegisterAction,
                        agent: req.agent,
                        object: {
                            ...<any>o.typeOfGood,
                            member: [person]
                        }
                    };
                });

            // 会員削除タスクを作成
            const deleteMemberAction: cinerino.factory.action.update.deleteAction.member.IAttributes = {
                agent: req.agent,
                object: person,
                project: req.project,
                potentialActions: {
                    unRegisterProgramMembership: unRegisterActionAttributes
                },
                typeOf: cinerino.factory.actionType.DeleteAction
            };

            await cinerino.service.customer.deleteMember({
                ...deleteMemberAction,
                physically: req.body.physically === true
            })({
                action: actionRepo,
                creditCard: creditCardRepo,
                person: personRepo,
                project: projectService,
                task: taskRepo
            });

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
// tslint:disable-next-line:use-default-type-parameter
peopleRouter.get<ParamsDictionary>(
    '/:id/ownershipInfos',
    permitScopes(['people.*', 'people.read']),
    rateLimit,
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
            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const searchPaymentCardProductsResult = await productService.search({
                limit: 100,
                project: { id: { $eq: req.project.id } },
                typeOf: { $eq: cinerino.factory.chevre.product.ProductType.PaymentCard }
            });
            const paymentCardProducts = searchPaymentCardProductsResult.data;
            const paymentCardOutputTypes = [...new Set(paymentCardProducts.map((p) => String(p.serviceOutput?.typeOf)))];

            let ownershipInfos:
                cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGoodWithDetail>[]
                | cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.ownershipInfo.IGood>[];

            const searchConditions: cinerino.factory.ownershipInfo.ISearchConditions = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1,
                ownedBy: { id: req.params.id }
            };

            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            const typeOfGood = <cinerino.factory.ownershipInfo.ITypeOfGoodSearchConditions>req.query.typeOfGood;
            switch (true) {
                case paymentCardOutputTypes.includes(String(typeOfGood.typeOf)):
                    ownershipInfos = await cinerino.service.account.search({
                        project: req.project,
                        conditions: searchConditions
                    })({
                        ownershipInfo: ownershipInfoService
                    });

                    break;

                case cinerino.factory.chevre.reservationType.EventReservation === typeOfGood.typeOf:
                    ownershipInfos = await cinerino.service.reservation.searchScreeningEventReservations(<any>{
                        ...searchConditions,
                        project: { typeOf: req.project.typeOf, id: req.project.id }
                    })({
                        ownershipInfo: ownershipInfoService
                    });

                    break;

                default:
                    const searchOwnershipInfosResult = await ownershipInfoService.search(searchConditions);
                    ownershipInfos = searchOwnershipInfosResult.data;
                // throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
            }

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
    permitScopes(['people.*', 'people.read']),
    rateLimit,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });
            if (project.settings?.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const useUsernameAsGMOMemberId = project.settings?.useUsernameAsGMOMemberId === true;

            let memberId = req.params.id;

            if (useUsernameAsGMOMemberId) {
                const personRepo = new cinerino.repository.Person({
                    userPoolId: project.settings.cognito.customerUserPool.id
                });
                const person = await personRepo.findById({
                    userId: req.params.id
                });
                if (person.memberOf === undefined) {
                    throw new cinerino.factory.errors.NotFound('Person');
                }

                memberId = <string>person.memberOf.membershipNumber;
            }

            const credentials = await cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
                project: { id: req.project.id },
                paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
            });

            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: credentials.siteId,
                sitePass: credentials.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
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
    permitScopes(['people.*', 'people.creditCards.delete']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });
            if (project.settings?.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            let memberId = req.params.id;

            const useUsernameAsGMOMemberId = project.settings?.useUsernameAsGMOMemberId === true;

            if (useUsernameAsGMOMemberId) {
                const personRepo = new cinerino.repository.Person({
                    userPoolId: project.settings.cognito.customerUserPool.id
                });
                const person = await personRepo.findById({
                    userId: req.params.id
                });
                if (person.memberOf === undefined) {
                    throw new cinerino.factory.errors.NotFound('Person');
                }

                memberId = <string>person.memberOf.membershipNumber;
            }

            const credentials = await cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
                project: { id: req.project.id },
                paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
            });

            const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
                siteId: credentials.siteId,
                sitePass: credentials.sitePass,
                cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
            });
            await creditCardRepo.deleteBySequenceNumber({
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
    permitScopes(['people.*', 'people.read']),
    rateLimit,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });
            if (project.settings?.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const person = await personRepo.findById({
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
    permitScopes(['people.*', 'people.profile.update']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });
            if (project.settings?.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const person = await personRepo.findById({
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
