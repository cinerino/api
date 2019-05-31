/**
 * me(今ログイン中のユーザー)ルーター
 * Cinemasunshinに互換性を維持するためのルーター
 * 可能な部分から順次placeOrderTransactionsRouterへ移行していくことが望ましい
 */
import * as cinerino from '@cinerino/domain';
import { Request, Router } from 'express';
import { ACCEPTED } from 'http-status';
import * as moment from 'moment';
import * as mongoose from 'mongoose';

import permitScopes from '../../middlewares/permitScopes';
import validator from '../../middlewares/validator';

/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';

const CHECK_CARD_BEFORE_REGISTER_PROGRAM_MEMBERSHIP = process.env.CHECK_CARD_BEFORE_REGISTER_PROGRAM_MEMBERSHIP === '1';

const me4cinemasunshineRouter = Router();

/**
 * 会員プログラム登録
 */
me4cinemasunshineRouter.put(
    '/ownershipInfos/programMembership/register',
    permitScopes(['customer', 'people.ownershipInfos']),
    validator,
    // tslint:disable-next-line:max-func-body-length
    async (req, res, next) => {
        try {
            if (CHECK_CARD_BEFORE_REGISTER_PROGRAM_MEMBERSHIP) {
                await checkCard(req);
            }

            const task = await cinerino.service.programMembership.createRegisterTask({
                agent: req.agent,
                seller: {
                    typeOf: req.body.sellerType,
                    id: req.body.sellerId
                },
                programMembershipId: req.body.programMembershipId,
                offerIdentifier: req.body.offerIdentifier
            })({
                seller: new cinerino.repository.Seller(mongoose.connection),
                programMembership: new cinerino.repository.ProgramMembership(mongoose.connection),
                task: new cinerino.repository.Task(mongoose.connection)
            });
            // 会員登録タスクとして受け入れられたのでACCEPTED
            res.status(ACCEPTED)
                .json(task);
        } catch (error) {
            next(error);
        }
    }
);

// tslint:disable-next-line:max-func-body-length
async function checkCard(req: Request) {
    const projectRepo = new cinerino.repository.Project(mongoose.connection);
    const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
    const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);

    const project = await projectRepo.findById({ id: req.project.id });
    if (project.settings === undefined) {
        throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
    }
    if (project.settings.gmo === undefined) {
        throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
    }

    let creditCardPaymentAccepted: cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.CreditCard>;
    const seller = await sellerRepo.findById({ id: req.body.sellerId });
    if (seller.paymentAccepted === undefined) {
        throw new cinerino.factory.errors.Argument('transaction', 'Credit card payment not accepted.');
    }
    creditCardPaymentAccepted = <cinerino.factory.seller.IPaymentAccepted<cinerino.factory.paymentMethodType.CreditCard>>
        seller.paymentAccepted.find(
            (a) => a.paymentMethodType === cinerino.factory.paymentMethodType.CreditCard
        );
    if (creditCardPaymentAccepted === undefined) {
        throw new cinerino.factory.errors.Argument('transaction', 'Credit card payment not accepted.');
    }
    // tslint:disable-next-line:no-single-line-block-comment
    /* istanbul ignore next */
    if (creditCardPaymentAccepted.gmoInfo.shopPass === undefined) {
        throw new cinerino.factory.errors.Argument('transaction', 'Credit card payment settings not enough');
    }

    // 事前にクレジットカードを登録しているはず
    const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
    const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
        siteId: project.settings.gmo.siteId,
        sitePass: project.settings.gmo.sitePass,
        cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
    });
    const searchCardResults = await creditCardRepo.search({ personId: memberId });
    const creditCard = searchCardResults.shift();
    if (creditCard === undefined) {
        throw new cinerino.factory.errors.NotFound('CreditCard');
    }

    // カード有効性チェックのために取引開始
    const transaction = await transactionRepo.start({
        project: { typeOf: project.typeOf, id: project.id },
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        agent: req.agent,
        seller: {
            id: seller.id,
            typeOf: seller.typeOf,
            name: seller.name,
            location: seller.location,
            telephone: seller.telephone,
            url: seller.url,
            image: seller.image
        },
        object: {
            clientUser: req.user,
            authorizeActions: []
        },
        expires: moment()
            .add(1, 'minutes')
            .toDate()
    });

    const orderId = cinerino.service.payment.creditCard.generateOrderId({
        project: project,
        transaction: { id: transaction.id }
    });

    try {
        const creditService = new cinerino.GMO.service.Credit({ endpoint: project.settings.gmo.endpoint });
        const entryTranResult = await creditService.entryTran({
            shopId: creditCardPaymentAccepted.gmoInfo.shopId,
            shopPass: creditCardPaymentAccepted.gmoInfo.shopPass,
            orderId: orderId,
            jobCd: cinerino.GMO.utils.util.JobCd.Check,
            amount: <any>undefined
        });

        await creditService.execTran({
            accessId: entryTranResult.accessId,
            accessPass: entryTranResult.accessPass,
            orderId: orderId,
            method: cinerino.GMO.utils.util.Method.Lump,
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            memberId: memberId,
            cardSeq: Number(creditCard.cardSeq),
            seqMode: cinerino.GMO.utils.util.SeqMode.Physics
        });
    } catch (error) {
        if (error.name === 'GMOServiceBadRequestError') {
            // consider E92000001,E92000002
            // GMO流量制限オーバーエラーの場合
            const serviceUnavailableError = error.errors.find((gmoError: any) => gmoError.info.match(/^E92000001|E92000002$/));
            if (serviceUnavailableError !== undefined) {
                throw new cinerino.factory.errors.RateLimitExceeded(serviceUnavailableError.userMessage);
            }

            // その他のGMOエラーに場合、なんらかのクライアントエラー
            throw new cinerino.factory.errors.Argument('Invalid Credit Card');
        }

        throw error;
    }
}

/**
 * 会員プログラム登録解除
 * 所有権のidentifierをURLで指定
 */
me4cinemasunshineRouter.put(
    '/ownershipInfos/programMembership/:identifier/unRegister',
    permitScopes(['customer', 'people.ownershipInfos']),
    validator,
    async (req, res, next) => {
        try {
            const task = await cinerino.service.programMembership.createUnRegisterTask({
                agent: req.agent,
                ownershipInfoIdentifier: req.params.identifier
            })({
                ownershipInfo: new cinerino.repository.OwnershipInfo(mongoose.connection),
                task: new cinerino.repository.Task(mongoose.connection)
            });
            // 会員登録解除タスクとして受け入れられたのでACCEPTED
            res.status(ACCEPTED)
                .json(task);
        } catch (error) {
            next(error);
        }
    }
);

export default me4cinemasunshineRouter;
