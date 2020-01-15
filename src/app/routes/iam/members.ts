/**
 * プロジェクトメンバールーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

import iamMeRouter from './members/me';

import { RoleName } from '../../iam';

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});

const iamMembersRouter = express.Router();

iamMembersRouter.use('/me', iamMeRouter);

/**
 * プロジェクトメンバー追加
 */
iamMembersRouter.post(
    '',
    permitScopes([]),
    rateLimit,
    ...[
        body('member')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('member.applicationCategory')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isIn(['customer', 'admin']),
        body('member.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('member.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isIn([cinerino.factory.personType.Person, cinerino.factory.creativeWorkType.WebApplication]),
        body('member.hasRole')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isArray(),
        body('member.hasRole.*.roleName')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
    ],
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
            }

            let member;

            // ロールをひとつに限定
            const role = {
                typeOf: 'OrganizationRole',
                roleName: (<any[]>req.body.member.hasRole).shift().roleName,
                memberOf: { typeOf: project.typeOf, id: project.id }
            };

            const applicationCategory = req.body.member.applicationCategory;
            let userPoolClient: cinerino.AWS.CognitoIdentityServiceProvider.UserPoolClientType;

            switch (applicationCategory) {
                case 'customer':
                    // カスタマーロールの場合
                    const customerUserPoolId = project.settings.cognito.customerUserPool.id;

                    // クライアント検索
                    userPoolClient =
                        await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.UserPoolClientType>((resolve, reject) => {
                            cognitoIdentityServiceProvider.describeUserPoolClient(
                                {
                                    UserPoolId: customerUserPoolId,
                                    ClientId: req.body.member.id
                                },
                                (err, data) => {
                                    if (err instanceof Error) {
                                        reject(err);
                                    } else {
                                        if (data.UserPoolClient === undefined) {
                                            reject(new cinerino.factory.errors.NotFound('UserPoolClient'));
                                        } else {
                                            resolve(data.UserPoolClient);
                                        }
                                    }
                                }
                            );
                        });

                    member = {
                        typeOf: cinerino.factory.creativeWorkType.WebApplication,
                        id: userPoolClient.ClientId,
                        name: userPoolClient.ClientName,
                        hasRole: [{
                            typeOf: 'OrganizationRole',
                            roleName: RoleName.Customer,
                            memberOf: { typeOf: project.typeOf, id: project.id }
                        }]
                    };

                    break;

                default:
                    // 管理者ロールの場合
                    const adminUserPoolId = project.settings.cognito.adminUserPool.id;

                    switch (req.body.member.typeOf) {
                        case cinerino.factory.personType.Person:
                            const personRepo = new cinerino.repository.Person({
                                userPoolId: adminUserPoolId
                            });
                            const people = await personRepo.search({ id: req.body.member.id });
                            if (people[0].memberOf === undefined) {
                                throw new cinerino.factory.errors.NotFound('Administrator.memberOf');
                            }

                            member = {
                                typeOf: people[0].typeOf,
                                id: people[0].id,
                                username: people[0].memberOf.membershipNumber,
                                hasRole: [role]
                            };

                            break;

                        case cinerino.factory.creativeWorkType.WebApplication:
                            // クライアント検索
                            userPoolClient =
                                await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.UserPoolClientType>((resolve, reject) => {
                                    cognitoIdentityServiceProvider.describeUserPoolClient(
                                        {
                                            UserPoolId: customerUserPoolId,
                                            ClientId: req.body.member.id
                                        },
                                        (err, data) => {
                                            if (err instanceof Error) {
                                                reject(err);
                                            } else {
                                                if (data.UserPoolClient === undefined) {
                                                    reject(new cinerino.factory.errors.NotFound('UserPoolClient'));
                                                } else {
                                                    resolve(data.UserPoolClient);
                                                }
                                            }
                                        }
                                    );
                                });

                            member = {
                                typeOf: cinerino.factory.creativeWorkType.WebApplication,
                                id: userPoolClient.ClientId,
                                name: userPoolClient.ClientName,
                                hasRole: [{
                                    typeOf: 'OrganizationRole',
                                    roleName: RoleName.Customer,
                                    memberOf: { typeOf: project.typeOf, id: project.id }
                                }]
                            };

                            break;

                        default:
                            throw new cinerino.factory.errors.Argument('member.typeOf', 'member type not supported');
                    }
            }

            await memberRepo.memberModel.create({
                project: { typeOf: project.typeOf, id: project.id },
                typeOf: 'OrganizationRole',
                member: member
            });

            res.status(CREATED)
                .json(member);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバー検索
 */
iamMembersRouter.get(
    '',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: any = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const members = await memberRepo.search(searchCoinditions);
            const totalCount = await memberRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(members);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバー取得
 */
iamMembersRouter.get(
    '/:id',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const members = await memberRepo.search({
                member: { id: { $eq: req.params.id } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            res.json(members[0].member);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバー削除
 */
iamMembersRouter.delete(
    '/:id',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const doc = await memberRepo.memberModel.findOneAndDelete({
                'member.id': {
                    $eq: req.params.id
                },
                'project.id': {
                    $eq: req.project.id
                }
            })
                .exec();
            if (doc === null) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバープロフィール取得
 */
iamMembersRouter.get(
    '/:id/profile',
    permitScopes([]),
    rateLimit,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const members = await memberRepo.search({
                member: { id: { $eq: req.params.id } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            const member = members[0].member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const person = await personRepo.findById({
                userId: member.id
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
 * プロジェクトメンバープロフィール更新
 */
iamMembersRouter.patch(
    '/:id/profile',
    permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const project = await projectRepo.findById({ id: req.project.id });
            if (project.settings === undefined
                || project.settings.cognito === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
            }

            const members = await memberRepo.search({
                member: { id: { $eq: req.params.id } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            const member = members[0].member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.adminUserPool.id
            });
            const person = await personRepo.findById({
                userId: member.id
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

export default iamMembersRouter;