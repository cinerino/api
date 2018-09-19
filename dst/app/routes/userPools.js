"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Cognitoユーザープールルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
});
const userPoolsRouter = express_1.Router();
userPoolsRouter.use(authentication_1.default);
userPoolsRouter.get('/:userPoolId', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const userPool = yield new Promise((resolve, reject) => {
            cognitoIdentityServiceProvider.describeUserPool({
                UserPoolId: req.params.userPoolId
            }, (err, data) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    if (data.UserPool === undefined) {
                        reject(new cinerino.factory.errors.NotFound('UserPool'));
                    }
                    else {
                        resolve(data.UserPool);
                    }
                }
            });
        });
        res.json(userPool);
    }
    catch (error) {
        next(error);
    }
}));
userPoolsRouter.get('/:userPoolId/clients', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const clients = yield new Promise((resolve, reject) => {
            cognitoIdentityServiceProvider.listUserPoolClients({
                UserPoolId: req.params.userPoolId,
                // NextToken?: PaginationKeyType;
                MaxResults: 60
            }, (err, data) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    if (data.UserPoolClients === undefined) {
                        reject(new cinerino.factory.errors.NotFound('UserPoolClients'));
                    }
                    else {
                        resolve(data.UserPoolClients);
                    }
                }
            });
        });
        res.set('X-Total-Count', clients.length.toString());
        res.json(clients);
    }
    catch (error) {
        next(error);
    }
}));
userPoolsRouter.get('/:userPoolId/clients/:clientId', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const client = yield new Promise((resolve, reject) => {
            cognitoIdentityServiceProvider.describeUserPoolClient({
                ClientId: req.params.clientId,
                UserPoolId: req.params.userPoolId
            }, (err, data) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    if (data.UserPoolClient === undefined) {
                        reject(new cinerino.factory.errors.NotFound('UserPoolClient'));
                    }
                    else {
                        resolve(data.UserPoolClient);
                    }
                }
            });
        });
        res.json(client);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = userPoolsRouter;
