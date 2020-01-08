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
 * OAuthミドルウェア
 * @see https://aws.amazon.com/blogs/mobile/integrating-amazon-cognito-user-pools-with-api-gateway/
 */
const cinerino = require("@cinerino/domain");
const mongoose = require("mongoose");
const express_middleware_1 = require("@motionpicture/express-middleware");
// 許可発行者リスト
const ISSUERS = process.env.TOKEN_ISSUERS.split(',');
// tslint:disable-next-line:no-single-line-block-comment
/* istanbul ignore next */
// tslint:disable-next-line:max-func-body-length
exports.default = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield express_middleware_1.cognitoAuth({
            issuers: ISSUERS,
            authorizedHandler: (user, token) => __awaiter(void 0, void 0, void 0, function* () {
                const identifier = [
                    { name: 'tokenIssuer', value: user.iss },
                    { name: 'clientId', value: user.client_id },
                    { name: 'hostname', value: req.hostname }
                ];
                // リクエストユーザーの属性を識別子に追加
                try {
                    identifier.push(...Object.keys(user)
                        .filter((key) => key !== 'scope' && key !== 'scopes') // スコープ情報はデータ量がDBの制限にはまる可能性がある
                        .map((key) => {
                        return {
                            name: String(key),
                            value: String(user[key])
                        };
                    }));
                }
                catch (error) {
                    // no op
                }
                let programMembership;
                if (user.username !== undefined) {
                    programMembership = {
                        award: [],
                        membershipNumber: user.username,
                        name: 'Default Program Membership',
                        programName: 'Default Program Membership',
                        project: req.project,
                        typeOf: cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership,
                        url: user.iss
                    };
                }
                // プロジェクトアプリケーションの存在確認
                const applicationRepo = new cinerino.repository.Application(mongoose.connection);
                try {
                    const applications = yield applicationRepo.search({ id: { $eq: user.client_id } });
                    if (applications.length > 0) {
                        const application = applications[0];
                        req.application = application;
                    }
                }
                catch (error) {
                    // no op
                    next(error);
                    return;
                }
                req.user = user;
                req.accessToken = token;
                // ログインユーザーであればPerson、クライアント認証であればアプリケーション
                req.agent = (programMembership !== undefined)
                    ? {
                        typeOf: cinerino.factory.personType.Person,
                        id: user.sub,
                        identifier: identifier,
                        memberOf: programMembership
                    }
                    : {
                        typeOf: cinerino.factory.creativeWorkType.WebApplication,
                        id: user.sub,
                        identifier: identifier
                    };
                next();
            }),
            unauthorizedHandler: (err) => {
                next(new cinerino.factory.errors.Unauthorized(err.message));
            }
        })(req, res, next);
    }
    catch (error) {
        next(new cinerino.factory.errors.Unauthorized(error.message));
    }
});
