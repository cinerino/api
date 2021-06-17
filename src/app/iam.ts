/**
 * 権限
 */
export enum Permission {
    Admin = 'admin',
    ReadIAMMembersMe = 'iam.members.me.read',
    ReadPeopleMe = 'people.me.read'
}

export enum RoleName {
    Owner = 'owner',
    Editor = 'editor',
    Viewer = 'viewer',
    User = 'user',
    Customer = 'customer',
    POS = 'pos'
}

export interface IRole {
    roleName: string;
    permissions: string[];
}
