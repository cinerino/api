/**
 * 注文配送
 */
import * as cinerino from '@cinerino/domain';
import * as redis from 'redis';

import { connectMongo } from '../../../connectMongo';

export default async (params: {
    project?: cinerino.factory.project.IProject;
}) => {
    const connection = await connectMongo({ defaultConnection: false });

    const redisClient = redis.createClient({
        host: <string>process.env.REDIS_HOST,
        port: Number(<string>process.env.REDIS_PORT),
        password: <string>process.env.REDIS_KEY,
        tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
    });

    let count = 0;

    const MAX_NUBMER_OF_PARALLEL_TASKS = 10;
    const INTERVAL_MILLISECONDS = 200;

    setInterval(
        async () => {
            if (count > MAX_NUBMER_OF_PARALLEL_TASKS) {
                return;
            }

            count += 1;

            try {
                await cinerino.service.task.executeByName({
                    project: params.project,
                    name: cinerino.factory.taskName.SendOrder
                })({
                    connection: connection,
                    redisClient: redisClient
                });
            } catch (error) {
                console.error(error);
            }

            count -= 1;
        },
        INTERVAL_MILLISECONDS
    );
};
