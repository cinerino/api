/**
 * サービスアウトプットルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-implicit-dependencies
import { ParamsDictionary } from 'express-serve-static-core';
import { body, oneOf } from 'express-validator';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import permitScopes from '../middlewares/permitScopes';
import rateLimit from '../middlewares/rateLimit';
import validator from '../middlewares/validator';

const CODE_EXPIRES_IN_SECONDS_DEFAULT = 300;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const serviceOutputsRouter = Router();

/**
 * 検索
 */
serviceOutputsRouter.get(
    '',
    permitScopes(['serviceOutputs.*', 'serviceOutputs.read']),
    rateLimit,
    ...[
        // query('typeOf')
        //     .not()
        //     .isEmpty()
    ],
    validator,
    async (req, res, next) => {
        try {
            const searchConditions: any = {
                ...req.query,
                project: { id: { $eq: req.project.id } },
                // tslint:disable-next-line:no-magic-numbers
                limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : undefined,
                page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : undefined
            };

            const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const { data } = await serviceOutputService.search(searchConditions);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * サービスアウトプットに対して所有権コードを発行する
 */
// tslint:disable-next-line:use-default-type-parameter
serviceOutputsRouter.post<ParamsDictionary>(
    '/:identifier/authorize',
    permitScopes(['transactions']),
    rateLimit,
    ...[
        oneOf([
            [
                body('object.accessCode')
                    .not()
                    .isEmpty()
                    .isString()
            ]
        ])
        // body('result.expiresInSeconds')
        //     .optional()
        //     .isInt({ min: 0, max: CODE_EXPIRES_IN_SECONDS_MAXIMUM })
        //     .toInt()
    ],
    validator,
    async (req, res, next) => {
        try {
            const now = new Date();

            const expiresInSeconds: number = CODE_EXPIRES_IN_SECONDS_DEFAULT;

            const accessCode = <string>req.body.object?.accessCode;

            const actionRepo = new cinerino.repository.Action(mongoose.connection);

            // chevreでサービスアウトプット検索
            const serviceOutputService = new cinerino.chevre.service.ServiceOutput({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });
            const searchServiceOutputsResult = await serviceOutputService.search({
                limit: 1,
                page: 1,
                identifier: { $eq: req.params.identifier },
                accessCode: { $eq: accessCode }
            });
            const serviceOutput = searchServiceOutputsResult.data.shift();
            if (serviceOutput === undefined) {
                throw new cinerino.factory.errors.NotFound('ServiceOutput');
            }

            const authorizationObject: cinerino.factory.ownershipInfo.IOwnershipInfo<cinerino.factory.permit.IPermit> = {
                id: '', // どう処理するか要検討？
                ownedBy: req.agent,
                ownedFrom: now,
                ownedThrough: moment(now)
                    .add(expiresInSeconds, 'seconds')
                    .toDate(),
                project: { id: req.project.id, typeOf: cinerino.factory.organizationType.Project },
                typeOf: 'OwnershipInfo',
                typeOfGood: {
                    project: serviceOutput.project,
                    typeOf: serviceOutput.typeOf,
                    identifier: serviceOutput.identifier
                }
            };

            // 注文に対してコード発行
            const authorizations = await cinerino.service.code.publish({
                project: req.project,
                agent: req.agent,
                recipient: req.agent,
                object: [authorizationObject],
                purpose: {},
                validFrom: now,
                expiresInSeconds: expiresInSeconds
            })({
                action: actionRepo,
                authorization: new cinerino.chevre.service.Authorization({
                    endpoint: cinerino.credentials.chevre.endpoint,
                    auth: chevreAuthClient,
                    project: { id: req.project.id }
                })
            });

            res.json({
                code: authorizations[0].code
            });
        } catch (error) {
            next(error);
        }
    }
);

export default serviceOutputsRouter;
