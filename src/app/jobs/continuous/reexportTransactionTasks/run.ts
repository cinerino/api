/**
 * 取引タスクエクスポートが実行中のままになっている取引を監視する
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';

import { connectMongo } from '../../../../connectMongo';

const debug = createDebug('cinerino-api');

export default async () => {
    const connection = await connectMongo({ defaultConnection: false });

    let countRetry = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 500;
    const transactionRepo = new cinerino.repository.Transaction(connection);
    const RETRY_INTERVAL_MINUTES = 10;

    setInterval(
        async () => {
            if (countRetry > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            countRetry += 1;

            try {
                debug('reexporting tasks...');
                await transactionRepo.reexportTasks({ intervalInMinutes: RETRY_INTERVAL_MINUTES });
            } catch (error) {
                console.error(error);
            }

            countRetry -= 1;
        },
        INTERVAL_MILLISECONDS
    );
};
