import { GuildMember } from 'discord.js';
export declare function hasRole(member: GuildMember, roleName: string): boolean;
export declare function hasAnyRole(member: GuildMember, roleNames: string[]): boolean;
export declare function getRoleNames(member: GuildMember): string[];
export declare function isAdmin(member: GuildMember): boolean;
export declare function isModerator(member: GuildMember): boolean;
export declare function isUTCapper(member: GuildMember): boolean;
export declare function getTierColor(tier: string): number;
//# sourceMappingURL=roleUtils.d.ts.map