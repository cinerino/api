"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleName = exports.Permission = void 0;
/**
 * 権限
 */
var Permission;
(function (Permission) {
    Permission["Admin"] = "admin";
})(Permission = exports.Permission || (exports.Permission = {}));
var RoleName;
(function (RoleName) {
    RoleName["Owner"] = "owner";
    RoleName["Editor"] = "editor";
    RoleName["Viewer"] = "viewer";
    RoleName["User"] = "user";
    RoleName["Customer"] = "customer";
})(RoleName = exports.RoleName || (exports.RoleName = {}));
