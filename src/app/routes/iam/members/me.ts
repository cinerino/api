/**
 * IAMメンバー(me)ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as mongoose from 'mongoose';

import permitScopes from '../../../middlewares/permitScopes';
import rateLimit from '../../../middlewares/rateLimit';
import validator from '../../../middlewares/validator';

const ADMIN_USER_POOL_ID = <string>process.env.ADMIN_USER_POOL_ID;

const iamMeRouter = Router();

iamMeRouter.get(
    '',
    permitScopes(['iam.members.me.read']),
    rateLimit,
    validator,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);
            const members = await memberRepo.search({
                member: { id: { $eq: req.user.sub } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            res.json(members[0]);
        } catch (error) {
            next(error);
        }
    }
);

iamMeRouter.get(
    '/profile',
    permitScopes(['iam.members.me.read']),
    rateLimit,
    async (req, res, next) => {
        try {
            const memberRepo = new cinerino.repository.Member(mongoose.connection);

            const members = await memberRepo.search({
                member: { id: { $eq: req.user.sub } },
                project: { id: { $eq: req.project.id } },
                limit: 1
            });
            if (members.length === 0) {
                throw new cinerino.factory.errors.NotFound('Member');
            }

            const member = members[0].member;

            const personRepo = new cinerino.repository.Person({
                userPoolId: ADMIN_USER_POOL_ID
            });
            const person = await personRepo.findById({
                userId: member.id
            });

            if (person.memberOf === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf');
            }

            const username = person.memberOf.membershipNumber;
            if (username === undefined) {
                throw new cinerino.factory.errors.NotFound('Person.memberOf.membershipNumber');
            }

            const profile = await personRepo.getUserAttributes({
                username: username
            });

            res.json(profile);
        } catch (error) {
            next(error);
        }
    }
);

export default iamMeRouter;
