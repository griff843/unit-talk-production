import { BaseAdapter, PlayerStatMap } from './types';
export declare class NCAAAdapter extends BaseAdapter {
    private logger;
    private baseUrl;
    constructor();
    getName(): string;
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    private determineSport;
    private resolveGameId;
    private matchesGame;
    private parseFootballBoxScore;
    private parseBasketballBoxScore;
    private getFootballStatMapping;
    private parseFootballStatCategory;
    private parseMadeAttempted;
}
//# sourceMappingURL=ncaaAdapter.d.ts.map