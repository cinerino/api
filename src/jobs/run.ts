/**
 * 非同期ジョブ
 */
import { factory } from '@cinerino/domain';

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
import cancelReservation from './continuous/cancelReservation/run';
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

const MULTI_TENANT_SUPPORTED = process.env.MULTI_TENANT_SUPPORTED === '1';
const project: factory.project.IProject = { typeOf: 'Project', id: <string>process.env.PROJECT_ID };

// tslint:disable-next-line:cyclomatic-complexity
export default async () => {
    await abortTasks({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await retryTasks({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await makeTransactionExpired({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await reexportTransactionTasks({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });

    await onCanceledPlaceOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await onCanceledReturnOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await onConfirmedMoneyTransfer({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await onConfirmedPlaceOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await onConfirmedReturnOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await onExpiredPlaceOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await onExpiredReturnOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });

    await cancelAccount({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await cancelCreditCard({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await cancelPointAward({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await cancelReservation({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await cancelSeatReservation({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await confirmReservation({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await givePointAward({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await importScreeningEvents({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await moneyTransfer({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await payAccount({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await payCreditCard({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await payMovieTicket({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await placeOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await refundAccount({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await refundCreditCard({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await refundMovieTicket({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await registerProgramMembership({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await returnOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await returnPointAward({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await sendEmailMessage({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await sendOrder({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await triggerWebhook({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await unRegisterProgramMembership({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await updateEventAttendeeCapacity({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });

    await createImportScreeningEventsTask({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
    await createUpdateEventAttendeeCapacityTask({ project: (MULTI_TENANT_SUPPORTED) ? project : undefined });
};
