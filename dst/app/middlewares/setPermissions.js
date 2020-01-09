"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * プロジェクトメンバー権限セットミドルウェア
 */
const cinerino = require("@cinerino/domain");
const createDebug = require("debug");
const mongoose = require("mongoose");
const iam_1 = require("../iam");
// tslint:disable-next-line:no-require-imports no-var-requires
const roles = require('../../../roles.json');
const debug = createDebug('cinerino-api:middlewares');
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
exports.default = (req, _, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let memberPermissions = [];
        const customerPermissions = [];
        // プロジェクトが決定していれば権限をセット
        if (req.project !== undefined && req.project !== null && typeof req.project.id === 'string') {
            memberPermissions = yield fixMemberPermissions(req)({
                member: new cinerino.repository.Member(mongoose.connection)
            });
            debug('project member permissions fixed.', memberPermissions);
            // プロジェクトメンバーでない場合、`customer`ロールに設定
            if (memberPermissions.length === 0) {
                const role = roles.find((r) => r.roleName === iam_1.RoleName.Customer);
                if (role !== undefined) {
                    customerPermissions.push(...role.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`));
                }
            }
        }
        req.customerPermissions = customerPermissions;
        req.memberPermissions = memberPermissions;
        req.isProjectMember = Array.isArray(req.memberPermissions) && req.memberPermissions.length > 0;
        next();
    }
    catch (error) {
        next(error);
    }
});
/**
 * プロジェクト決定済のリクエストに対してプロジェクトメンバー権限を決定する
 */
function fixMemberPermissions(req) {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        let permissions = [];
        if (req.project !== undefined && req.project !== null && typeof req.project.id === 'string') {
            const projectMembers = yield repos.member.search({
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
    });
}
