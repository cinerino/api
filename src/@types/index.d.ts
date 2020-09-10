/**
 * アプリケーション固有の型
 */
import * as cinerino from '@cinerino/domain';

declare global {
    namespace Express {
        export interface IRequestProject { typeOf: cinerino.factory.chevre.organizationType.Project; id: string; }

        /**
         * APIユーザー(Cognitから認可を受ける)
         */
        export type IUser = cinerino.factory.chevre.clientUser.IClientUser;

        // export type IRequestAgent = cinerino.factory.person.IPerson
        //     | cinerino.factory.creativeWork.softwareApplication.webApplication.ICreativeWork;
        export type IRequestAgent = cinerino.factory.person.IPerson;

        // tslint:disable-next-line:interface-name
        export interface Request {
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
        }
    }
}
