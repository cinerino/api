/**
 * 非同期ジョブ
 */
import abortTasks from './continuous/abortTasks/run';
import makeTransactionExpired from './continuous/makeTransactionExpired/run';
import reexportTransactionTasks from './continuous/reexportTransactionTasks/run';
import retryTasks from './continuous/retryTasks/run';

import onTransactionCanceled from './continuous/onTransactionCanceled/run';
import onTransactionConfirmed from './continuous/onTransactionConfirmed/run';
import onTransactionExpired from './continuous/onTransactionExpired/run';

import cancelAccount from './continuous/cancelAccount/run';
import cancelCreditCard from './continuous/cancelCreditCard/run';
import cancelPaymentCard from './continuous/cancelPaymentCard/run';
import cancelReservation from './continuous/cancelReservation/run';
import cancelSeatReservation from './continuous/cancelSeatReservation/run';
import confirmReservation from './continuous/confirmReservation/run';
import createOrderReport from './continuous/createOrderReport/run';
import deleteMember from './continuous/deleteMember/run';
import givePointAward from './continuous/givePointAward/run';
import moneyTransfer from './continuous/moneyTransfer/run';
import orderProgramMembership from './continuous/orderProgramMembership/run';
import pay from './continuous/pay/run';
import payAccount from './continuous/payAccount/run';
import payCreditCard from './continuous/payCreditCard/run';
import payMovieTicket from './continuous/payMovieTicket/run';
import payPaymentCard from './continuous/payPaymentCard/run';
import placeOrder from './continuous/placeOrder/run';
import refundAccount from './continuous/refundAccount/run';
import refundCreditCard from './continuous/refundCreditCard/run';
import refundMovieTicket from './continuous/refundMovieTicket/run';
import refundPaymentCard from './continuous/refundPaymentCard/run';
import registerProgramMembership from './continuous/registerProgramMembership/run';
import registerService from './continuous/registerService/run';
import returnOrder from './continuous/returnOrder/run';
import returnPointAward from './continuous/returnPointAward/run';
import sendEmailMessage from './continuous/sendEmailMessage/run';
import sendOrder from './continuous/sendOrder/run';
import triggerWebhook from './continuous/triggerWebhook/run';
import unRegisterProgramMembership from './continuous/unRegisterProgramMembership/run';
import voidMoneyTransfer from './continuous/voidMoneyTransfer/run';
import voidPayment from './continuous/voidPayment/run';
import voidRegisterService from './continuous/voidRegisterService/run';

const USE_LEGACY_PAYMENT_TASKS = process.env.USE_LEGACY_PAYMENT_TASKS === '1';

export default async () => {
    await abortTasks({});
    await retryTasks({});
    await makeTransactionExpired({});
    await reexportTransactionTasks({});

    await onTransactionCanceled({});
    await onTransactionConfirmed({});
    await onTransactionExpired({});

    await cancelReservation({});
    await cancelSeatReservation({});
    await confirmReservation({});
    await createOrderReport({});
    await deleteMember({});
    await givePointAward({});
    await moneyTransfer({});
    await orderProgramMembership({});
    await pay({});
    await placeOrder({});
    await refundAccount({});
    await refundCreditCard({});
    await refundMovieTicket({});
    await refundPaymentCard({});
    await registerProgramMembership({});
    await registerService({});
    await returnOrder({});
    await returnPointAward({});
    await sendEmailMessage({});
    await sendOrder({});
    await triggerWebhook({});
    await unRegisterProgramMembership({});
    await voidMoneyTransfer({});
    await voidPayment({});
    await voidRegisterService({});

    if (USE_LEGACY_PAYMENT_TASKS) {
        await cancelAccount({});
        await cancelCreditCard({});
        await cancelPaymentCard({});
        await payAccount({});
        await payCreditCard({});
        await payMovieTicket({});
        await payPaymentCard({});
    }
};
