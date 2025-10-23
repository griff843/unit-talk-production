import { BaseAdapter, PlayerStatMap } from './types';
export declare class NBAAdapter extends BaseAdapter {
    private logger;
    private baseUrl;
    private espnUrl;
    constructor();
    getName(): string;
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    private fetchFromBallDontLie;
    private fetchFromESPN;
    private resolveGameId;
    private resolveESPNGameId;
    private matchesNBAGame;
    private matchesESPNGame;
    private parseBallDontLieStats;
    private parseESPNBoxScore;
    private parseMinutes;
    private parseMadeAttempted;
    private checkDoubleDouble;
    private checkTripleDouble;
}
//# sourceMappingURL=nbaAdapter.d.ts.map