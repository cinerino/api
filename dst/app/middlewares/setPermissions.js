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
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
exports.default = (req, _, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        let isProjectMember = false;
        let memberPermissions = [];
        const memberRepo = new cinerino.repository.Member(mongoose.connection);
        const roleRepo = new cinerino.repository.Role(mongoose.connection);
        // プロジェクトが決定していれば権限をセット
        if (typeof ((_a = req.project) === null || _a === void 0 ? void 0 : _a.id) === 'string') {
            // プロジェクト決定済のリクエストに対してプロジェクトメンバー権限を決定する
            memberPermissions = yield cinerino.service.iam.searchPermissions({
                project: { id: req.project.id },
                member: { id: req.user.sub }
            })({
                member: memberRepo,
                role: roleRepo
            });
            memberPermissions = memberPermissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);
            if (memberPermissions.length === 0) {
                // プロジェクトメンバーが見つからない場合、アプリケーションクライアントとして権限検索
                memberPermissions = yield cinerino.service.iam.searchPermissions({
                    project: { id: req.project.id },
                    member: { id: req.user.client_id }
                })({
                    member: memberRepo,
                    role: roleRepo
                });
                memberPermissions = memberPermissions.map((p) => `${RESOURCE_SERVER_IDENTIFIER}/${p}`);
            }
            isProjectMember = yield checkProjectMember({
                project: { id: req.project.id },
                member: { id: req.user.sub }
            })({
                member: memberRepo
            });
        }
        req.memberPermissions = memberPermissions;
        req.isProjectMember = isProjectMember;
        next();
    }
    catch (error) {
        next(error);
    }
});
function checkProjectMember(params) {
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
