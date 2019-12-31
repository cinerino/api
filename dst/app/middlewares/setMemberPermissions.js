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
const mongoose = require("mongoose");
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
const ROLES = [
    { roleName: 'owner', permissions: ['project'] }
];
exports.default = (req, _, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const permissions = yield fixMemberPermissions(req)({
            member: new cinerino.repository.Member(mongoose.connection)
        });
        req.memberPermissions = permissions;
        next();
    }
    catch (error) {
        next(error);
    }
});
function fixMemberPermissions(req) {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        const permissions = [];
        const projectMembers = yield repos.member.search({
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
    });
}
