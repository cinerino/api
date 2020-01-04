/**
 * プロジェクトメンバー権限セットミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as mongoose from 'mongoose';

import { roles } from '../iam';

const debug = createDebug('cinerino-api:middlewares');

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        const permissions = await fixMemberPermissions(req)({
            member: new cinerino.repository.Member(mongoose.connection)
        });
        debug('project member permissions fixed.', permissions);

        req.memberPermissions = permissions;

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * プロジェクト決定済のリクエストに対してプロジェクトメンバー権限を決定する
 */
function fixMemberPermissions(req: Request) {
    return async (repos: {
        member: cinerino.repository.Member;
    }): Promise<string[]> => {
        let permissions: string[] = [];

        const projectMembers = await repos.member.search({
            project: { id: { $eq: req.project.id } },
            member: { id: { $eq: req.user.sub } }
        });

        projectMembers.forEach((projectMember) => {
            projectMember.member.hasRole.forEach((memberRole) => {
                const role = roles.find((r) => r.roleName === memberRole.roleName);
                if (role !== undefined) {
                    permissions.push(...role.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`));
                }
            });
        });

        permissions = [...new Set(permissions)];

        return permissions;
    };
}
