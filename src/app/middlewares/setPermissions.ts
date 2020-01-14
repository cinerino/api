/**
 * 権限セットミドルウェア
 */
import * as cinerino from '@cinerino/domain';
import { NextFunction, Request, Response } from 'express';
import * as mongoose from 'mongoose';

import { RoleName } from '../iam';

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

export default async (req: Request, _: Response, next: NextFunction) => {
    try {
        let memberPermissions: string[] = [];
        const customerPermissions: string[] = [];

        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const roleRepo = new cinerino.repository.Role(mongoose.connection);

        // プロジェクトが決定していれば権限をセット
        if (req.project !== undefined && req.project !== null && typeof req.project.id === 'string') {
            // プロジェクト決定済のリクエストに対してプロジェクトメンバー権限を決定する
            memberPermissions = await cinerino.service.iam.searchPermissions({
                project: { id: req.project.id },
                member: { id: req.user.sub }
            })({
                member: memberRepo,
                role: roleRepo
            });
            memberPermissions = memberPermissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);

            // プロジェクトメンバーでない場合、`customer`ロールに設定
            if (memberPermissions.length === 0) {
                const customerRole = await roleRepo.search({ roleName: { $eq: RoleName.Customer } });
                const role = customerRole.shift();
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
