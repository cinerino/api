/**
 * クレジットカード支払
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';

import { connectMongo } from '../../../../connectMongo';

const debug = createDebug('cinerino-api');

export default async () => {
    const connection = await connectMongo({ defaultConnection: false });

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 1000;
    const taskRepo = new cinerino.repository.Task(connection);

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                debug('count:', count);
                await cinerino.service.task.executeByName(
                    cinerino.factory.taskName.PayCreditCard
                )({
                    taskRepo: taskRepo,
                    connection: connection
                });
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );
};
