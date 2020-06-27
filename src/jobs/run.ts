/**
 * 非同期ジョブ
 */
import { factory } from '@cinerino/domain';

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
import voidRegisterService from './continuous/voidRegisterService/run';

const project: factory.project.IProject | undefined = (typeof process.env.PROJECT_ID === 'string')
    ? { typeOf: factory.organizationType.Project, id: process.env.PROJECT_ID }
    : undefined;

// tslint:disable-next-line:cyclomatic-complexity
export default async () => {
    await abortTasks({ project: project });
    await retryTasks({ project: project });
    await makeTransactionExpired({ project: project });
    await reexportTransactionTasks({ project: project });

    await onTransactionCanceled({ project: project });
    await onTransactionConfirmed({ project: project });
    await onTransactionExpired({ project: project });

    await cancelAccount({ project: project });
    await cancelCreditCard({ project: project });
    await cancelPaymentCard({ project: project });
    await cancelReservation({ project: project });
    await cancelSeatReservation({ project: project });
    await confirmReservation({ project: project });
    await createOrderReport({ project: project });
    await deleteMember({ project: project });
    await givePointAward({ project: project });
    await moneyTransfer({ project: project });
    await orderProgramMembership({ project: project });
    await payAccount({ project: project });
    await payCreditCard({ project: project });
    await payMovieTicket({ project: project });
    await payPaymentCard({ project: project });
    await placeOrder({ project: project });
    await refundAccount({ project: project });
    await refundCreditCard({ project: project });
    await refundMovieTicket({ project: project });
    await refundPaymentCard({ project: project });
    await registerProgramMembership({ project: project });
    await registerService({ project: project });
    await returnOrder({ project: project });
    await returnPointAward({ project: project });
    await sendEmailMessage({ project: project });
    await sendOrder({ project: project });
    await triggerWebhook({ project: project });
    await unRegisterProgramMembership({ project: project });
    await voidMoneyTransfer({ project: project });
    await voidRegisterService({ project: project });
};
