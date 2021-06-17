/**
 * 権限セットミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';
import * as mongoose from 'mongoose';

import { Permission, RoleName } from '../iam';

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;
const ANY_PROJECT_ID = '*';
const CLIENTS_CAN_READ_PEOPLE_ME: string[]
    = (typeof process.env.CLIENTS_CAN_READ_PEOPLE_ME === 'string') ? process.env.CLIENTS_CAN_READ_PEOPLE_ME.split(',') : [];

export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        let isPOS = false;
        let isProjectMember = false;
        let canReadPeopleMe = false;
        let memberPermissions: string[] = [];

        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const roleRepo = new cinerino.repository.Role(mongoose.connection);

        // プロジェクトが決定していれば権限をセット
        if (typeof req.project?.id === 'string' && req.project.id !== ANY_PROJECT_ID) {
            let searchPermissionsResult: {
                roleNames: string[];
                permissions: string[];
            };
            const memberPermissionReadable = req.user.scopes.includes(`${RESOURCE_SERVER_IDENTIFIER}/${Permission.ReadIAMMembersMe}`);

            // Adminユーザーの認可コードフローであれば、プロジェクトメンバーとしてのmemberPermissions
            if (memberPermissionReadable) {
                // プロジェクト決定済のリクエストに対してプロジェクトメンバー権限を決定する
                searchPermissionsResult = await cinerino.service.iam.searchPermissions({
                    project: { id: req.project.id },
                    member: { id: req.user.sub }
                })({ member: memberRepo, role: roleRepo });
                // memberPermissions = searchPermissionsResult.permissions;
                memberPermissions = searchPermissionsResult.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);

                isProjectMember = await checkProjectMember({
                    project: { id: req.project.id },
                    member: { id: req.user.sub }
                })({ member: memberRepo });
            } else {
                // それ以外は、クライアントとしてのmemberPermissions
                // プロジェクトメンバーが見つからない場合、アプリケーションクライアントとして権限検索
                searchPermissionsResult = await cinerino.service.iam.searchPermissions({
                    project: { id: req.project.id },
                    member: { id: req.user.client_id }
                })({ member: memberRepo, role: roleRepo });
                // memberPermissions = searchPermissionsResult.permissions;
                memberPermissions = searchPermissionsResult.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);

                if (memberPermissions.length === 0) {
                    // 全プロジェクトに許可されたアプリケーションクライアントとして権限検索
                    searchPermissionsResult = await cinerino.service.iam.searchPermissions({
                        project: { id: ANY_PROJECT_ID },
                        member: { id: req.user.client_id }
                    })({ member: memberRepo, role: roleRepo });
                    // memberPermissions = searchPermissionsResult.permissions;
                    memberPermissions = searchPermissionsResult.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);
                }

                isPOS = searchPermissionsResult.roleNames.includes(RoleName.POS);
            }
        }

        // 会員リソースを読み取り可能かどうかクライアントから判断
        canReadPeopleMe = req.user.scopes.includes(`${RESOURCE_SERVER_IDENTIFIER}/${Permission.ReadPeopleMe}`)
            || CLIENTS_CAN_READ_PEOPLE_ME.includes(req.user.client_id);

        req.memberPermissions = memberPermissions;
        req.isPOS = isPOS;
        req.isProjectMember = isProjectMember;
        // isAdminの条件は、プロジェクトメンバーかどうか
        // req.isAdmin = req.isProjectMember === true;
        req.canReadPeopleMe = canReadPeopleMe;

        next();
    } catch (error) {
        next(error);
    }
};

function checkProjectMember(params: {
    project: { id: string };
    member: { id: string };
}) {
    return async (repos: {
        member: cinerino.repository.Member;
    }) => {
        let isMember = false;

        const members = await repos.member.search({
            project: { id: { $eq: params.project.id } },
            member: { id: { $eq: params.member.id } }
        });
        if (members.length > 0) {
            const member = members[0];

            // メンバータイプが`Person`かつロールを持っていればプロジェクトメンバー
            isMember = member.member.typeOf === cinerino.factory.personType.Person
                && Array.isArray(member.member.hasRole)
                && member.member.hasRole.length > 0;
        }

        return isMember;
    };
}
