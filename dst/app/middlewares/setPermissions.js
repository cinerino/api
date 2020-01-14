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
 * 権限セットミドルウェア
 */
const cinerino = require("@cinerino/domain");
const mongoose = require("mongoose");
const iam_1 = require("../iam");
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
exports.default = (req, _, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let memberPermissions = [];
        const customerPermissions = [];
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const roleRepo = new cinerino.repository.Role(mongoose.connection);
        // プロジェクトが決定していれば権限をセット
        if (req.project !== undefined && req.project !== null && typeof req.project.id === 'string') {
            // プロジェクト決定済のリクエストに対してプロジェクトメンバー権限を決定する
            memberPermissions = yield cinerino.service.iam.searchPermissions({
                project: { id: req.project.id },
                member: { id: req.user.sub }
            })({
                member: memberRepo,
                role: roleRepo
            });
            memberPermissions = memberPermissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);
            // プロジェクトメンバーでない場合、`customer`ロールに設定
            if (memberPermissions.length === 0) {
                const customerRole = yield roleRepo.search({ roleName: { $eq: iam_1.RoleName.Customer } });
                const role = customerRole.shift();
                if (role !== undefined) {
                    customerPermissions.push(...role.permissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`));
                }
            }
        }
        req.customerPermissions = customerPermissions;
        req.memberPermissions = memberPermissions;
        req.isProjectMember = yield isProjectMember({
            project: { id: req.project.id },
            member: { id: req.user.sub }
        })({
            member: memberRepo
        });
        next();
    }
    catch (error) {
        next(error);
    }
});
function isProjectMember(params) {
    return (repos) => __awaiter(this, void 0, void 0, function* () {
        let isMember = false;
        const members = yield repos.member.search({
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
    });
}
