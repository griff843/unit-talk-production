import { BaseAdapter, PlayerStatMap } from './types';
export declare class MLBAdapter extends BaseAdapter {
    private logger;
    private baseUrl;
    constructor();
    getName(): string;
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    private getGamePk;
    private matchesGame;
    private parseBoxScore;
}
//# sourceMappingURL=mlbAdapter.d.ts.map