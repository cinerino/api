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
 * アプリケーションルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const RESOURCE_SERVER_IDENTIFIER = process.env.RESOURCE_SERVER_IDENTIFIER;
const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
});
const applicationsRouter = express_1.Router();
/**
 * アプリケーション作成
 */
applicationsRouter.post('', permitScopes_1.default(['applications.*']), rateLimit_1.default, ...[
    express_validator_1.body('name')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('userPoolId')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isString(),
    express_validator_1.body('allowedOAuthFlow')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isIn(['client_credentials', 'code']),
    express_validator_1.body('callbackURLs')
        .optional()
        .isArray(),
    express_validator_1.body('logoutURLs')
        .optional()
        .isArray(),
    express_validator_1.body('supportedIdentityProviders')
        .not()
        .isEmpty()
        .withMessage(() => 'required')
        .isArray()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userPoolId = req.body.userPoolId;
        const clientName = req.body.name;
        const resourceServer = yield new Promise((resolve, reject) => {
            cognitoIdentityServiceProvider.describeResourceServer({
                UserPoolId: userPoolId,
                Identifier: RESOURCE_SERVER_IDENTIFIER
            }, (err, data) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    if (data.ResourceServer === undefined) {
                        reject(new cinerino.factory.errors.NotFound('ResourceServer'));
                    }
                    else {
                        resolve(data.ResourceServer);
                    }
                }
            });
        });
        const allowedOAuthScopes = (Array.isArray(resourceServer.Scopes))
            ? resourceServer.Scopes.map((scope) => `${resourceServer.Identifier}/${scope.ScopeName}`)
            : [];
        const allowedOAuthFlow = req.body.allowedOAuthFlow;
        let callbackURLs;
        let logoutURLs;
        if (allowedOAuthFlow === 'code') {
            callbackURLs = req.body.callbackURLs;
            logoutURLs = req.body.logoutURLs;
            allowedOAuthScopes.push(...['phone', 'email', 'openid', 'aws.cognito.signin.user.admin', 'profile']);
        }
        const supportedIdentityProviders = req.body.supportedIdentityProviders;
        // Cognitoでアプリケーションクライアント作成
        const userPoolClient = yield new Promise((resolve, reject) => {
            cognitoIdentityServiceProvider.createUserPoolClient({
                UserPoolId: userPoolId,
                ClientName: clientName,
                GenerateSecret: true,
                // RefreshTokenValidity?: RefreshTokenValidityType;
                // ReadAttributes?: ClientPermissionListType;
                // WriteAttributes?: ClientPermissionListType;
                // ExplicitAuthFlows?: ExplicitAuthFlowsListType;
                SupportedIdentityProviders: supportedIdentityProviders,
                CallbackURLs: callbackURLs,
                LogoutURLs: logoutURLs,
                // DefaultRedirectURI?: RedirectUrlType;
                // AllowedOAuthFlows: ['client_credentials'],
                AllowedOAuthFlows: [allowedOAuthFlow],
                AllowedOAuthScopes: allowedOAuthScopes,
                AllowedOAuthFlowsUserPoolClient: true
                // PreventUserExistenceErrors?: PreventUserExistenceErrorTypes;
            }, (err, data) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    if (data.UserPoolClient === undefined) {
                        reject(new cinerino.factory.errors.NotFound('UserPool'));
                    }
                    else {
                        resolve(data.UserPoolClient);
                    }
                }
            });
        });
        const applicationRepo = new cinerino.repository.Application(mongoose.connection);
        const doc = yield applicationRepo.applicationModel.create({
            _id: userPoolClient.ClientId,
            typeOf: cinerino.factory.creativeWorkType.WebApplication,
            project: { typeOf: cinerino.factory.organizationType.Project, id: req.project.id },
            name: userPoolClient.ClientName
        });
        const application = doc.toObject();
        res.status(http_status_1.CREATED)
            .json(application);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * アプリケーション検索
 */
applicationsRouter.get('', permitScopes_1.default(['applications.*', 'applications.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const searchCoinditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1 });
        const applicationRepo = new cinerino.repository.Application(mongoose.connection);
        const applications = yield applicationRepo.search(searchCoinditions);
        const totalCount = yield applicationRepo.count(searchCoinditions);
        res.set('X-Total-Count', totalCount.toString());
        res.json(applications);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDでアプリケーション検索
 */
applicationsRouter.get('/:id', permitScopes_1.default(['applications.*', 'applications.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const applicationRepo = new cinerino.repository.Application(mongoose.connection);
        const application = yield applicationRepo.findById({
            id: req.params.id
        });
        res.json(application);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = applicationsRouter;
