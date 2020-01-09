/**
 * アプリケーション固有の型
 */
import * as cinerino from '@cinerino/domain';
import * as express from 'express';
declare global {
    namespace Express {
        export interface IRequestProject { typeOf: cinerino.factory.organizationType.Project; id: string; }

        /**
         * APIユーザー(Cognitから認可を受ける)
         */
        export type IUser = cinerino.factory.clientUser.IClientUser;

        // export type IRequestAgent = cinerino.factory.person.IPerson
        //     | cinerino.factory.creativeWork.softwareApplication.webApplication.ICreativeWork;
        export type IRequestAgent = cinerino.factory.person.IPerson;

        // tslint:disable-next-line:interface-name
        export interface Request {
            application: cinerino.factory.creativeWork.softwareApplication.webApplication.ICreativeWork;
            project: IRequestProject;
            agent: IRequestAgent;
            user: IUser;
            accessToken: string;
            isAdmin: boolean;
            isProjectMember: boolean;
            /**
             * プロジェクトメンバーの権限
             */
            memberPermissions: string[];
            /**
             * カスタマー権限
             */
            customerPermissions: string[];
        }
    }
}
