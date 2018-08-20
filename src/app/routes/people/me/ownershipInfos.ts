/**
 * 自分の所有権ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { ACCEPTED } from 'http-status';

import permitScopes from '../../../middlewares/permitScopes';
import validator from '../../../middlewares/validator';

const ownershipInfosRouter = Router();

/**
 * ユーザーの所有権検索
 */
ownershipInfosRouter.get(
    '/:goodType',
    permitScopes(['aws.cognito.signin.user.admin', 'people.ownershipInfos', 'people.ownershipInfos.read-only']),
    (_1, _2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const repository = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const ownershipInfos = await repository.search({
                goodType: req.params.goodType,
                ownedBy: req.user.sub,
                ownedAt: new Date()
            });
            res.json(ownershipInfos);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 所有権に対して認可コードを発行する
 */
ownershipInfosRouter.get(
    '/:goodType/:identifier/authorize',
    permitScopes(['aws.cognito.signin.user.admin']),
    (_1, _2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const ownershipInfos = await ownershipInfoRepo.search({
                goodType: req.params.goodType,
                identifier: req.params.identifier
            });
            if (ownershipInfos.length === 0) {
                throw new cinerino.factory.errors.NotFound('OwnershipInfo');
            }
            const ownershipInfo = ownershipInfos[0];
            // いったん仮でコードはそのまま所有権ID
            const code = ownershipInfo.identifier;
            res.json({ code });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員プログラム登録
 */
ownershipInfosRouter.put(
    '/programMembership/register',
    permitScopes(['aws.cognito.signin.user.admin', 'people.ownershipInfos']),
    (_1, _2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const task = await cinerino.service.programMembership.createRegisterTask({
                agent: req.agent,
                seller: {
                    typeOf: req.body.sellerType,
                    id: req.body.sellerId
                },
                programMembershipId: req.body.programMembershipId,
                offerIdentifier: req.body.offerIdentifier
            })({
                organization: new cinerino.repository.Organization(cinerino.mongoose.connection),
                programMembership: new cinerino.repository.ProgramMembership(cinerino.mongoose.connection),
                task: new cinerino.repository.Task(cinerino.mongoose.connection)
            });
            // 会員登録タスクとして受け入れられたのでACCEPTED
            res.status(ACCEPTED).json(task);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * 会員プログラム登録解除
 * 所有権のidentifierをURLで指定
 */
ownershipInfosRouter.put(
    '/programMembership/:identifier/unRegister',
    permitScopes(['aws.cognito.signin.user.admin', 'people.ownershipInfos']),
    (_1, _2, next) => {
        next();
    },
    validator,
    async (req, res, next) => {
        try {
            const task = await cinerino.service.programMembership.createUnRegisterTask({
                agent: req.agent,
                ownershipInfoIdentifier: req.params.identifier
            })({
                ownershipInfo: new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection),
                task: new cinerino.repository.Task(cinerino.mongoose.connection)
            });
            // 会員登録解除タスクとして受け入れられたのでACCEPTED
            res.status(ACCEPTED).json(task);
        } catch (error) {
            next(error);
        }
    }
);

export default ownershipInfosRouter;
