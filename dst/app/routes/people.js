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
 * 会員ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const permitScopes_1 = require("../middlewares/permitScopes");
const rateLimit_1 = require("../middlewares/rateLimit");
const validator_1 = require("../middlewares/validator");
const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
    domain: process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.CHEVRE_CLIENT_ID,
    clientSecret: process.env.CHEVRE_CLIENT_SECRET,
    scopes: [],
    state: ''
});
const peopleRouter = express_1.Router();
/**
 * 会員検索
 */
peopleRouter.get('', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_a = project.settings) === null || _a === void 0 ? void 0 : _a.cognito) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.customerUserPool.id
        });
        const people = yield personRepo.search({
            id: req.query.id,
            username: req.query.username,
            email: req.query.email,
            telephone: req.query.telephone,
            givenName: req.query.givenName,
            familyName: req.query.familyName
        });
        res.json(people);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDで検索
 */
peopleRouter.get('/:id', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_b = project.settings) === null || _b === void 0 ? void 0 : _b.cognito) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.customerUserPool.id
        });
        const person = yield personRepo.findById({
            userId: req.params.id
        });
        res.json(person);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDで削除
 */
peopleRouter.delete('/:id', permitScopes_1.default(['people.*', 'people.delete']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_c = project.settings) === null || _c === void 0 ? void 0 : _c.cognito) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const credentials = yield cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
            project: { id: req.project.id },
            paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
        });
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: credentials.siteId,
            sitePass: credentials.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
        });
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.customerUserPool.id
        });
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const person = yield personRepo.findById({
            userId: req.params.id
        });
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        // 現在所有している会員プログラムを全て検索
        const now = new Date();
        const searchOwnershipInfosResult = yield ownershipInfoService.search({
            project: { id: { $eq: req.project.id } },
            typeOfGood: { typeOf: cinerino.factory.chevre.programMembership.ProgramMembershipType.ProgramMembership },
            ownedBy: { id: person.id },
            ownedFrom: now,
            ownedThrough: now
        });
        const ownershipInfos = searchOwnershipInfosResult.data;
        // 所有が確認できれば、会員プログラム登録解除タスクを作成する
        const unRegisterActionAttributes = ownershipInfos.map((o) => {
            var _a, _b;
            return {
                project: { id: (_a = o.project) === null || _a === void 0 ? void 0 : _a.id, typeOf: (_b = o.project) === null || _b === void 0 ? void 0 : _b.typeOf },
                typeOf: cinerino.factory.actionType.UnRegisterAction,
                agent: req.agent,
                object: Object.assign(Object.assign({}, o.typeOfGood), { member: [person] })
            };
        });
        // 会員削除タスクを作成
        const deleteMemberAction = {
            agent: req.agent,
            object: person,
            project: req.project,
            potentialActions: {
                unRegisterProgramMembership: unRegisterActionAttributes
            },
            typeOf: cinerino.factory.actionType.DeleteAction
        };
        yield cinerino.service.customer.deleteMember(Object.assign(Object.assign({}, deleteMemberAction), { physically: req.body.physically === true }))({
            action: actionRepo,
            creditCard: creditCardRepo,
            person: personRepo,
            project: projectRepo,
            task: taskRepo
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 所有権検索
 */
// tslint:disable-next-line:use-default-type-parameter
peopleRouter.get('/:id/ownershipInfos', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, ...[
    express_validator_1.query('typeOfGood')
        .not()
        .isEmpty(),
    express_validator_1.query('offers.ownedFrom')
        .optional()
        .isISO8601()
        .toDate(),
    express_validator_1.query('offers.ownedThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productService = new cinerino.chevre.service.Product({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const searchPaymentCardProductsResult = yield productService.search({
            limit: 100,
            project: { id: { $eq: req.project.id } },
            typeOf: { $eq: cinerino.factory.chevre.product.ProductType.PaymentCard }
        });
        const paymentCardProducts = searchPaymentCardProductsResult.data;
        const paymentCardOutputTypes = [...new Set(paymentCardProducts.map((p) => { var _a; return String((_a = p.serviceOutput) === null || _a === void 0 ? void 0 : _a.typeOf); }))];
        let ownershipInfos;
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { id: { $eq: req.project.id } }, 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, ownedBy: { id: req.params.id } });
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const ownershipInfoService = new cinerino.chevre.service.OwnershipInfo({
            endpoint: cinerino.credentials.chevre.endpoint,
            auth: chevreAuthClient
        });
        const typeOfGood = req.query.typeOfGood;
        switch (true) {
            case paymentCardOutputTypes.includes(String(typeOfGood.typeOf)):
                ownershipInfos = yield cinerino.service.account.search({
                    project: req.project,
                    conditions: searchConditions
                })({
                    ownershipInfo: ownershipInfoService,
                    project: projectRepo
                });
                break;
            case cinerino.factory.chevre.reservationType.EventReservation === typeOfGood.typeOf:
                ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations(Object.assign(Object.assign({}, searchConditions), { project: { typeOf: req.project.typeOf, id: req.project.id } }))({
                    ownershipInfo: ownershipInfoService
                });
                break;
            default:
                const searchOwnershipInfosResult = yield ownershipInfoService.search(searchConditions);
                ownershipInfos = searchOwnershipInfosResult.data;
            // throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
        }
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカード検索
 */
peopleRouter.get('/:id/ownershipInfos/creditCards', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_d = project.settings) === null || _d === void 0 ? void 0 : _d.cognito) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const useUsernameAsGMOMemberId = ((_e = project.settings) === null || _e === void 0 ? void 0 : _e.useUsernameAsGMOMemberId) === true;
        let memberId = req.params.id;
        if (useUsernameAsGMOMemberId) {
            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const person = yield personRepo.findById({
                userId: req.params.id
            });
            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person');
            }
            memberId = person.memberOf.membershipNumber;
        }
        const credentials = yield cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
            project: { id: req.project.id },
            paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
        });
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: credentials.siteId,
            sitePass: credentials.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
        });
        const searchCardResults = yield creditCardRepo.search({ personId: memberId });
        res.json(searchCardResults);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 会員クレジットカード削除
 */
peopleRouter.delete('/:id/ownershipInfos/creditCards/:cardSeq', permitScopes_1.default(['people.*', 'people.creditCards.delete']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _f, _g;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_f = project.settings) === null || _f === void 0 ? void 0 : _f.cognito) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        let memberId = req.params.id;
        const useUsernameAsGMOMemberId = ((_g = project.settings) === null || _g === void 0 ? void 0 : _g.useUsernameAsGMOMemberId) === true;
        if (useUsernameAsGMOMemberId) {
            const personRepo = new cinerino.repository.Person({
                userPoolId: project.settings.cognito.customerUserPool.id
            });
            const person = yield personRepo.findById({
                userId: req.params.id
            });
            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person');
            }
            memberId = person.memberOf.membershipNumber;
        }
        const credentials = yield cinerino.service.payment.chevre.getCreditCardPaymentServiceChannel({
            project: { id: req.project.id },
            paymentMethodType: cinerino.factory.paymentMethodType.CreditCard
        });
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: credentials.siteId,
            sitePass: credentials.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: credentials.endpoint })
        });
        yield creditCardRepo.deleteBySequenceNumber({
            personId: memberId,
            cardSeq: req.params.cardSeq
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロフィール検索
 */
peopleRouter.get('/:id/profile', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _h;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_h = project.settings) === null || _h === void 0 ? void 0 : _h.cognito) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.customerUserPool.id
        });
        const person = yield personRepo.findById({
            userId: req.params.id
        });
        if (person.memberOf === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf');
        }
        const username = person.memberOf.membershipNumber;
        if (username === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
        }
        const profile = yield personRepo.getUserAttributes({
            username: username
        });
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * プロフィール更新
 */
peopleRouter.patch('/:id/profile', permitScopes_1.default(['people.*', 'people.profile.update']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (((_j = project.settings) === null || _j === void 0 ? void 0 : _j.cognito) === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.customerUserPool.id
        });
        const person = yield personRepo.findById({
            userId: req.params.id
        });
        if (person.memberOf === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf');
        }
        const username = person.memberOf.membershipNumber;
        if (username === undefined) {
            throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
        }
        yield personRepo.updateProfile({
            username: username,
            profile: req.body
        });
        res.status(http_status_1.NO_CONTENT)
            .end();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = peopleRouter;
