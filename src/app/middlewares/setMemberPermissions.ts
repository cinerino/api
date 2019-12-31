/**
 * プロジェクトメンバー権限セットミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';
import * as mongoose from 'mongoose';

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

export interface IRole {
    roleName: string;
    permissions: string[];
}

const ROLES: IRole[] = [
    { roleName: 'owner', permissions: ['project'] }
];

export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        const permissions = await fixMemberPermissions(req)({
            member: new cinerino.repository.Member(mongoose.connection)
        });

        req.memberPermissions = permissions;

        next();
    } catch (error) {
        next(error);
    }
};

function fixMemberPermissions(req: Request) {
    return async (repos: {
        member: cinerino.repository.Member;
    }): Promise<string[]> => {
        const permissions: string[] = [];

        const projectMembers = await repos.member.search({
            project: { id: { $eq: req.project.id } },
            member: { id: { $eq: req.user.sub } }
        });

        projectMembers.forEach((projectMember) => {
            projectMember.member.hasRole.forEach((memberRole) => {
                const role = ROLES.find((r) => r.roleName === memberRole.roleName);
                if (role !== undefined) {
                    permissions.push(...role.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`));
                }
            });
        });

        return permissions;
    };
}
