"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 権限
 */
var Permission;
(function (Permission) {
    Permission["Customer"] = "customer";
    Permission["User"] = "user";
})(Permission = exports.Permission || (exports.Permission = {}));
var RoleName;
(function (RoleName) {
    RoleName["Owner"] = "owner";
    RoleName["Editor"] = "editor";
    RoleName["Viewer"] = "viewer";
    RoleName["User"] = "user";
})(RoleName = exports.RoleName || (exports.RoleName = {}));
/**
 * 役割
 */
exports.roles = [
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
