/**
 * Cognitoユーザープールルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const cognitoIdentityServiceProvider = new cinerino.AWS.CognitoIdentityServiceProvider({
    apiVersion: 'latest',
    region: 'ap-northeast-1',
    credentials: new cinerino.AWS.Credentials({
        accessKeyId: <string>process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: <string>process.env.AWS_SECRET_ACCESS_KEY
    })
});

const userPoolsRouter = Router();

userPoolsRouter.get(
    '/:userPoolId',
    permitScopes(['userPools.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const userPool = await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.UserPoolType>((resolve, reject) => {
                cognitoIdentityServiceProvider.describeUserPool(
                    {
                        UserPoolId: req.params.userPoolId
                    },
                    (err, data) => {
                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            if (data.UserPool === undefined) {
                                reject(new cinerino.factory.errors.NotFound('UserPool'));
                            } else {
                                resolve(data.UserPool);
                            }
                        }
                    }
                );
            });
            res.json(userPool);
        } catch (error) {
            error = cinerino.errorHandler.handleAWSError(error);
            next(error);
        }
    }
);

userPoolsRouter.get(
    '/:userPoolId/clients',
    permitScopes(['userPools.clients.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const clients = await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.UserPoolClientListType>((resolve, reject) => {
                cognitoIdentityServiceProvider.listUserPoolClients(
                    {
                        UserPoolId: req.params.userPoolId,
                        // NextToken?: PaginationKeyType;
                        MaxResults: 60
                    },
                    (err, data) => {
                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            if (data.UserPoolClients === undefined) {
                                reject(new cinerino.factory.errors.NotFound('UserPoolClients'));
                            } else {
                                resolve(data.UserPoolClients);
                            }
                        }
                    }
                );
            });

            res.json(clients);
        } catch (error) {
            error = cinerino.errorHandler.handleAWSError(error);
            next(error);
        }
    }
);

userPoolsRouter.get(
    '/:userPoolId/clients/:clientId',
    permitScopes(['userPools.clients.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const client = await new Promise<cinerino.AWS.CognitoIdentityServiceProvider.UserPoolClientType>((resolve, reject) => {
                cognitoIdentityServiceProvider.describeUserPoolClient(
                    {
                        ClientId: req.params.clientId,
                        UserPoolId: req.params.userPoolId
                    },
                    (err, data) => {
                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            if (data.UserPoolClient === undefined) {
                                reject(new cinerino.factory.errors.NotFound('UserPoolClient'));
                            } else {
                                resolve(data.UserPoolClient);
                            }
                        }
                    }
                );
            });
            res.json(client);
        } catch (error) {
            error = cinerino.errorHandler.handleAWSError(error);
            next(error);
        }
    }
);

export default userPoolsRouter;
