import { BaseAdapter, PlayerStatMap } from './types';
export declare class WNBAAdapter extends BaseAdapter {
    private logger;
    private baseUrl;
    constructor();
    getName(): string;
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    private resolveGameId;
    private matchesGame;
    private parseBoxScore;
    private parseMadeAttempted;
    private checkDoubleDouble;
    private checkTripleDouble;
}
//# sourceMappingURL=wnbaAdapter.d.ts.map