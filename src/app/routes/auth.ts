/**
 * 認証ルーター
 */
import * as cinerino from '@cinerino/domain';
import { Router } from 'express';
import * as jwt from 'jsonwebtoken';

// import * as redis from '../../redis';
import authentication from '../middlewares/authentication';
// import permitScopes from '../middlewares/permitScopes';
import validator from '../middlewares/validator';

const authRouter = Router();
authRouter.use(authentication);

/**
 * コードから所有権に対するアクセストークンを発行する
 */
authRouter.post(
    '/token',
    // permitScopes(['aws.cognito.signin.user.admin']),
    validator,
    async (req, res, next) => {
        try {
            const code = req.body.code;
            const ownershipInfoRepo = new cinerino.repository.OwnershipInfo(cinerino.mongoose.connection);
            const ownershipInfo = await ownershipInfoRepo.ownershipInfoModel.findOne({
                identifier: code
            }).then((doc) => {
                if (doc === null) {
                    throw new cinerino.factory.errors.Argument('Invalid code');
                }

                return doc.toObject();
            });
            // 所有権をトークン化
            const token = await new Promise<string>((resolve, reject) => {
                // 許可証を暗号化する
                jwt.sign(
                    ownershipInfo,
                    <string>process.env.TOKEN_SECRET,
                    {
                        issuer: <string>process.env.RESOURCE_SERVER_IDENTIFIER,
                        // tslint:disable-next-line:no-magic-numbers
                        expiresIn: 1800
                    },
                    (err, encoded) => {
                        if (err instanceof Error) {
                            reject(err);
                        } else {
                            resolve(encoded);
                        }
                    }
                );
            });
            res.json({ token });
        } catch (error) {
            next(error);
        }
    });

export default authRouter;
