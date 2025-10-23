import { BaseAdapter, PlayerStatMap } from './types';
export declare class NFLAdapter extends BaseAdapter {
    private logger;
    private baseUrl;
    constructor();
    getName(): string;
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    private resolveGameId;
    private matchesGame;
    private parseBoxScore;
    private getStatMapping;
    private parseStatCategory;
}
//# sourceMappingURL=nflAdapter.d.ts.map