export declare function createSOP(title: string, content: string): Promise<string>;
export declare function createKPI(name: string, target: number, current: number, unit: string): Promise<string>;
export declare const createNotionSOP: typeof createSOP;
export declare const createNotionKPI: typeof createKPI;
export declare function sendDiscordAlert(message: string, channel?: string): Promise<void>;
export declare function sendNotionLog(title: string, content: string, type?: string): Promise<void>;
//# sourceMappingURL=operatorHelpers.d.ts.map