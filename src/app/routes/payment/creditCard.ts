/**
 * クレジットカード決済ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
// tslint:disable-next-line:no-submodule-imports
import { body } from 'express-validator/check';
import { CREATED, NO_CONTENT } from 'http-status';
import * as mongoose from 'mongoose';

import authentication from '../../middlewares/authentication';
import permitScopes from '../../middlewares/permitScopes';
import rateLimit4transactionInProgress from '../../middlewares/rateLimit4transactionInProgress';
import validator from '../../middlewares/validator';

/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';

const creditCardPaymentRouter = Router();
creditCardPaymentRouter.use(authentication);

/**
 * クレジットカード決済承認
 */
creditCardPaymentRouter.post(
    '/authorize',
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    ...[
        body('object.typeOf')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('object.amount')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
            .isInt(),
        body('object.additionalProperty')
            .optional()
            .isArray(),
        body('object.orderId')
            .optional()
            .isString()
            .withMessage((_, options) => `${options.path} must be string`)
            .isLength({ max: 27 }),
        body('object.method')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required'),
        body('object.creditCard')
            .not()
            .isEmpty()
            .withMessage((_, __) => 'required')
    ],
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: req.body.purpose.typeOf,
            id: <string>req.body.purpose.id
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            // 会員IDを強制的にログイン中の人物IDに変更
            type ICreditCard4authorizeAction = cinerino.factory.action.authorize.paymentMethod.creditCard.ICreditCard;
            const memberId = (USE_USERNAME_AS_GMO_MEMBER_ID) ? <string>req.user.username : req.user.sub;
            const creditCard: ICreditCard4authorizeAction = {
                ...req.body.object.creditCard,
                memberId: memberId
            };

            const action = await cinerino.service.payment.creditCard.authorize({
                project: {
                    id: <string>process.env.PROJECT_ID,
                    gmoInfo: {
                        siteId: <string>process.env.GMO_SITE_ID,
                        sitePass: <string>process.env.GMO_SITE_PASS
                    }
                },
                agent: { id: req.user.sub },
                object: {
                    typeOf: cinerino.factory.paymentMethodType.CreditCard,
                    additionalProperty: req.body.object.additionalProperty,
                    orderId: req.body.object.orderId,
                    amount: req.body.object.amount,
                    method: req.body.object.method,
                    creditCard: creditCard
                },
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection),
                seller: new cinerino.repository.Seller(mongoose.connection)
            });

            if (action.result !== undefined) {
                delete action.result.entryTranArgs;
                delete action.result.entryTranResult;
                delete action.result.execTranArgs;
                delete action.result.execTranResult;
            }

            res.status(CREATED)
                .json(action);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * クレジットカード決済承認取消
 */
creditCardPaymentRouter.put(
    '/authorize/:actionId/void',
    permitScopes(['admin', 'aws.cognito.signin.user.admin', 'transactions']),
    validator,
    async (req, res, next) => {
        await rateLimit4transactionInProgress({
            typeOf: req.body.purpose.typeOf,
            id: <string>req.body.purpose.id
        })(req, res, next);
    },
    async (req, res, next) => {
        try {
            await cinerino.service.payment.creditCard.voidTransaction({
                agent: { id: req.user.sub },
                id: req.params.actionId,
                purpose: { typeOf: req.body.purpose.typeOf, id: <string>req.body.purpose.id }
            })({
                action: new cinerino.repository.Action(mongoose.connection),
                transaction: new cinerino.repository.Transaction(mongoose.connection)
            });

            res.status(NO_CONTENT)
                .end();
        } catch (error) {
            next(error);
        }
    }
);

export default creditCardPaymentRouter;
