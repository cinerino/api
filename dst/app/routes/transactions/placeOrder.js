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
exports.authorizePointAward = void 0;
/**
 * 注文取引ルーター
 */
const cinerino = require("@cinerino/domain");
// import * as createDebug from 'debug';
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const lockTransaction_1 = require("../../middlewares/lockTransaction");
const permitScopes_1 = require("../../middlewares/permitScopes");
const rateLimit_1 = require("../../middlewares/rateLimit");
const rateLimit4transactionInProgress_1 = require("../../middlewares/rateLimit4transactionInProgress");
const validator_1 = require("../../middlewares/validator");
const placeOrder4cinemasunshine_1 = require("./placeOrder4cinemasunshine");
const connectMongo_1 = require("../../../connectMongo");
const redis = require("../../../redis");
const ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH = (process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH !== undefined)
    ? Number(process.env.ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH)
    // tslint:disable-next-line:no-magic-numbers
    : 256;
const WAITER_DISABLED = process.env.WAITER_DISABLED === '1';
const NUM_ORDER_ITEMS_MAX_VALUE = (process.env.NUM_ORDER_ITEMS_MAX_VALUE !== undefined)
    ? Number(process.env.NUM_ORDER_ITEMS_MAX_VALUE)
    // tslint:disable-next-line:no-magic-numbers
    : 50;
const DEFAULT_ORDER_NAME = process.env.DEFAULT_ORDER_NAME;
const placeOrderTransactionsRouter = express_1.Router();
// const debug = createDebug('cinerino-api:router');
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const mvtkReserveAuthClient = new cinerino.mvtkreserveapi.auth.ClientCredentials({
    domain: process.env.MVTK_RESERVE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.MVTK_RESERVE_CLIENT_ID,
    clientSecret: process.env.MVTK_RESERVE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
// Cinemasunshine対応
placeOrderTransactionsRouter.use(placeOrder4cinemasunshine_1.default);
placeOrderTransactionsRouter.post('/start', permitScopes_1.default(['transactions', 'pos']), 
// Cinemasunshine互換性維持のため
(req, _, next) => {
    if (typeof req.body.sellerId === 'string') {
        req.body.seller = {
            typeOf: cinerino.factory.organizationType.MovieTheater,
            id: req.body.sellerId
        };
    }
    if (typeof req.body.passportToken === 'string') {
        req.body.object = {
            passport: { token: req.body.passportToken }
        };
    }
    next();
}, ...[
    express_validator_1.body('expires')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
        .isISO8601()
        .toDate(),
    express_validator_1.body('agent.identifier')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('agent.identifier.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('agent.identifier.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('seller.typeOf')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('seller.id')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    ...(!WAITER_DISABLED)
        ? [
            express_validator_1.body('object.passport.token')
                .not()
                .isEmpty()
                .withMessage((_, __) => 'required')
        ]
        : []
], validator_1.default, 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const now = new Date();
        // WAITER有効設定であれば許可証をセット
        let passport;
        if (!WAITER_DISABLED) {
            if (process.env.WAITER_PASSPORT_ISSUER === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('WAITER_PASSPORT_ISSUER undefined');
            }
            if (process.env.WAITER_SECRET === undefined) {
                throw new cinerino.factory.errors.ServiceUnavailable('WAITER_SECRET undefined');
            }
            passport = {
                token: req.body.object.passport.token,
                issuer: process.env.WAITER_PASSPORT_ISSUER,
                secret: process.env.WAITER_SECRET
            };
        }
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const expires = req.body.expires;
        const seller = yield sellerRepo.findById({ id: req.body.seller.id });
        const passportValidator = (params) => {
            // 許可証発行者確認
            const validIssuer = params.passport.iss === process.env.WAITER_PASSPORT_ISSUER;
            // スコープのフォーマットは、Transaction:PlaceOrder:${sellerId}
            const newExplodedScopeStrings = params.passport.scope.split(':');
            const newValidScope = (newExplodedScopeStrings[0] === 'Transaction' && // スコープ接頭辞確認
                newExplodedScopeStrings[1] === cinerino.factory.transactionType.PlaceOrder && // スコープ接頭辞確認
                // tslint:disable-next-line:no-magic-numbers
                newExplodedScopeStrings[2] === req.body.seller.id // 販売者識別子確認
            );
            // スコープのフォーマットは、placeOrderTransaction.${sellerIdentifier}
            // cinemasunshine対応
            const oldExplodedScopeStrings = params.passport.scope.split('.');
            const oldValidScope = (oldExplodedScopeStrings[0] === 'placeOrderTransaction' && // スコープ接頭辞確認
                oldExplodedScopeStrings[1] === seller.identifier // 販売者識別子確認
            );
            // スコープスタイルは新旧どちらか一方有効であれok
            const validScope = newValidScope || oldValidScope;
            // クライアントの有効性
            let validClient = true;
            if (req.user.client_id !== undefined) {
                if (Array.isArray(params.passport.aud) && params.passport.aud.indexOf(req.user.client_id) < 0) {
                    validClient = false;
                }
            }
            return validIssuer && validScope && validClient;
        };
        const project = yield projectRepo.findById({ id: req.project.id });
        const useTransactionClientUser = project.settings !== undefined && project.settings.useTransactionClientUser === true;
        // 現在所有している会員プログラムを全て検索
        const programMembershipOwnershipInfos = yield ownershipInfoRepo.search({
            project: { id: { $eq: req.project.id } },
            typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
            ownedBy: { id: req.agent.id },
            ownedFrom: now,
            ownedThrough: now
        });
        const orderName = (typeof ((_a = req.body.object) === null || _a === void 0 ? void 0 : _a.name) === 'string') ? (_b = req.body.object) === null || _b === void 0 ? void 0 : _b.name : DEFAULT_ORDER_NAME;
        const transaction = yield cinerino.service.transaction.placeOrderInProgress.start({
            project: req.project,
            expires: expires,
            agent: Object.assign(Object.assign(Object.assign({}, req.agent), { identifier: [
                    ...(Array.isArray(req.agent.identifier)) ? req.agent.identifier : [],
                    ...(Array.isArray((_c = req.body.agent) === null || _c === void 0 ? void 0 : _c.identifier))
                        ? req.body.agent.identifier.map((p) => {
                            return { name: String(p.name), value: String(p.value) };
                        })
                        : []
                ] }), { memberOfs: programMembershipOwnershipInfos.map((o) => o.typeOfGood) }),
            seller: req.body.seller,
            object: Object.assign(Object.assign({ passport: passport }, (useTransactionClientUser) ? { clientUser: req.user } : undefined), (typeof orderName === 'string') ? { name: orderName } : undefined),
            passportValidator: passportValidator
        })({
            project: projectRepo,
            seller: sellerRepo,
            transaction: transactionRepo
        });
        // tslint:disable-next-line:no-string-literal
        // const host = req.headers['host'];
        // res.setHeader('Location', `https://${host}/transactions/${transaction.id}`);
        res.json(transaction);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 購入者情報を変更する
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put('/:transactionId/customerContact', permitScopes_1.default(['transactions', 'pos']), ...[
    express_validator_1.body('additionalProperty')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('additionalProperty.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('additionalProperty.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('email')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('familyName')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('givenName')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required'),
    express_validator_1.body('telephone')
        .not()
        .isEmpty()
        .withMessage((_, __) => 'required')
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let requestedNumber = String(req.body.telephone);
        try {
            // cinemasunshine対応として、国内向け電話番号フォーマットであれば、強制的に日本国番号を追加
            if (requestedNumber.slice(0, 1) === '0' && typeof req.body.telephoneRegion !== 'string') {
                requestedNumber = `+81${requestedNumber.slice(1)}`;
            }
        }
        catch (error) {
            throw new cinerino.factory.errors.Argument('Telephone', `Unexpected value: ${error.message}`);
        }
        const profile = yield cinerino.service.transaction.updateAgent({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId,
            agent: Object.assign(Object.assign({}, req.body), { typeOf: cinerino.factory.personType.Person, id: req.user.sub, telephone: requestedNumber })
        })({
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引人プロフィール変更
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put('/:transactionId/agent', permitScopes_1.default(['transactions', 'pos']), ...[
    express_validator_1.body('additionalProperty')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('additionalProperty.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('additionalProperty.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.updateAgent({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId,
            agent: Object.assign(Object.assign({}, req.body), { typeOf: cinerino.factory.personType.Person, id: req.user.sub })
        })({
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/offer/seatReservation', permitScopes_1.default(['transactions']), ...[
    express_validator_1.body('object.acceptedOffer.additionalProperty')
        .optional()
        .isArray({ max: 10 }),
    express_validator_1.body('object.acceptedOffer.additionalProperty.*.name')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH }),
    express_validator_1.body('object.acceptedOffer.additionalProperty.*.value')
        .optional()
        .not()
        .isEmpty()
        .isString()
        .isLength({ max: ADDITIONAL_PROPERTY_VALUE_MAX_LENGTH })
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (typeof ((_e = (_d = project.settings) === null || _d === void 0 ? void 0 : _d.mvtkReserve) === null || _e === void 0 ? void 0 : _e.endpoint) !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        const action = yield cinerino.service.offer.seatReservation.create({
            project: req.project,
            object: Object.assign({}, req.body),
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            movieTicket: new cinerino.repository.paymentMethod.MovieTicket({
                endpoint: project.settings.mvtkReserve.endpoint,
                auth: mvtkReserveAuthClient
            }),
            project: projectRepo,
            seller: new cinerino.repository.Seller(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.CREATED)
            .json(action);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 座席仮予約取消
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/offer/seatReservation/:actionId/cancel', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.offer.seatReservation.cancel({
            project: req.project,
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId },
            id: req.params.actionId
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            project: new cinerino.repository.Project(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * インセンティブ承認アクション
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.post('/:transactionId/actions/authorize/award/accounts/point', permitScopes_1.default(['transactions']), ...[], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield authorizePointAward(req);
        res.status(http_status_1.CREATED)
            .json({
            id: 'dummy',
            purpose: { typeOf: cinerino.factory.transactionType.PlaceOrder, id: req.params.transactionId }
        });
    }
    catch (error) {
        next(error);
    }
}));
// tslint:disable-next-line:max-func-body-length
function authorizePointAward(req) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        const notes = req.body.notes;
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (typeof ((_b = (_a = project.settings) === null || _a === void 0 ? void 0 : _a.chevre) === null || _b === void 0 ? void 0 : _b.endpoint) !== 'string') {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not satisfied');
        }
        const productService = new cinerino.chevre.service.Product({
            endpoint: project.settings.chevre.endpoint,
            auth: chevreAuthClient
        });
        // 所有メンバーシップを検索
        const programMembershipOwnershipInfos = yield ownershipInfoRepo.search({
            project: { id: { $eq: req.project.id } },
            typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
            ownedBy: { id: req.agent.id },
            ownedFrom: now,
            ownedThrough: now
        });
        const programMemberships = programMembershipOwnershipInfos.map((o) => o.typeOfGood);
        if (programMemberships.length > 0) {
            const givePointAwardParams = [];
            for (const programMembership of programMemberships) {
                const membershipServiceId = (_c = programMembership.membershipFor) === null || _c === void 0 ? void 0 : _c.id;
                const membershipService = yield productService.findById({ id: membershipServiceId });
                // 登録時の獲得ポイント
                let membershipServiceOutput = membershipService.serviceOutput;
                // 元々配列型だったので、互換性維持対応として
                if (!Array.isArray(membershipServiceOutput)) {
                    membershipServiceOutput = [membershipServiceOutput];
                }
                if (Array.isArray(membershipServiceOutput)) {
                    yield Promise.all(membershipServiceOutput
                        .map((serviceOutput) => __awaiter(this, void 0, void 0, function* () {
                        var _d, _e, _f;
                        const membershipPointsEarnedName = (_d = serviceOutput.membershipPointsEarned) === null || _d === void 0 ? void 0 : _d.name;
                        const membershipPointsEarnedValue = (_e = serviceOutput.membershipPointsEarned) === null || _e === void 0 ? void 0 : _e.value;
                        const membershipPointsEarnedUnitText = (_f = serviceOutput.membershipPointsEarned) === null || _f === void 0 ? void 0 : _f.unitText;
                        if (typeof membershipPointsEarnedValue === 'number' && typeof membershipPointsEarnedUnitText === 'string') {
                            // 所有口座を検索
                            // 最も古い所有口座をデフォルト口座として扱う使用なので、ソート条件はこの通り
                            let accountOwnershipInfos = yield cinerino.service.account.search({
                                project: { typeOf: req.project.typeOf, id: req.project.id },
                                conditions: {
                                    sort: { ownedFrom: cinerino.factory.sortType.Ascending },
                                    limit: 1,
                                    typeOfGood: {
                                        typeOf: cinerino.factory.ownershipInfo.AccountGoodType.Account,
                                        accountType: membershipPointsEarnedUnitText
                                    },
                                    ownedBy: { id: req.agent.id },
                                    ownedFrom: now,
                                    ownedThrough: now
                                }
                            })({
                                ownershipInfo: ownershipInfoRepo,
                                project: projectRepo
                            });
                            // 開設口座に絞る
                            accountOwnershipInfos = accountOwnershipInfos.filter((o) => o.typeOfGood.status === cinerino.factory.pecorino.accountStatusType.Opened);
                            if (accountOwnershipInfos.length === 0) {
                                throw new cinerino.factory.errors.NotFound('accountOwnershipInfos');
                            }
                            const toAccount = accountOwnershipInfos[0].typeOfGood;
                            givePointAwardParams.push({
                                object: {
                                    typeOf: cinerino.factory.action.authorize.award.point.ObjectType.PointAward,
                                    amount: membershipPointsEarnedValue,
                                    toLocation: {
                                        accountType: membershipPointsEarnedUnitText,
                                        accountNumber: toAccount.accountNumber
                                    },
                                    description: (typeof notes === 'string') ? notes : membershipPointsEarnedName
                                }
                            });
                        }
                    })));
                }
            }
            yield cinerino.service.transaction.placeOrderInProgress.authorizeAward({
                transaction: { id: req.params.transactionId },
                agent: { id: req.agent.id },
                object: {
                    potentialActions: {
                        givePointAwardParams: givePointAwardParams
                    }
                }
            })({
                action: actionRepo,
                transaction: transactionRepo
            });
        }
    });
}
exports.authorizePointAward = authorizePointAward;
/**
 * インセンティブ承認アクション取消
 */
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put('/:transactionId/actions/authorize/award/accounts/point/:actionId/cancel', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cinerino.service.transaction.placeOrderInProgress.voidAward({
            agent: { id: req.user.sub },
            transaction: { id: req.params.transactionId }
        })({
            action: new cinerino.repository.Action(mongoose.connection),
            transaction: new cinerino.repository.Transaction(mongoose.connection)
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
// tslint:disable-next-line:use-default-type-parameter
placeOrderTransactionsRouter.put('/:transactionId/confirm', permitScopes_1.default(['transactions', 'pos']), ...[
    // Eメールカスタマイズのバリデーション
    express_validator_1.body([
        'emailTemplate',
        'email.about',
        'email.template',
        'email.sender.email',
        'email.toRecipient.email',
        'options.email.about',
        'options.email.template',
        'options.email.sender.email',
        'options.email.toRecipient.email'
    ])
        .optional()
        .not()
        .isEmpty()
        .withMessage((_, options) => `${options.path} must not be empty`)
        .isString()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), 
// tslint:disable-next-line:max-func-body-length
(req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
    try {
        const orderDate = new Date();
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const confirmationNumberRepo = new cinerino.repository.ConfirmationNumber(redis.getClient());
        const orderNumberRepo = new cinerino.repository.OrderNumber(redis.getClient());
        const sellerRepo = new cinerino.repository.Seller(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const sendEmailMessage = req.body.sendEmailMessage === true;
        let email = req.body.email;
        // 互換性維持のため、テンプレートオプションを変換
        if (req.body.emailTemplate !== undefined) {
            if (email === undefined) {
                email = {};
            }
            email.template = String(req.body.emailTemplate);
        }
        const potentialActions = Object.assign(Object.assign({}, req.body.potentialActions), { order: Object.assign(Object.assign({}, (_f = req.body.potentialActions) === null || _f === void 0 ? void 0 : _f.order), { potentialActions: Object.assign(Object.assign({}, (_h = (_g = req.body.potentialActions) === null || _g === void 0 ? void 0 : _g.order) === null || _h === void 0 ? void 0 : _h.potentialActions), { sendOrder: Object.assign(Object.assign({}, (_l = (_k = (_j = req.body.potentialActions) === null || _j === void 0 ? void 0 : _j.order) === null || _k === void 0 ? void 0 : _k.potentialActions) === null || _l === void 0 ? void 0 : _l.sendOrder), { potentialActions: Object.assign(Object.assign({}, (_q = (_p = (_o = (_m = req.body.potentialActions) === null || _m === void 0 ? void 0 : _m.order) === null || _o === void 0 ? void 0 : _o.potentialActions) === null || _p === void 0 ? void 0 : _p.sendOrder) === null || _q === void 0 ? void 0 : _q.potentialActions), { sendEmailMessage: [
                                // tslint:disable-next-line:max-line-length
                                ...(Array.isArray((_v = (_u = (_t = (_s = (_r = req.body.potentialActions) === null || _r === void 0 ? void 0 : _r.order) === null || _s === void 0 ? void 0 : _s.potentialActions) === null || _t === void 0 ? void 0 : _t.sendOrder) === null || _u === void 0 ? void 0 : _u.potentialActions) === null || _v === void 0 ? void 0 : _v.sendEmailMessage))
                                    // tslint:disable-next-line:max-line-length
                                    ? (_0 = (_z = (_y = (_x = (_w = req.body.potentialActions) === null || _w === void 0 ? void 0 : _w.order) === null || _x === void 0 ? void 0 : _x.potentialActions) === null || _y === void 0 ? void 0 : _y.sendOrder) === null || _z === void 0 ? void 0 : _z.potentialActions) === null || _0 === void 0 ? void 0 : _0.sendEmailMessage : [],
                                ...(sendEmailMessage) ? [{ object: email }] : []
                            ] }) }) }) }) });
        let confirmationNumber;
        const project = yield projectRepo.findById({ id: req.project.id });
        const useReservationNumberAsConfirmationNumber = ((_1 = project.settings) === null || _1 === void 0 ? void 0 : _1.useReservationNumberAsConfirmationNumber) === true;
        if (useReservationNumberAsConfirmationNumber) {
            confirmationNumber = (params) => {
                const firstOffer = params.acceptedOffers[0];
                // COAに適合させるため、座席予約の場合、予約番号を確認番号として設定
                if (firstOffer !== undefined
                    && firstOffer.itemOffered.typeOf === cinerino.factory.chevre.reservationType.EventReservation) {
                    return String(firstOffer.itemOffered.reservationNumber);
                }
                else {
                    return params.confirmationNumber;
                }
            };
        }
        const resultOrderParams = Object.assign(Object.assign({}, (_2 = req.body.result) === null || _2 === void 0 ? void 0 : _2.order), { confirmationNumber: confirmationNumber, orderDate: orderDate, numItems: {
                maxValue: NUM_ORDER_ITEMS_MAX_VALUE
                // minValue: 0
            } });
        const result = yield cinerino.service.transaction.placeOrderInProgress.confirm(Object.assign(Object.assign({}, req.body), { agent: { id: req.user.sub }, id: req.params.transactionId, potentialActions: potentialActions, project: req.project, result: Object.assign(Object.assign({}, req.body.result), { order: resultOrderParams }) }))({
            action: actionRepo,
            project: projectRepo,
            transaction: transactionRepo,
            confirmationNumber: confirmationNumberRepo,
            orderNumber: orderNumberRepo,
            seller: sellerRepo
        });
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.exportTasks({
            project: req.project,
            status: cinerino.factory.transactionStatusType.Confirmed,
            typeOf: { $in: [cinerino.factory.transactionType.PlaceOrder] }
        })({
            project: projectRepo,
            task: taskRepo,
            transaction: transactionRepo
        })
            .then((tasks) => __awaiter(void 0, void 0, void 0, function* () {
            // タスクがあればすべて実行
            if (Array.isArray(tasks)) {
                yield Promise.all(tasks.map((task) => __awaiter(void 0, void 0, void 0, function* () {
                    yield cinerino.service.task.executeByName(task)({
                        connection: mongoose.connection,
                        redisClient: redis.getClient()
                    });
                })));
            }
        }));
        res.json(result);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引を明示的に中止
 */
placeOrderTransactionsRouter.put('/:transactionId/cancel', permitScopes_1.default(['transactions']), validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield rateLimit4transactionInProgress_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield lockTransaction_1.default({
        typeOf: cinerino.factory.transactionType.PlaceOrder,
        id: req.params.transactionId
    })(req, res, next);
}), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        yield transactionRepo.cancel({
            typeOf: cinerino.factory.transactionType.PlaceOrder,
            id: req.params.transactionId
        });
        // 非同期でタスクエクスポート(APIレスポンスタイムに影響を与えないように)
        // tslint:disable-next-line:no-floating-promises
        cinerino.service.transaction.exportTasks({
            project: req.project,
            status: cinerino.factory.transactionStatusType.Canceled,
            typeOf: { $in: [cinerino.factory.transactionType.PlaceOrder] }
        })({
            project: projectRepo,
            task: taskRepo,
            transaction: transactionRepo
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引検索
 */
placeOrderTransactionsRouter.get('', permitScopes_1.default(['transactions.*', 'transactions.read']), rateLimit_1.default, ...[
    express_validator_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transactionRepo = new cinerino.repository.Transaction(mongoose.connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, typeOf: cinerino.factory.transactionType.PlaceOrder });
        const transactions = yield transactionRepo.search(searchConditions);
        res.json(transactions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引に対するアクション検索
 */
placeOrderTransactionsRouter.get('/:transactionId/actions', permitScopes_1.default(['transactions.*', 'transactions.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const actions = yield actionRepo.searchByPurpose({
            purpose: {
                typeOf: cinerino.factory.transactionType.PlaceOrder,
                id: req.params.transactionId
            },
            sort: req.query.sort
        });
        res.json(actions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 取引レポート
 */
placeOrderTransactionsRouter.get('/report', permitScopes_1.default([]), rateLimit_1.default, ...[
    express_validator_1.query('startFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('startThrough')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('endThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    let connection;
    try {
        connection = yield connectMongo_1.connectMongo({
            defaultConnection: false,
            disableCheck: true
        });
        const transactionRepo = new cinerino.repository.Transaction(connection);
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: undefined, page: undefined, typeOf: cinerino.factory.transactionType.PlaceOrder });
        const format = req.query.format;
        const stream = yield cinerino.service.report.transaction.stream({
            conditions: searchConditions,
            format: format
        })({ transaction: transactionRepo });
        res.type(`${req.query.format}; charset=utf-8`);
        stream.pipe(res)
            .on('error', () => __awaiter(void 0, void 0, void 0, function* () {
            if (connection !== undefined) {
                yield connection.close();
            }
        }))
            .on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
            if (connection !== undefined) {
                yield connection.close();
            }
        }));
    }
    catch (error) {
        if (connection !== undefined) {
            yield connection.close();
        }
        next(error);
    }
}));
exports.default = placeOrderTransactionsRouter;
