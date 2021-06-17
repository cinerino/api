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
