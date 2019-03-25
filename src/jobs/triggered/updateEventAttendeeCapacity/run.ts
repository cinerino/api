/**
 * イベント残席数を更新する
 */
import * as cinerino from '@cinerino/domain';
import { CronJob } from 'cron';
import * as createDebug from 'debug';
import * as moment from 'moment';

import { connectMongo } from '../../../connectMongo';
import * as singletonProcess from '../../../singletonProcess';

const debug = createDebug('cinerino-api:jobs');

/**
 * 上映イベントを何週間後までインポートするか
 */
const LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS = (process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS !== undefined)
    ? Number(process.env.LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS)
    : 1;

export default async () => {
    let holdSingletonProcess = false;
    setInterval(
        async () => {
            // tslint:disable-next-line:no-magic-numbers
            holdSingletonProcess = await singletonProcess.lock({ key: 'updateEventAttendeeCapacity', ttl: 60 });
        },
        // tslint:disable-next-line:no-magic-numbers
        10000
    );

    const connection = await connectMongo({ defaultConnection: false });

    const redisClient = cinerino.redis.createClient({
        host: <string>process.env.REDIS_HOST,
        port: Number(<string>process.env.REDIS_PORT),
        password: <string>process.env.REDIS_KEY,
        tls: (process.env.REDIS_TLS_SERVERNAME !== undefined) ? { servername: process.env.REDIS_TLS_SERVERNAME } : undefined
    });

    const job = new CronJob(
        '* * * * *',
        async () => {
            if (!holdSingletonProcess) {
                return;
            }

            const attendeeCapacityRepo = new cinerino.repository.event.AttendeeCapacityRepo(redisClient);
            const sellerRepo = new cinerino.repository.Seller(connection);

            const chevreAuthClient = new cinerino.chevre.auth.ClientCredentials({
                domain: <string>process.env.CHEVRE_AUTHORIZE_SERVER_DOMAIN,
                clientId: <string>process.env.CHEVRE_CLIENT_ID,
                clientSecret: <string>process.env.CHEVRE_CLIENT_SECRET,
                scopes: [],
                state: ''
            });
            const eventService = new cinerino.chevre.service.Event({
                endpoint: <string>process.env.CHEVRE_ENDPOINT,
                auth: chevreAuthClient
            });

            const sellers = await sellerRepo.search({});
            const importFrom = moment()
                .toDate();
            const importThrough = moment()
                .add(LENGTH_IMPORT_SCREENING_EVENTS_IN_WEEKS, 'weeks')
                .toDate();
            // const runsAt = new Date();

            await Promise.all(sellers.map(async (seller) => {
                try {
                    if (Array.isArray(seller.makesOffer)) {
                        await Promise.all(seller.makesOffer.map(async (offer) => {
                            await cinerino.service.stock.updateEventRemainingAttendeeCapacities({
                                locationBranchCode: offer.itemOffered.reservationFor.location.branchCode,
                                offeredThrough: offer.offeredThrough,
                                importFrom: importFrom,
                                importThrough: importThrough
                            })({
                                attendeeCapacity: attendeeCapacityRepo,
                                eventService: eventService
                            });
                        }));
                    }
                } catch (error) {
                    console.error(error);
                }
            }));
        },
        undefined,
        true
    );
    debug('job started', job);
};
