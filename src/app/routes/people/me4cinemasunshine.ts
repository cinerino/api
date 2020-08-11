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

const DEFAULT_MEMBERSHIP_SERVICE_ID = process.env.DEFAULT_MEMBERSHIP_SERVICE_ID;

const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: <string>process.env.CHEVRE_CLIENT_ID,
    clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});

const me4cinemasunshineRouter = Router();

/**
 * メンバーシップ登録
 */
me4cinemasunshineRouter.put(
    '/ownershipInfos/programMembership/register',
    permitScopes(['people.ownershipInfos', 'people.me.*']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            if (typeof DEFAULT_MEMBERSHIP_SERVICE_ID !== 'string') {
                throw new cinerino.factory.errors.ServiceUnavailable('DEFAULT_MEMBERSHIP_SERVICE_ID undefined');
            }
            const productId = DEFAULT_MEMBERSHIP_SERVICE_ID;

            const productService = new cinerino.chevre.service.Product({
                endpoint: cinerino.credentials.chevre.endpoint,
                auth: chevreAuthClient
            });

            const membershipService = await productService.findById({
                id: productId
            });
            if (membershipService.project.id !== req.project.id) {
                throw new cinerino.factory.errors.NotFound('MembershipService');
            }

            const projectRepo = new cinerino.repository.Project(mongoose.connection);

            const offers = await cinerino.service.offer.product.search({
                project: { id: req.project.id },
                itemOffered: { id: productId },
                seller: { id: req.body.sellerId },
                availableAt: { id: req.user.client_id }
            })({ project: projectRepo });

            if (offers.length === 0) {
                throw new cinerino.factory.errors.NotFound('Offer');
            }

            // sskts専用なので、強制的に一つ目のオファーを選択
            const acceptedOffer = offers[0];

            const task = await cinerino.service.product.createOrderTask({
                project: { id: req.project.id },
                agent: req.agent,
                object: {
                    typeOf: cinerino.factory.chevre.offerType.Offer,
                    id: String(acceptedOffer.id),
                    itemOffered: { id: productId },
                    seller: {
                        typeOf: req.body.sellerType,
                        id: req.body.sellerId
                    }
                },
                location: { id: req.user.client_id }
            })({
                project: new cinerino.repository.Project(mongoose.connection),
                task: new cinerino.repository.Task(mongoose.connection)
            });

            // プロダクト注文タスクとして受け入れられたのでACCEPTED
            res.status(ACCEPTED)
                .json(task);
        } catch (error) {
            next(error);
        }
    }
);

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
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
            const taskRepo = new cinerino.repository.Task(mongoose.connection);

            // 現在所有している会員プログラムを全て検索
            const now = new Date();
            const ownershipInfos = await ownershipInfoRepo.search({
                project: { id: { $eq: req.project.id } },
                typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
                ownedBy: { id: req.agent.id },
                ownedFrom: now,
                ownedThrough: now
            });

            // 所有が確認できれば、会員プログラム登録解除タスクを作成する
            const unRegisterActionAttributes: cinerino.factory.action.interact.unRegister.programMembership.IAttributes[]
                = ownershipInfos.map((o) => {
                    return {
                        project: o.project,
                        typeOf: cinerino.factory.actionType.UnRegisterAction,
                        agent: req.agent,
                        object: {
                            ...o.typeOfGood,
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

            await taskRepo.save<cinerino.factory.taskName.DeleteMember>(deleteMemberTask);

            // 会員登録解除タスクとして受け入れられたのでACCEPTED
            res.status(ACCEPTED)
                .json(deleteMemberTask);
        } catch (error) {
            next(error);
        }
    }
);

export default me4cinemasunshineRouter;
