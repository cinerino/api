/**
 * アプリケーションルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
// import { ParamsDictionary } from 'express-serve-static-core';
import { body } from 'express-validator';
import { CREATED } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const RESOURCE_SERVER_IDENTIFIER = <string>process.env.RESOURCE_SERVER_IDENTIFIER;

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});

const applicationsRouter = Router();

/**
 * アプリケーション作成
 */
applicationsRouter.post(
    '',
    permitScopes(['applications.*']),
    rateLimit,
    ...[
        body('name')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('userPoolId')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isString(),
        body('allowedOAuthFlow')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isIn(['client_credentials', 'code']),
        body('callbackURLs')
            .optional()
            .isArray(),
        body('logoutURLs')
            .optional()
            .isArray(),
        body('supportedIdentityProviders')
            .not()
            .isEmpty()
            .withMessage(() => 'required')
            .isArray()
    ],
    validator,
    async (req, res, next) => {
        try {
            const userPoolId = <string>req.body.userPoolId;
            const clientName = <string>req.body.name;

            const resourceServer = await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.ResourceServerType>((resolve, reject) => {
                cognitoIdentityServiceProvider.describeResourceServer(
                    {
                        UserPoolId: userPoolId,
                        Identifier: RESOURCE_SERVER_IDENTIFIER
                    },
                    (err, data) => {
                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            if (data.ResourceServer === undefined) {
                                reject(new cinerino.factory.errors.NotFound('ResourceServer'));
                            } else {
                                resolve(data.ResourceServer);
                            }
                        }
                    }
                );
            });

            const allowedOAuthScopes = (Array.isArray(resourceServer.Scopes))
                ? resourceServer.Scopes.map((scope) => `${resourceServer.Identifier}/${scope.ScopeName}`)
                : [];

            const allowedOAuthFlow = req.body.allowedOAuthFlow;
            let callbackURLs: string[] | undefined;
            let logoutURLs: string[] | undefined;

            if (allowedOAuthFlow === 'code') {
                callbackURLs = req.body.callbackURLs;
                logoutURLs = req.body.logoutURLs;
                allowedOAuthScopes.push(...['phone', 'email', 'openid', 'aws.cognito.signin.user.admin', 'profile']);
            }

            const supportedIdentityProviders = req.body.supportedIdentityProviders;

            // Cognitoでアプリケーションクライアント作成
            const userPoolClient = await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.UserPoolClientType>((resolve, reject) => {
                cognitoIdentityServiceProvider.createUserPoolClient(
                    {
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
                    },
                    (err, data) => {
                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            if (data.UserPoolClient === undefined) {
                                reject(new cinerino.factory.errors.NotFound('UserPool'));
                            } else {
                                resolve(data.UserPoolClient);
                            }
                        }
                    }
                );
            });

            const applicationRepo = new cinerino.repository.Application(mongoose.connection);
            const doc = await applicationRepo.applicationModel.create({
                _id: userPoolClient.ClientId,
                typeOf: cinerino.factory.creativeWorkType.WebApplication,
                project: { typeOf: cinerino.factory.organizationType.Project, id: req.project.id },
                name: userPoolClient.ClientName
            });

            const application = doc.toObject();

            res.status(CREATED)
                .json(application);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * アプリケーション検索
 */
applicationsRouter.get(
    '',
    permitScopes(['applications.*', 'applications.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const searchCoinditions: any = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1
            };

            const applicationRepo = new cinerino.repository.Application(mongoose.connection);
            const applications = await applicationRepo.search(searchCoinditions);
            const totalCount = await applicationRepo.count(searchCoinditions);

            res.set('X-Total-Count', totalCount.toString());
            res.json(applications);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * IDでアプリケーション検索
 */
applicationsRouter.get(
    '/:id',
    permitScopes(['applications.*', 'applications.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const applicationRepo = new cinerino.repository.Application(mongoose.connection);
            const application = await applicationRepo.findById(
                {
                    id: req.params.id
                }
            );
            res.json(application);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * アプリケーション更新
 */
// tslint:disable-next-line:use-default-type-parameter
// applicationsRouter.put<ParamsDictionary>(
//     '/:id',
//     permitScopes(['applications.*']),
//     rateLimit,
//     ...[
//         body('typeOf')
//             .not()
//             .isEmpty()
//             .withMessage((_, __) => 'required')
//     ],
//     validator,
//     async (req, res, next) => {
//         try {
//             const attributes: cinerino.factory.seller.IAttributes<typeof req.body.typeOf> = {
//                 ...req.body,
//                 project: req.project
//             };

//             const applicationRepo = new cinerino.repository.Application(mongoose.connection);
//             await applicationRepo.save({ id: req.params.id, attributes: attributes });

//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );

/**
 * アプリケーション削除
 */
// applicationsRouter.delete(
//     '/:id',
//     permitScopes(['applications.*']),
//     rateLimit,
//     validator,
//     async (req, res, next) => {
//             res.status(NO_CONTENT)
//                 .end();
//         } catch (error) {
//             next(error);
//         }
//     }
// );

export default applicationsRouter;
