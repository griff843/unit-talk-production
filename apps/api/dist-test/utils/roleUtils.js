"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRole = hasRole;
exports.hasAnyRole = hasAnyRole;
exports.getRoleNames = getRoleNames;
exports.isAdmin = isAdmin;
exports.isModerator = isModerator;
exports.isUTCapper = isUTCapper;
exports.getTierColor = getTierColor;
/**
 * Check if a guild member has a specific role
 */
function hasRole(member, roleName) {
    if (!member || !member.roles) {
        return false;
    }
    return member.roles.cache.some(role => role.name === roleName);
}
/**
 * Check if a guild member has any of the specified roles
 */
function hasAnyRole(member, roleNames) {
    if (!member || !member.roles) {
        return false;
    }
    return member.roles.cache.some(role => roleNames.includes(role.name));
}
/**
 * Get all role names for a guild member
 */
function getRoleNames(member) {
    if (!member || !member.roles) {
        return [];
    }
    return member.roles.cache.map(role => role.name);
}
/**
 * Check if a guild member has admin permissions
 */
function isAdmin(member) {
    if (!member || !member.permissions) {
        return false;
    }
    return member.permissions.has('Administrator');
}
/**
 * Check if a guild member has moderator permissions
 */
function isModerator(member) {
    if (!member) {
        return false;
    }
    return hasAnyRole(member, ['Moderator', 'Admin', 'Owner']) || isAdmin(member);
}
/**
 * Check if a guild member is a UT Capper
 */
function isUTCapper(member) {
    return hasRole(member, 'UT Capper');
}
/**
 * Get color for capper tier
 */
function getTierColor(tier) {
    switch (tier?.toLowerCase()) {
        case 'elite':
            return 0xFFD700; // Gold
        case 'pro':
            return 0x9932CC; // Purple
        case 'rookie':
            return 0x32CD32; // Green
        default:
            return 0x808080; // Gray
    }
}
