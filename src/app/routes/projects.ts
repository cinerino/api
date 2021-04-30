/**
 * プロジェクトルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { body } from 'express-validator';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

import { RoleName } from '../iam';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const ADMIN_USER_POOL_ID = <string>process.env.ADMIN_USER_POOL_ID;

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;
const TOKEN_ISSUERS_AS_ADMIN: string[] = (typeof process.env.TOKEN_ISSUERS_AS_ADMIN === 'string')
    ? process.env.TOKEN_ISSUERS_AS_ADMIN.split(',')
    : [];

const projectsRouter = Router();

/**
 * プロジェクト作成
 * 同時に作成者はプロジェクトオーナーになります
 */
projectsRouter.post(
    '',
    // permitScopes([]),
    rateLimit,
    ...[
        body('typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('name')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('logo')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isURL(),
        body('parentOrganization.typeOf')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('parentOrganization.name.ja')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('parentOrganization.name.en')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.cognito.customerUserPool.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);

            const project = createFromBody(req.body);

            let member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: ADMIN_USER_POOL_ID
            });
            const people = await personRepo.search({ id: req.user.sub });
            if (people[0].memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Administrator.memberOf');
            }

            member = {
                typeOf: people[0].typeOf,
                id: people[0].id,
                username: people[0].memberOf.membershipNumber,
                hasRole: [{
                    typeOf: 'OrganizationRole',
                    roleName: RoleName.Owner,
                    memberOf: { typeOf: project.typeOf, id: project.id }
                }]
            };

            // プロジェクト作成
            // project = await projectRepo.projectModel.create({ ...project, _id: project.id })
            //     .then((doc) => doc.toObject());

            // 権限作成
            await memberRepo.memberModel.create({
                project: { typeOf: project.typeOf, id: project.id },
                typeOf: 'OrganizationRole',
                member: member
            });

            // chevreでプロジェクト作成
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            await projectService.create({
                typeOf: cinerino.factory.chevre.organizationType.Project,
                id: project.id,
                logo: project.logo,
                name: (typeof project.name === 'string') ? project.name : undefined,
                parentOrganization: project.parentOrganization,
                settings: project.settings
            });

            res.status(CREATED)
                .json(project);
        } catch (error) {
            next(error);
        }
    }
);

function createFromBody(params: any): cinerino.factory.project.IProject {
    return {
        id: params.id,
        typeOf: params.typeOf,
        logo: params.logo,
        name: params.name,
        parentOrganization: params.parentOrganization,
        settings: {
            cognito: {
                customerUserPool: {
                    id: params.settings?.cognito?.customerUserPool?.id
                }
            },
            onOrderStatusChanged: {
                informOrder: (Array.isArray(params.settings?.onOrderStatusChanged?.informOrder))
                    ? params.settings.onOrderStatusChanged.informOrder
                    : []
            },
            useUsernameAsGMOMemberId: false,
            ...(typeof params.settings?.sendgridApiKey === 'string' && params.settings.sendgridApiKey.length > 0)
                ? { sendgridApiKey: params.settings.sendgridApiKey }
                : undefined
        }
    };
}

/**
 * プロジェクト検索
 * 閲覧権限を持つプロジェクトを検索
 */
projectsRouter.get(
    '',
    // permitScopes([]),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            // tslint:disable-next-line:no-magic-numbers
            const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
            const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;

            // 権限を持つプロジェクト検索
            let searchConditions: any;
            if (TOKEN_ISSUERS_AS_ADMIN.includes(req.user.iss)) {
                // 管理ユーザープールのクライアントであればreq.user.subとして検索
                searchConditions = {
                    'member.id': { $eq: req.user.sub }
                };
            } else {
                // それ以外であればreq.user.client_idとして検索
                searchConditions = {
                    'member.id': { $eq: req.user.client_id }
                };
            }

            const projectMembers = await memberRepo.memberModel.find(
                searchConditions,
                { project: 1 }
            )
                .limit(limit)
                .skip(limit * (page - 1))
                .setOptions({ maxTimeMS: 10000 })
                .exec()
                .then((docs) => docs.map((doc) => doc.toObject()));

            let projectIds = projectMembers.map((m) => m.project.id);
            // length=1だとidsの指定がない検索になってしまうので、ありえないプロジェクトIDで保管
            if (projectIds.length === 0) {
                projectIds = ['***NoProjects***'];
            }

            const searchResult = await projectService.search(
                {
                    ids: projectIds,
                    limit: limit,
                    $projection: { settings: 0 }
                }
            );

            res.json(searchResult.data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクト検索
 */
// async function search(
//     conditions: cinerino.factory.project.ISearchConditions,
//     projection?: any
// ): Promise<cinerino.factory.project.IProject[]> {
//     const searchResult = await projectService.search({
//         ...conditions,
//         ...(projection !== undefined && projection !== null) ? { $projection: projection } : undefined
//     });

//     return searchResult.data;
// }

/**
 * プロジェクト取得
 */
projectsRouter.get(
    '/:id',
    permitScopes(['projects.*', 'projects.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            const projection: any = (req.memberPermissions.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/projects.settings.read`) >= 0)
                ? undefined
                : { settings: 0 };
            const project = await projectService.findById({
                id: req.project.id,
                ...(projection !== undefined) ? { $projection: projection } : undefined
            });

            res.json({
                ...project,
                ...(project.settings !== undefined)
                    ? {
                        settings: {
                            ...project.settings,
                            cognito: {
                                ...project.settings?.cognito,
                                // 互換性維持対応として
                                adminUserPool: { id: ADMIN_USER_POOL_ID }
                            }
                        }
                    }
                    : undefined
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクト更新
 */
projectsRouter.patch(
    '/:id',
    permitScopes(['projects.*', 'projects.write']),
    rateLimit,
    ...[],
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            let project = await projectService.findById({ id: req.project.id });
            project = {
                ...project,
                ...(typeof req.body.name === 'string' && req.body.name.length > 0) ? { name: req.body.name } : undefined,
                ...(typeof req.body.logo === 'string' && req.body.logo.length > 0) ? { logo: req.body.logo } : undefined,
                settings: {
                    ...project.settings,
                    ...(typeof req.body.settings?.sendgridApiKey === 'string')
                        ? { sendgridApiKey: req.body.settings.sendgridApiKey }
                        : undefined,
                    onOrderStatusChanged: {
                        ...project.settings?.onOrderStatusChanged,
                        ...(Array.isArray(req.body.settings?.onOrderStatusChanged?.informOrder))
                            ? { informOrder: req.body.settings.onOrderStatusChanged.informOrder }
                            : undefined
                    }
                }
            };
            // const project = <cinerino.factory.project.IProject>await projectRepo.projectModel.findOneAndUpdate(
            //     { _id: req.project.id },
            //     {
            //         updatedAt: new Date(),
            //         ...(typeof req.body.name === 'string' && req.body.name.length > 0) ? { name: req.body.name } : undefined,
            //         ...(typeof req.body.logo === 'string' && req.body.logo.length > 0) ? { logo: req.body.logo } : undefined,
            //         ...(typeof req.body.settings?.sendgridApiKey === 'string')
            //             ? { 'settings.sendgridApiKey': req.body.settings.sendgridApiKey }
            //             : undefined,
            //         ...(Array.isArray(req.body.settings?.onOrderStatusChanged?.informOrder))
            //             ? { 'settings.onOrderStatusChanged.informOrder': req.body.settings.onOrderStatusChanged.informOrder }
            //             : undefined,
            //     },
            //     {
            //         new: true
            //     }
            // )
            //     .exec()
            //     .then((doc) => {
            //         if (doc === null) {
            //             throw new cinerino.factory.errors.NotFound('Project');

            //         }

            //         return doc.toObject();
            //     });

            // chevre連携
            await projectService.update({
                typeOf: cinerino.factory.chevre.organizationType.Project,
                id: project.id,
                logo: project.logo,
                name: (typeof project.name === 'string') ? project.name : undefined,
                settings: project.settings
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * プロジェクト設定取得
 */
projectsRouter.get(
    '/:id/settings',
    permitScopes(['projects.*', 'projects.settings.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });
            const project = await projectService.findById({ id: req.project.id });

            res.json({
                ...project.settings,
                cognito: {
                    ...project.settings?.cognito,
                    // 互換性維持対応として
                    adminUserPool: { id: ADMIN_USER_POOL_ID }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default projectsRouter;
