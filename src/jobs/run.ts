/**
 * 非同期ジョブ
 */
import abortTasks from './continuous/abortTasks/run';
import makeTransactionExpired from './continuous/makeTransactionExpired/run';
import reexportTransactionTasks from './continuous/reexportTransactionTasks/run';
import retryTasks from './continuous/retryTasks/run';

import onCanceledPlaceOrder from './continuous/onCanceledPlaceOrder/run';
import onCanceledReturnOrder from './continuous/onCanceledReturnOrder/run';
import onConfirmedMoneyTransfer from './continuous/onConfirmedMoneyTransfer/run';
import onConfirmedPlaceOrder from './continuous/onConfirmedPlaceOrder/run';
import onConfirmedReturnOrder from './continuous/onConfirmedReturnOrder/run';
import onExpiredPlaceOrder from './continuous/onExpiredPlaceOrder/run';
import onExpiredReturnOrder from './continuous/onExpiredReturnOrder/run';

import cancelAccount from './continuous/cancelAccount/run';
import cancelCreditCard from './continuous/cancelCreditCard/run';
import cancelPointAward from './continuous/cancelPointAward/run';
import cancelSeatReservation from './continuous/cancelSeatReservation/run';
import confirmReservation from './continuous/confirmReservation/run';
import givePointAward from './continuous/givePointAward/run';
import importScreeningEvents from './continuous/importScreeningEvents/run';
import moneyTransfer from './continuous/moneyTransfer/run';
import payAccount from './continuous/payAccount/run';
import payCreditCard from './continuous/payCreditCard/run';
import payMovieTicket from './continuous/payMovieTicket/run';
import placeOrder from './continuous/placeOrder/run';
import refundAccount from './continuous/refundAccount/run';
import refundCreditCard from './continuous/refundCreditCard/run';
import refundMovieTicket from './continuous/refundMovieTicket/run';
import registerProgramMembership from './continuous/registerProgramMembership/run';
import returnOrder from './continuous/returnOrder/run';
import returnPointAward from './continuous/returnPointAward/run';
import sendEmailMessage from './continuous/sendEmailMessage/run';
import sendOrder from './continuous/sendOrder/run';
import triggerWebhook from './continuous/triggerWebhook/run';
import unRegisterProgramMembership from './continuous/unRegisterProgramMembership/run';
import updateEventAttendeeCapacity from './continuous/updateEventAttendeeCapacity/run';

import createImportScreeningEventsTask from './triggered/createImportScreeningEventsTask/run';
import createUpdateEventAttendeeCapacityTask from './triggered/createUpdateEventAttendeeCapacityTask/run';

export default async () => {
    await abortTasks();
    await makeTransactionExpired();
    await reexportTransactionTasks();
    await retryTasks();

    await onCanceledPlaceOrder();
    await onCanceledReturnOrder();
    await onConfirmedMoneyTransfer();
    await onConfirmedPlaceOrder();
    await onConfirmedReturnOrder();
    await onExpiredPlaceOrder();
    await onExpiredReturnOrder();

    await cancelAccount();
    await cancelCreditCard();
    await cancelPointAward();
    await cancelSeatReservation();
    await confirmReservation();
    await givePointAward();
    await importScreeningEvents();
    await moneyTransfer();
    await payAccount();
    await payCreditCard();
    await payMovieTicket();
    await placeOrder();
    await refundAccount();
    await refundCreditCard();
    await refundMovieTicket();
    await registerProgramMembership();
    await returnOrder();
    await returnPointAward();
    await sendEmailMessage();
    await sendOrder();
    await triggerWebhook();
    await unRegisterProgramMembership();
    await updateEventAttendeeCapacity();

    await createImportScreeningEventsTask();
    await createUpdateEventAttendeeCapacityTask();
};
