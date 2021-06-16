/**
 * me(今ログイン中のユーザー)ルーター
 * Cinemasunshinに互換性を維持するためのルーター
 * 可能な部分から順次placeOrderTransactionsRouterへ移行していくことが望ましい
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import { ACCEPTED } from 'http-status';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import rateLimit from '../../middlewares/rateLimit';
import validator from '../../middlewares/validator';

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const me4cinemasunshineRouter = Router();

/**
 * 会員プログラム登録解除
 * 所有権のidentifierをURLで指定
 * @deprecated シネマサンシャインで「退会処理」として使用(機を見てエンドポイントを変更したい)
 */
me4cinemasunshineRouter.put(
    '/ownershipInfos/programMembership/:identifier/unRegister',
    permitScopes(['people.ownershipInfos', 'people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient,
                project: { id: req.project.id }
            });

            // 現在所有している会員プログラムを全て検索
            const now = new Date();
            const searchOwnershipInfosResult = await ownershipInfoService.search({
                project: { id: { $eq: req.project.id } },
                typeOfGood: { typeOf: cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership },
                ownedBy: { id: req.agent.id },
                ownedFrom: now,
                ownedThrough: now
            });
            const ownershipInfos = searchOwnershipInfosResult.data;

            // 所有が確認できれば、会員プログラム登録解除タスクを作成する
            const unRegisterActionAttributes: cinerino.factory.action.interact.unRegister.programMembership.IAttributes[]
                = ownershipInfos.map((o) => {
                    return {
                        project: { id: o.project?.id, typeOf: o.project?.typeOf },
                        typeOf: cinerino.factory.actionType.UnRegisterAction,
                        agent: req.agent,
                        object: {
                            ...<any>o.typeOfGood,
                            member: [req.agent]
                        }
                    };
                });

            // 会員削除タスクを作成
            const deleteMemberAction: cinerino.factory.action.update.deleteAction.member.IAttributes = {
                agent: req.agent,
                object: req.agent,
                project: req.project,
                potentialActions: {
                    unRegisterProgramMembership: unRegisterActionAttributes
                },
                typeOf: cinerino.factory.actionType.DeleteAction
            };
            const deleteMemberTask: cinerino.factory.task.IAttributes<cinerino.factory.taskName.DeleteMember> = {
                project: req.project,
                name: cinerino.factory.taskName.DeleteMember,
                status: cinerino.factory.taskStatus.Ready,
                runsAt: now,
                remainingNumberOfTries: 10,
                numberOfTried: 0,
                executionResults: [],
                data: deleteMemberAction
            };

            await taskRepo.save(deleteMemberTask);

            // 会員登録解除タスクとして受け入れられたのでACCEPTED
            res.status(ACCEPTED)
                .json(deleteMemberTask);
        } catch (error) {
            next(error);
        }
    }
);

export default me4cinemasunshineRouter;
