/**
 * middlewares/authenticationにて、expressのrequestオブジェクトにAPIユーザー情報を追加している。
 * ユーザーの型をここで定義しています。
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';

declare global {
    namespace Express {
        export type IUser = cinerino.factory.clientUser.IClientUser;

        // tslint:disable-next-line:interface-name
        export interface Request {
            agent: cinerino.factory.person.IPerson;
            user: IUser;
            accessToken: string;
        }
    }
}
