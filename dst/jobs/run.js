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
const run_1 = require("./continuous/abortTasks/run");
const run_2 = require("./continuous/makeTransactionExpired/run");
const run_3 = require("./continuous/reexportTransactionTasks/run");
const run_4 = require("./continuous/retryTasks/run");
const run_5 = require("./continuous/onTransactionCanceled/run");
const run_6 = require("./continuous/onTransactionConfirmed/run");
const run_7 = require("./continuous/onTransactionExpired/run");
const run_8 = require("./continuous/cancelAccount/run");
const run_9 = require("./continuous/cancelCreditCard/run");
const run_10 = require("./continuous/cancelPointAward/run");
const run_11 = require("./continuous/cancelReservation/run");
const run_12 = require("./continuous/cancelSeatReservation/run");
const run_13 = require("./continuous/confirmReservation/run");
const run_14 = require("./continuous/deleteMember/run");
const run_15 = require("./continuous/givePointAward/run");
const run_16 = require("./continuous/importScreeningEvents/run");
const run_17 = require("./continuous/moneyTransfer/run");
const run_18 = require("./continuous/orderProgramMembership/run");
const run_19 = require("./continuous/payAccount/run");
const run_20 = require("./continuous/payCreditCard/run");
const run_21 = require("./continuous/payMovieTicket/run");
const run_22 = require("./continuous/placeOrder/run");
const run_23 = require("./continuous/refundAccount/run");
const run_24 = require("./continuous/refundCreditCard/run");
const run_25 = require("./continuous/refundMovieTicket/run");
const run_26 = require("./continuous/registerProgramMembership/run");
const run_27 = require("./continuous/returnOrder/run");
const run_28 = require("./continuous/returnPointAward/run");
const run_29 = require("./continuous/sendEmailMessage/run");
const run_30 = require("./continuous/sendOrder/run");
const run_31 = require("./continuous/triggerWebhook/run");
const run_32 = require("./continuous/unRegisterProgramMembership/run");
const run_33 = require("./continuous/updateEventAttendeeCapacity/run");
const run_34 = require("./continuous/voidMoneyTransfer/run");
const run_35 = require("./triggered/createImportScreeningEventsTask/run");
const run_36 = require("./triggered/createUpdateEventAttendeeCapacityTask/run");
const project = (typeof process.env.PROJECT_ID === 'string')
    ? { typeOf: 'Project', id: process.env.PROJECT_ID }
    : undefined;
const importEventsProjects = (typeof process.env.IMPORT_EVENTS_PROJECTS === 'string')
    ? process.env.IMPORT_EVENTS_PROJECTS.split(',')
    : [];
// tslint:disable-next-line:cyclomatic-complexity
exports.default = () => __awaiter(void 0, void 0, void 0, function* () {
    yield run_1.default({ project: project });
    yield run_4.default({ project: project });
    yield run_2.default({ project: project });
    yield run_3.default({ project: project });
    yield run_5.default({ project: project });
    yield run_6.default({ project: project });
    yield run_7.default({ project: project });
    yield run_8.default({ project: project });
    yield run_9.default({ project: project });
    yield run_10.default({ project: project });
    yield run_11.default({ project: project });
    yield run_12.default({ project: project });
    yield run_13.default({ project: project });
    yield run_14.default({ project: project });
    yield run_15.default({ project: project });
    yield run_16.default({ project: project });
    yield run_17.default({ project: project });
    yield run_18.default({ project: project });
    yield run_19.default({ project: project });
    yield run_20.default({ project: project });
    yield run_21.default({ project: project });
    yield run_22.default({ project: project });
    yield run_23.default({ project: project });
    yield run_24.default({ project: project });
    yield run_25.default({ project: project });
    yield run_26.default({ project: project });
    yield run_27.default({ project: project });
    yield run_28.default({ project: project });
    yield run_29.default({ project: project });
    yield run_30.default({ project: project });
    yield run_31.default({ project: project });
    yield run_32.default({ project: project });
    yield run_33.default({ project: project });
    yield run_34.default({ project: project });
    yield Promise.all(importEventsProjects.map((projectId) => __awaiter(void 0, void 0, void 0, function* () {
        yield run_35.default({ project: { typeOf: 'Project', id: projectId } });
        yield run_36.default({ project: { typeOf: 'Project', id: projectId } });
    })));
});
