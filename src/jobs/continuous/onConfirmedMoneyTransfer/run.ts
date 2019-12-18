/**
 * 確定通貨転送取引監視
 */
import * as cinerino from '@cinerino/domain';
import * as createDebug from 'debug';

import { connectMongo } from '../../../connectMongo';

const debug = createDebug('cinerino-api');

export default async (params: {
    project?: cinerino.factory.project.IProject;
}) => {
    const connection = await connectMongo({ defaultConnection: false });

    let countExecute = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 200;
    const projectRepo = new cinerino.repository.Project(connection);
    const taskRepo = new cinerino.repository.Task(connection);
    const transactionRepo = new cinerino.repository.Transaction(connection);

    setInterval(
        async () => {
            if (countExecute > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            countExecute += 1;

            try {
                debug('exporting tasks...');
                await cinerino.service.transaction.exportTasks({
                    project: params.project,
                    status: cinerino.factory.transactionStatusType.Confirmed,
                    typeOf: cinerino.factory.transactionType.MoneyTransfer
                })({
                    project: projectRepo,
                    task: taskRepo,
                    transaction: transactionRepo
                });
            } catch (error) {
                console.error(error);
            }

            countExecute -= 1;
        },
        INTERVAL_MILLISECONDS
    );
};
