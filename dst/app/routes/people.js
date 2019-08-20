"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 会員ルーター
 */
const cinerino = require("@cinerino/domain");
const express_1 = require("express");
// tslint:disable-next-line:no-submodule-imports
const check_1 = require("express-validator/check");
const http_status_1 = require("http-status");
const mongoose = require("mongoose");
const authentication_1 = require("../middlewares/authentication");
const permitScopes_1 = require("../middlewares/permitScopes");
const validator_1 = require("../middlewares/validator");
/**
 * GMOメンバーIDにユーザーネームを使用するかどうか
 */
const USE_USERNAME_AS_GMO_MEMBER_ID = process.env.USE_USERNAME_AS_GMO_MEMBER_ID === '1';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const peopleRouter = express_1.Router();
peopleRouter.use(authentication_1.default);
/**
 * 会員検索
 */
peopleRouter.get('', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person();
        const people = yield personRepo.search({
            userPooId: USER_POOL_ID,
            id: req.query.id,
            username: req.query.username,
            email: req.query.email,
            telephone: req.query.telephone,
            givenName: req.query.givenName,
            familyName: req.query.familyName
        });
        res.set('X-Total-Count', people.length.toString());
        res.json(people);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * IDで検索
 */
peopleRouter.get('/:id', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person();
        const person = yield personRepo.findById({
            userPooId: USER_POOL_ID,
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
peopleRouter.delete('/:id', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const personRepo = new cinerino.repository.Person();
        const person = yield personRepo.findById({
            userPooId: USER_POOL_ID,
            userId: req.params.id
        });
        const deleteActionAttributes = {
            agent: req.agent,
            object: person,
            project: { typeOf: req.project.typeOf, id: req.project.id },
            typeOf: 'DeleteAction'
        };
        const action = yield actionRepo.start(deleteActionAttributes);
        try {
            yield personRepo.deleteById({
                userPooId: USER_POOL_ID,
                userId: req.params.id
            });
        }
        catch (error) {
            // actionにエラー結果を追加
            try {
                const actionError = Object.assign({}, error, { message: error.message, name: error.name });
                yield actionRepo.giveUp({ typeOf: action.typeOf, id: action.id, error: actionError });
            }
            catch (__) {
                // 失敗したら仕方ない
            }
            throw error;
        }
        yield actionRepo.complete({ typeOf: action.typeOf, id: action.id, result: {} });
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
peopleRouter.get('/:id/ownershipInfos', permitScopes_1.default(['admin']), ...[
    check_1.query('typeOfGood')
        .not()
        .isEmpty(),
    check_1.query('offers.ownedFrom')
        .optional()
        .isISO8601()
        .toDate(),
    check_1.query('offers.ownedThrough')
        .optional()
        .isISO8601()
        .toDate()
], validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        let ownershipInfos;
        const searchConditions = Object.assign({}, req.query, { 
            // tslint:disable-next-line:no-magic-numbers
            limit: (req.query.limit !== undefined) ? Math.min(req.query.limit, 100) : 100, page: (req.query.page !== undefined) ? Math.max(req.query.page, 1) : 1, ownedBy: { id: req.params.id } });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const totalCount = yield ownershipInfoRepo.count(searchConditions);
        const typeOfGood = req.query.typeOfGood;
        switch (typeOfGood.typeOf) {
            case cinerino.factory.ownershipInfo.AccountGoodType.Account:
                ownershipInfos = yield cinerino.service.account.search({
                    project: req.project,
                    conditions: searchConditions
                })({
                    ownershipInfo: ownershipInfoRepo,
                    project: projectRepo
                });
                break;
            case cinerino.factory.chevre.reservationType.EventReservation:
                ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations(searchConditions)({
                    ownershipInfo: ownershipInfoRepo,
                    project: projectRepo
                });
                break;
            default:
                ownershipInfos = yield ownershipInfoRepo.search(searchConditions);
            // throw new cinerino.factory.errors.Argument('typeOfGood.typeOf', 'Unknown good type');
        }
        res.set('X-Total-Count', totalCount.toString());
        res.json(ownershipInfos);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * クレジットカード検索
 */
peopleRouter.get('/:id/ownershipInfos/creditCards', permitScopes_1.default(['admin']), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.gmo === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        let memberId = req.params.id;
        if (USE_USERNAME_AS_GMO_MEMBER_ID) {
            const personRepo = new cinerino.repository.Person();
            const person = yield personRepo.findById({
                userPooId: USER_POOL_ID,
                userId: req.params.id
            });
            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person');
            }
            memberId = person.memberOf.membershipNumber;
        }
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
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
peopleRouter.delete('/:id/ownershipInfos/creditCards/:cardSeq', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        if (project.settings.gmo === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings not found');
        }
        let memberId = req.params.id;
        if (USE_USERNAME_AS_GMO_MEMBER_ID) {
            const personRepo = new cinerino.repository.Person();
            const person = yield personRepo.findById({
                userPooId: USER_POOL_ID,
                userId: req.params.id
            });
            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person');
            }
            memberId = person.memberOf.membershipNumber;
        }
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
        });
        yield creditCardRepo.remove({
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
peopleRouter.get('/:id/profile', permitScopes_1.default(['admin']), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person();
        const person = yield personRepo.findById({
            userPooId: USER_POOL_ID,
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
            userPooId: USER_POOL_ID,
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
peopleRouter.patch('/:id/profile', permitScopes_1.default(['admin']), validator_1.default, (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const personRepo = new cinerino.repository.Person();
        const person = yield personRepo.findById({
            userPooId: USER_POOL_ID,
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
            userPooId: USER_POOL_ID,
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
