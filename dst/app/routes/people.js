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
const peopleRouter = express_1.Router();
/**
 * 会員検索
 */
peopleRouter.get('', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
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
peopleRouter.get('/:id', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
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
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined
            || project.settings.gmo === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const actionRepo = new cinerino.repository.Action(mongoose.connection);
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
        });
        const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(mongoose.connection);
        const personRepo = new cinerino.repository.Person({
            userPoolId: project.settings.cognito.customerUserPool.id
        });
        const taskRepo = new cinerino.repository.Task(mongoose.connection);
        const person = yield personRepo.findById({
            userId: req.params.id
        });
        // 現在所有している会員プログラムを全て検索
        const now = new Date();
        const ownershipInfos = yield ownershipInfoRepo.search({
            typeOfGood: { typeOf: cinerino.factory.programMembership.ProgramMembershipType.ProgramMembership },
            ownedBy: { id: person.id },
            ownedFrom: now,
            ownedThrough: now
        });
        // 所有が確認できれば、会員プログラム登録解除タスクを作成する
        const unRegisterActionAttributes = ownershipInfos.map((o) => {
            return {
                project: o.project,
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
        let ownershipInfos;
        const searchConditions = Object.assign(Object.assign({}, req.query), { project: { ids: [req.project.id] }, 
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
                ownershipInfos = yield cinerino.service.reservation.searchScreeningEventReservations(Object.assign(Object.assign({}, searchConditions), { project: req.project }))({
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
peopleRouter.get('/:id/ownershipInfos/creditCards', permitScopes_1.default(['people.*', 'people.read']), rateLimit_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.gmo === undefined
            || project.settings.cognito === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        const useUsernameAsGMOMemberId = project.settings !== undefined && project.settings.useUsernameAsGMOMemberId === true;
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
peopleRouter.delete('/:id/ownershipInfos/creditCards/:cardSeq', permitScopes_1.default(['people.*', 'people.creditCards.delete']), rateLimit_1.default, validator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.gmo === undefined
            || project.settings.cognito === undefined) {
            throw new cinerino.factory.errors.ServiceUnavailable('Project settings undefined');
        }
        let memberId = req.params.id;
        const useUsernameAsGMOMemberId = project.settings !== undefined && project.settings.useUsernameAsGMOMemberId === true;
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
        const creditCardRepo = new cinerino.repository.paymentMethod.CreditCard({
            siteId: project.settings.gmo.siteId,
            sitePass: project.settings.gmo.sitePass,
            cardService: new cinerino.GMO.service.Card({ endpoint: project.settings.gmo.endpoint })
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
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
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
    try {
        const projectRepo = new cinerino.repository.Project(mongoose.connection);
        const project = yield projectRepo.findById({ id: req.project.id });
        if (project.settings === undefined
            || project.settings.cognito === undefined) {
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
