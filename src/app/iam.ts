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
    Custome = 'customer'
}

export interface IRole {
    roleName: string;
    permissions: string[];
}

/**
 * 役割
 */
export const roles: IRole[] = [
    {
        roleName: RoleName.Owner,
        permissions: [Permission.Admin, 'projects']
    },
    {
        roleName: RoleName.Editor,
        permissions: [Permission.User, 'projects.read-only', 'people.*']
    },
    {
        roleName: RoleName.Viewer,
        permissions: ['projects.read-only']
    },
    {
        roleName: RoleName.User,
        permissions: [Permission.User]
    }
];
