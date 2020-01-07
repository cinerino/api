"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 権限
 */
var Permission;
(function (Permission) {
    Permission["Admin"] = "admin";
    Permission["Customer"] = "customer";
    Permission["User"] = "user";
})(Permission = exports.Permission || (exports.Permission = {}));
var RoleName;
(function (RoleName) {
    RoleName["Owner"] = "owner";
    RoleName["Editor"] = "editor";
    RoleName["Viewer"] = "viewer";
    RoleName["User"] = "user";
    RoleName["Custome"] = "customer";
})(RoleName = exports.RoleName || (exports.RoleName = {}));
/**
 * 役割
 */
exports.roles = [
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
