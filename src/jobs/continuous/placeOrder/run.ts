/**
 * 注文作成
 */
import * as cinerino from '@cinerino/domain';

import { connectMongo } from '../../../connectMongo';

export default async (params: {
    project?: cinerino.factory.project.IProject;
}) => {
    const connection = await connectMongo({ defaultConnection: false });

    const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
        domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
        clientId: <string>process.env.CHEVRE_CLIENT_ID,
        clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
        scopes: [],
        state: ''
    });

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 100;

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await cinerino.service.task.executeByName({
                    project: params.project,
                    name: cinerino.factory.taskName.PlaceOrder
                })({
                    connection: connection, chevreAuthClient
                });
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );

    // 同時実行タスク数監視
    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                await cinerino.service.notification.report2developers(
                    `api:connectMongo`,
                    `jobs:placeOrder:taskCount reached MAX_NUBMER_OF_PARALLEL_TASKS. ${count.toString()}`
                )();
            }
        },
        // tslint:disable-next-line:no-magic-numbers
        60000
    );
};
