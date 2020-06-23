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
 * me(今ログイン中のユーザー)ルーター
 * Cinemasunshinに互換性を維持するためのルーター
 * 可能な部分から順次placeOrderTransactionsRouterへ移行していくことが望ましい
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const http_status_1 = require("http-status");
// import * as moment from 'moment';
const mongoose = require("mongoose");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const validator_1 = require("../../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
// const CHECK_CARD_BEFORE_REGISTER_PROGRAM_MEMBERSHIP = process.env.CHECK_CARD_BEFORE_REGISTER_PROGRAM_MEMBERSHIP === '1';
const me4cinemasunshineRouter = express_1.Router();
/**
 * メンバーシップ登録
 */
me4cinemasunshineRouter.put('/ownershipInfos/programMembership/register', permitScopes_1.default(['people.ownershipInfos', 'people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (typeof ((_b = (_a = project.settings) === null || _a === void 0 ? void 0 : _a.chevre) === null || _b === void 0 ? void 0 : _b.endpoint) !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const productId = req.body.programMembershipId;
        const productService = new cinerino.chevre.service.Product({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        const offers = yield productService.searchOffers({ id: productId });
        if (offers.length === 0) {
            throw new cinerino.factory.errors.NotFound('offers');
        }
        // sskts専用なので、強制的に一つ目のオファーを選択
        const acceptedOffer = offers[0];
        // if (CHECK_CARD_BEFORE_REGISTER_PROGRAM_MEMBERSHIP) {
        //     if (programMembership.offers === undefined) {
        //         throw new cinerino.factory.errors.NotFound('ProgramMembership.offers');
        //     }
        //     const offer = programMembership.offers.find((o) => o.identifier === req.body.offerIdentifier);
        //     if (offer === undefined) {
        //         throw new cinerino.factory.errors.NotFound('Offer');
        //     }
        //     if (typeof offer.priceSpecification?.price !== 'number') {
        //         throw new cinerino.factory.errors.NotFound('Offer Price undefined');
        //     }
        //     await checkCard(req, offer.priceSpecification?.price);
        // }
        const task = yield cinerino.service.product.createOrderTask({
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
            }
        })({
            seller: new cinerino.repository.Seller(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
            task: new cinerino.repository.Task(mongoose.connection)
        });
        // プロダクト注文タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED)
            .json(task);
    }
    catch (error) {
        next(error);
    }
}));
// tslint:disable-next-line:max-func-body-length
// async function checkCard(req: Request, amount: number) {
//     const projectRepo = new cinerino.repository.Project(mongoose.connection);
//     const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
//     const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
//     const project = await projectRepo.findById({ id: req.project.id });
//     if (project.settings === undefined) {
//         throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
//     }
//     if (project.settings.gmo === undefined) {
//         throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
//     }
//     let creditCardPaymentAccepted: cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.CreditCard>;
//     const seller = await sellerRepo.findById({ id: req.body.sellerId });
//     if (seller.paymentAccepted === undefined) {
//         throw new cinerino.factory.errors.Argument('transaction', 'Credit card payment not accepted.');
//     }
//     creditCardPaymentAccepted = <cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.CreditCard>>
//         seller.paymentAccepted.find(
//             (a) => a.paymentMethodType === cinerino.factory.paymentMethodType.CreditCard
//         );
//     if (creditCardPaymentAccepted === undefined) {
//         throw new cinerino.factory.errors.Argument('transaction', 'Credit card payment not accepted.');
//     }
//     // tslint:disable-next-line:no-single-line-block-comment
//     /* istanbul ignore next */
//     if (creditCardPaymentAccepted.gmoInfo.shopPass === undefined) {
//         throw new cinerino.factory.errors.Argument('transaction', 'Credit card payment settings not enough');
//     }
//     // 事前にクレジットカードを登録しているはず
//     const useUsernameAsGMOMemberId = project.settings !== undefined && project.settings.useUsernameAsGMOMemberId === true;
//     const memberId = (useUsernameAsGMOMemberId) ? <string>req.user.username : req.user.sub;
//     const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
//         siteId: project.settings.gmo.siteId,
//         sitePass: project.settings.gmo.sitePass,
//         cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
//     });
//     const searchCardResults = await creditCardRepo.search({ personId: memberId });
//     const creditCard = searchCardResults.shift();
//     if (creditCard === undefined) {
//         throw new cinerino.factory.errors.NotFound('CreditCard');
//     }
//     // カード有効性確認のために取引開始
//     const transaction = await transactionRepo.start({
//         project: { typeOf: project.typeOf, id: project.id },
//         typeOf: cinerino.factory.transactionType.PlaceOrder,
//         agent: req.agent,
//         seller: {
//             project: req.project,
//             id: seller.id,
//             typeOf: seller.typeOf,
//             name: seller.name,
//             location: seller.location,
//             telephone: seller.telephone,
//             url: seller.url,
//             image: seller.image
//         },
//         object: {
//             authorizeActions: []
//         },
//         expires: moment()
//             .add(1, 'minutes')
//             .toDate()
//     });
//     // カードが有効でなければ、ここでエラーのはず
//     await cinerino.service.payment.creditCard.authorize({
//         project: { id: project.id },
//         agent: { id: req.user.sub },
//         object: {
//             additionalProperty: [{ name: 'CheckForProgramMembership', value: '1' }],
//             typeOf: cinerino.factory.paymentMethodType.CreditCard,
//             amount: amount,
//             method: cinerino.GMO.utils.util.Method.Lump,
//             creditCard: {
//                 memberId: memberId,
//                 cardSeq: Number(creditCard.cardSeq)
//             }
//         },
//         purpose: { typeOf: transaction.typeOf, id: transaction.id }
//     })({
//         action: new cinerino.repository.Action(mongoose.connection),
//         project: new cinerino.repository.Project(mongoose.connection),
//         seller: new cinerino.repository.Seller(mongoose.connection),
//         transaction: new cinerino.repository.Transaction(mongoose.connection)
//     });
//     // 確認のためだけの取引なので、すぐに中止
//     await transactionRepo.cancel({
//         typeOf: transaction.typeOf,
//         id: transaction.id
//     });
// }
/**
 * 会員プログラム登録解除
 * 所有権のidentifierをURLで指定
 * @deprecated シネマサンシャインで「退会処理」として使用(機を見てエンドポイントを変更したい)
 */
me4cinemasunshineRouter.put('/ownershipInfos/programMembership/:identifier/unRegister', permitScopes_1.default(['people.ownershipInfos', 'people.me.*']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        // 現在所有している会員プログラムを全て検索
        const now = new Date();
        const ownershipInfos = yield ownershipInfoRepo.search({
            project: { id: { $eq: req.project.id } },
            typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
            ownedBy: { id: req.agent.id },
            ownedFrom: now,
            ownedThrough: now
        });
        // 所有が確認できれば、会員プログラム登録解除タスクを作成する
        const unRegisterActionAttributes = ownershipInfos.map((o) => {
            return {
                project: o.project,
                typeOf: cinerino.factory.actionType.UnRegisterAction,
                agent: req.agent,
                object: Object.assign(Object.assign({}, o.typeOfGood), { member: [req.agent] })
            };
        });
        // 会員削除タスクを作成
        const deleteMemberAction = {
            agent: req.agent,
            object: req.agent,
            project: req.project,
            potentialActions: {
                unRegisterProgramMembership: unRegisterActionAttributes
            },
            typeOf: cinerino.factory.actionType.DeleteAction
        };
        const deleteMemberTask = {
            project: req.project,
            name: cinerino.factory.taskName.DeleteMember,
            status: cinerino.factory.taskStatus.Ready,
            runsAt: now,
            remainingNumberOfTries: 10,
            numberOfTried: 0,
            executionResults: [],
            data: deleteMemberAction
        };
        yield taskRepo.save(deleteMemberTask);
        // 会員登録解除タスクとして受け入れられたのでACCEPTED
        res.status(http_status_1.ACCEPTED)
            .json(deleteMemberTask);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = me4cinemasunshineRouter;
