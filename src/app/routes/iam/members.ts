/**
 * プロジェクトメンバールーター
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

import iamMeRouter from './members/me';

import { RoleName } from '../../iam';

const ADMIN_USER_POOL_ID = <string>process.env.ADMIN_USER_POOL_ID;

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
    permitScopes(['iam.members.write']),
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
        body('member.name')
            .optional()
            .isString(),
        body('member.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isIn([cinerino.factory.personType.Person, cinerino.factory.chevre.creativeWorkType.WebApplication]),
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
                        typeOf: cinerino.factory.chevre.creativeWorkType.WebApplication,
                        id: userPoolClient.ClientId,
                        name: (typeof req.body.member?.name === 'string')
                            ? String(req.body.member.name)
                            : userPoolClient.ClientName,
                        hasRole: [{
                            typeOf: 'OrganizationRole',
                            roleName: RoleName.Customer,
                            memberOf: { typeOf: project.typeOf, id: project.id }
                        }]
                    };

                    break;

                default:
                    // 管理者ロールの場合
                    const adminUserPoolId = ADMIN_USER_POOL_ID;

                    switch (req.body.member.typeOf) {
                        case cinerino.factory.personType.Person:
                            // ロールを作成
                            const roles = (<any[]>req.body.member.hasRole).map((r: any) => {
                                return {
                                    typeOf: 'OrganizationRole',
                                    roleName: <string>r.roleName,
                                    memberOf: { typeOf: project.typeOf, id: project.id }
                                };
                            });

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
                                name: (typeof req.body.member?.name === 'string')
                                    ? String(req.body.member.name)
                                    : people[0].memberOf.membershipNumber,
                                username: people[0].memberOf.membershipNumber,
                                hasRole: roles
                            };

                            break;

                        case cinerino.factory.chevre.creativeWorkType.WebApplication:
                            // クライアント検索
                            userPoolClient =
                                await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.UserPoolClientType>((resolve, reject) => {
                                    cognitoIdentityServiceProvider.describeUserPoolClient(
                                        {
                                            UserPoolId: adminUserPoolId,
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
                                typeOf: cinerino.factory.chevre.creativeWorkType.WebApplication,
                                id: userPoolClient.ClientId,
                                name: (typeof req.body.member?.name === 'string')
                                    ? String(req.body.member.name)
                                    : userPoolClient.ClientName,
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

            const doc = await memberRepo.memberModel.create({
                project: { typeOf: project.typeOf, id: project.id },
                typeOf: 'OrganizationRole',
                member: member
            });

            res.status(CREATED)
                .json(doc.toObject());
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
    permitScopes(['iam.members.read']),
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
    permitScopes(['iam.members.read']),
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
                throw new cinerino.factory.errors.NotFound(memberRepo.memberModel.modelName);
            }

            res.json(members[0]);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクトメンバー更新
 */
// tslint:disable-next-line:use-default-type-parameter
iamMembersRouter.put<ParamsDictionary>(
    '/:id',
    permitScopes(['iam.members.write']),
    rateLimit,
    ...[
        body('member')
            .not()
            .isEmpty()
            .withMessage(() => 'required'),
        body('member.name')
            .optional()
            .isString(),
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
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);

            // ロールを作成
            const roles = (<any[]>req.body.member.hasRole).map((r: any) => {
                return {
                    typeOf: 'OrganizationRole',
                    roleName: <string>r.roleName,
                    memberOf: { typeOf: req.project.typeOf, id: req.project.id }
                };
            });

            const name: string | undefined = req.body.member?.name;

            const doc = await memberRepo.memberModel.findOneAndUpdate(
                {
                    'member.id': {
                        $eq: req.params.id
                    },
                    'project.id': {
                        $eq: req.project.id
                    }
                },
                {
                    'member.hasRole': roles,
                    ...(typeof name === 'string') ? { 'member.name': name } : undefined
                }
            )
                .exec();

            if (doc === null) {
                throw new cinerino.factory.errors.NotFound(memberRepo.memberModel.modelName);
            }

            res.status(NO_CONTENT)
                .end();
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
    permitScopes(['iam.members.write']),
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
                throw new cinerino.factory.errors.NotFound(memberRepo.memberModel.modelName);
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
    permitScopes(['iam.members.profile.read']),
    rateLimit,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);

            const members = await memberRepo.search({
                member: { id: { $eq: req.params.id } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound(memberRepo.memberModel.modelName);
            }

            const member = members[0].member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: ADMIN_USER_POOL_ID
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
    permitScopes(['iam.members.profile.write']),
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
                throw new cinerino.factory.errors.NotFound(memberRepo.memberModel.modelName);
            }

            const member = members[0].member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: ADMIN_USER_POOL_ID
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
