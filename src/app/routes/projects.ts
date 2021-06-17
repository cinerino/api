/**
 * プロジェクトルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// import { body } from 'express-validator';
// import { CREATED, NO_CONTENT } from 'http-status';
// import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

// import { RoleName } from '../iam';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;
// const TOKEN_ISSUERS_AS_ADMIN: string[] = (typeof process.env.TOKEN_ISSUERS_AS_ADMIN === 'string')
//     ? process.env.TOKEN_ISSUERS_AS_ADMIN.split(',')
//     : [];

const projectsRouter = Router();

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
            const meService = new cinerino.chevre.service.Me({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: req.chevreAuthClient,
                project: { id: '' }
            });

            const { data } = await meService.searchProjects({
                ...req.query
            });

            res.json(data);

            // const memberRepo = new cinerino.repository.Member(mongoose.connection);
            // const projectService = new cinerino.chevre.service.Project({
            //     endpoint: cinerino.credentials.chevre.endpoint,
            //     auth: chevreAuthClient,
            //     project: { id: '' }
            // });

            // // tslint:disable-next-line:no-magic-numbers
            // const limit = (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100;
            // const page = (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1;

            // // 権限を持つプロジェクト検索
            // let searchConditions: any;
            // if (TOKEN_ISSUERS_AS_ADMIN.includes(req.user.iss)) {
            //     // 管理ユーザープールのクライアントであればreq.user.subとして検索
            //     searchConditions = {
            //         'member.id': { $eq: req.user.sub }
            //     };
            // } else {
            //     // それ以外であればreq.user.client_idとして検索
            //     searchConditions = {
            //         'member.id': { $eq: req.user.client_id }
            //     };
            // }

            // const projectMembers = await memberRepo.memberModel.find(
            //     searchConditions,
            //     { project: 1 }
            // )
            //     .limit(limit)
            //     .skip(limit * (page - 1))
            //     .setOptions({ maxTimeMS: 10000 })
            //     .exec()
            //     .then((docs) => docs.map((doc) => doc.toObject()));

            // let projectIds = projectMembers.map((m) => m.project.id);
            // // length=1だとidsの指定がない検索になってしまうので、ありえないプロジェクトIDで保管
            // if (projectIds.length === 0) {
            //     projectIds = ['***NoProjects***'];
            // }

            // const searchResult = await projectService.search(
            //     {
            //         ids: projectIds,
            //         limit: limit,
            //         $projection: { settings: 0 }
            //     }
            // );

            // res.json(searchResult.data);
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
            const projectService = new cinerino.chevre.service.Project({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: '' }
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
                                ...project.settings?.cognito
                                // 互換性維持対応として
                                // adminUserPool: { id: ADMIN_USER_POOL_ID }
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

export default projectsRouter;
