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

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

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
        body('settings.chevre.endpoint')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.cognito.adminUserPool.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.cognito.customerUserPool.id')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.gmo.endpoint')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.gmo.siteId')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.gmo.sitePass')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        // body('settings.mvtkReserve.companyCode')
        //     .not()
        //     .isEmpty()
        //     .withMessage(() => 'required')
        //     .isString(),
        body('settings.mvtkReserve.endpoint')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.pecorino.endpoint')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.sendgridApiKey')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('settings.transactionWebhookUrl')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString()
    ],
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            let project = createFromBody(req.body);

            let member;

            const adminUserPoolId = project.settings?.cognito?.adminUserPool.id;

            const personRepo = new cinerino.repository.Person({
                userPoolId: <string>adminUserPoolId
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
            project = await projectRepo.projectModel.create({ ...project, _id: project.id })
                .then((doc) => doc.toObject());

            // 権限作成
            await memberRepo.memberModel.create({
                project: { typeOf: project.typeOf, id: project.id },
                typeOf: 'OrganizationRole',
                member: member
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
            chevre: {
                endpoint: params.settings?.chevre?.endpoint
            },
            cognito: {
                adminUserPool: {
                    id: params.settings?.cognito?.adminUserPool?.id
                },
                customerUserPool: {
                    id: params.settings?.cognito?.customerUserPool?.id
                }
            },
            gmo: {
                endpoint: params.settings?.gmo?.endpoint,
                siteId: params.settings?.gmo?.siteId,
                sitePass: params.settings?.gmo?.sitePass
            },
            mvtkReserve: {
                companyCode: (typeof params.settings?.mvtkReserve?.companyCode === 'string')
                    ? params.settings?.mvtkReserve?.companyCode
                    : '',
                endpoint: params.settings?.mvtkReserve?.endpoint
            },
            pecorino: {
                endpoint: params.settings?.pecorino?.endpoint
            },
            onOrderStatusChanged: {
            },
            codeExpiresInSeconds: 600,
            sendgridApiKey: params.settings?.sendgridApiKey,
            transactionWebhookUrl: params.settings?.transactionWebhookUrl,
            useInMemoryOfferRepo: false,
            useReservationNumberAsConfirmationNumber: false,
            useUsernameAsGMOMemberId: false,
            validateMovieTicket: true
        },
        ...{
            subscription: { identifier: 'Free' }
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            // tslint:disable-next-line:no-magic-numbers
            const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
            const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;

            // 権限を持つプロジェクト検索
            const searchCoinditions = {
                'member.id': req.user.sub
            };

            const projectMembers = await memberRepo.memberModel.find(
                searchCoinditions,
                { project: 1 }
            )
                .limit(limit)
                .skip(limit * (page - 1))
                .setOptions({ maxTimeMS: 10000 })
                .exec()
                .then((docs) => docs.map((doc) => doc.toObject()));

            const projects = await projectRepo.search(
                {
                    ids: projectMembers.map((m) => m.project.id),
                    limit: limit
                },
                { settings: 0 }
            );

            res.json(projects);
        } catch (error) {
            next(error);
        }
    }
);

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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const projection: any = (req.memberPermissions.indexOf(`${RESOURCE_SERVER_IDENTIFIER}/projects.settings.read`) >= 0)
                ? undefined
                : { settings: 0 };
            const project = await projectRepo.findById({ id: req.project.id }, projection);

            res.json(project);
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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            await projectRepo.projectModel.findOneAndUpdate(
                { _id: req.project.id },
                {
                    updatedAt: new Date(),
                    ...(typeof req.body.name === 'string' && req.body.name.length > 0) ? { name: req.body.name } : undefined,
                    ...(typeof req.body.logo === 'string' && req.body.logo.length > 0) ? { logo: req.body.logo } : undefined,
                    ...(typeof req.body.settings?.codeExpiresInSeconds === 'number')
                        ? { 'settings.codeExpiresInSeconds': req.body.settings?.codeExpiresInSeconds }
                        : undefined,
                    ...(typeof req.body.settings?.transactionWebhookUrl === 'string')
                        ? { 'settings.transactionWebhookUrl': req.body.settings?.transactionWebhookUrl }
                        : undefined
                }
            )
                .exec();

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
            const projectRepo = new cinerino.repository.Project(mongoose.connection);
            const project = await projectRepo.findById({ id: req.project.id });

            res.json(project.settings);
        } catch (error) {
            next(error);
        }
    }
);

export default projectsRouter;
