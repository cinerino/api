/**
 * プロジェクトメンバー権限セットミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';
import { NextFunction, Request, Response } from 'express';
import * as mongoose from 'mongoose';

import { IRole, RoleName } from '../iam';

// tslint:disable-next-line:no-require-imports no-var-requires
const roles: IRole[] = require('../../../roles.json');

const debug = createDebug('cinerino-api:middlewares');

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        let memberPermissions: string[] = [];
        const customerPermissions: string[] = [];

        // プロジェクトが決定していれば権限をセット
        if (req.project !== undefined && req.project !== null && typeof req.project.id === 'string') {
            memberPermissions = await fixMemberPermissions(req)({
                member: new cinerino.repository.Member(mongoose.connection)
            });
            debug('project member permissions fixed.', memberPermissions);

            // プロジェクトメンバーでない場合、`customer`ロールに設定
            if (memberPermissions.length === 0) {
                const role = roles.find((r) => r.roleName === RoleName.Customer);
                if (role !== undefined) {
                    customerPermissions.push(...role.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`));
                }
            }
        }

        req.customerPermissions = customerPermissions;
        req.memberPermissions = memberPermissions;
        req.isProjectMember = Array.isArray(req.memberPermissions) && req.memberPermissions.length > 0;

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

        if (req.project !== undefined && req.project !== null && typeof req.project.id === 'string') {
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
        }

        return permissions;
    };
}
