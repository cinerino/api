/**
 * 中止取引監視
 */
import * as cinerino from '@cinerino/domain';

import { connectMongo } from '../../../connectMongo';

export default async (params: {
    project?: cinerino.factory.project.IProject;
}) => {
    const connection = await connectMongo({ defaultConnection: false });

    let countExecute = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 100;

    const taskRepo = new cinerino.repository.Task(connection);
    const transactionRepo = new cinerino.repository.Transaction(connection);

    setInterval(
        async () => {
            if (countExecute > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            countExecute += 1;

            try {
                await cinerino.service.transaction.exportTasks({
                    project: params.project,
                    status: cinerino.factory.transactionStatusType.Canceled,
                    typeOf: {
                        $in: [
                            cinerino.factory.transactionType.MoneyTransfer,
                            cinerino.factory.transactionType.PlaceOrder,
                            cinerino.factory.transactionType.ReturnOrder
                        ]
                    }
                })({
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
