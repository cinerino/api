/**
 * 権限
 */
export enum Permission {
    Admin = 'admin',
    Customer = 'customer',
    User = 'user'
}

export enum RoleName {
    Owner = 'owner',
    Editor = 'editor',
    Viewer = 'viewer',
    User = 'user',
    Customer = 'customer'
}

export interface IRole {
    roleName: string;
    permissions: string[];
}
