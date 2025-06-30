"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRole = hasRole;
exports.hasAnyRole = hasAnyRole;
exports.getRoleNames = getRoleNames;
exports.isAdmin = isAdmin;
exports.isModerator = isModerator;
exports.isUTCapper = isUTCapper;
exports.getTierColor = getTierColor;
function hasRole(member, roleName) {
    if (!member || !member.roles) {
        return false;
    }
    return member.roles.cache.some(role => role.name === roleName);
}
function hasAnyRole(member, roleNames) {
    if (!member || !member.roles) {
        return false;
    }
    return member.roles.cache.some(role => roleNames.includes(role.name));
}
function getRoleNames(member) {
    if (!member || !member.roles) {
        return [];
    }
    return member.roles.cache.map(role => role.name);
}
function isAdmin(member) {
    if (!member || !member.permissions) {
        return false;
    }
    return member.permissions.has('Administrator');
}
function isModerator(member) {
    if (!member) {
        return false;
    }
    return hasAnyRole(member, ['Moderator', 'Admin', 'Owner']) || isAdmin(member);
}
function isUTCapper(member) {
    return hasRole(member, 'UT Capper');
}
function getTierColor(tier) {
    switch (tier?.toLowerCase()) {
        case 'elite':
            return 0xFFD700;
        case 'pro':
            return 0x9932CC;
        case 'rookie':
            return 0x32CD32;
        default:
            return 0x808080;
    }
}
//# sourceMappingURL=roleUtils.js.map