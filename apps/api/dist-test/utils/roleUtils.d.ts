import { GuildMember } from 'discord.js';
/**
 * Check if a guild member has a specific role
 */
export declare function hasRole(member: GuildMember, roleName: string): boolean;
/**
 * Check if a guild member has any of the specified roles
 */
export declare function hasAnyRole(member: GuildMember, roleNames: string[]): boolean;
/**
 * Get all role names for a guild member
 */
export declare function getRoleNames(member: GuildMember): string[];
/**
 * Check if a guild member has admin permissions
 */
export declare function isAdmin(member: GuildMember): boolean;
/**
 * Check if a guild member has moderator permissions
 */
export declare function isModerator(member: GuildMember): boolean;
/**
 * Check if a guild member is a UT Capper
 */
export declare function isUTCapper(member: GuildMember): boolean;
/**
 * Get color for capper tier
 */
export declare function getTierColor(tier: string): number;
//# sourceMappingURL=roleUtils.d.ts.map