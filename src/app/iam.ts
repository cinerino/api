/**
 * 権限
 */
export enum Permission {
    Customer = 'customer',
    User = 'user'
}

export enum RoleName {
    Owner = 'owner',
    Editor = 'editor',
    Viewer = 'viewer',
    User = 'user'
}

/**
 * 役割
 */
export const roles = [
    {
        roleName: RoleName.Owner,
        permissions: []
    },
    {
        roleName: RoleName.Editor,
        permissions: []
    },
    {
        roleName: RoleName.Viewer,
        permissions: []
    },
    {
        roleName: RoleName.User,
        permissions: [Permission.User]
    }
];
