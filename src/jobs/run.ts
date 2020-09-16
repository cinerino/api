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

import cancelReservation from './continuous/cancelReservation/run';
import confirmReservation from './continuous/confirmReservation/run';
import createOrderReport from './continuous/createOrderReport/run';
import deleteMember from './continuous/deleteMember/run';
import givePointAward from './continuous/givePointAward/run';
import moneyTransfer from './continuous/moneyTransfer/run';
import orderProgramMembership from './continuous/orderProgramMembership/run';
import pay from './continuous/pay/run';
import placeOrder from './continuous/placeOrder/run';
import refund from './continuous/refund/run';
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
import voidReserve from './continuous/voidReserve/run';

export default async () => {
    await abortTasks({});
    await retryTasks({});
    await makeTransactionExpired({});
    await reexportTransactionTasks({});

    await onTransactionCanceled({});
    await onTransactionConfirmed({});
    await onTransactionExpired({});

    await cancelReservation({});
    await confirmReservation({});
    await createOrderReport({});
    await deleteMember({});
    await givePointAward({});
    await moneyTransfer({});
    await orderProgramMembership({});
    await pay({});
    await placeOrder({});
    await refund({});
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
    await voidReserve({});
};
