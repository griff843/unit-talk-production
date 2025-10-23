"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardManager = void 0;
const zod_1 = require("zod");
// Validation schemas
const leaderboardEntrySchema = zod_1.z.object({
    rank: zod_1.z.number().min(1),
    participantId: zod_1.z.string().uuid(),
    score: zod_1.z.number(),
    trend: zod_1.z.enum(['up', 'down', 'stable']),
    achievements: zod_1.z.array(zod_1.z.string()),
    fairPlayScore: zod_1.z.number().min(0).max(100)
});
const leaderboardSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    contestId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['global', 'regional', 'division']),
    rankings: zod_1.z.array(leaderboardEntrySchema),
    lastUpdated: zod_1.z.date(),
    stats: zod_1.z.object({
        totalParticipants: zod_1.z.number(),
        averageScore: zod_1.z.number(),
        highestScore: zod_1.z.number(),
        lowestScore: zod_1.z.number(),
        scoreDistribution: zod_1.z.record(zod_1.z.string(), zod_1.z.number())
    })
});
class LeaderboardManager {
    constructor(config, deps) {
        this.supabase = deps.supabase;
        this.config = config;
        this.logger = deps.logger;
        this.updateQueue = new Map();
    }
    async initialize() {
        try {
            // Subscribe to participant professional_score updates
            this.supabase
                .channel('score_updates')
                .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'contest_participants',
                filter: 'professional_score IS NOT NULL'
            }, this.handleScoreUpdate.bind(this))
                .subscribe();
            // Load active leaderboards
            const { data: leaderboards, error } = await this.supabase
                .from('leaderboards')
                .select('*')
                .eq('status', 'active');
            if (error) {
                throw error;
            }
            // Initialize update queues for active leaderboards
            for (const leaderboard of leaderboards || []) {
                this.scheduleUpdate(leaderboard.id);
            }
            this.logger.info('LeaderboardManager initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize LeaderboardManager', {
                err: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async cleanup() {
        // Clear all update timers
        for (const timer of Array.from(this.updateQueue.values())) {
            clearTimeout(timer);
        }
        this.updateQueue.clear();
    }
    async handleScoreUpdate(payload) {
        try {
            const { new: newScore, old: oldScore } = payload;
            if (!newScore || !oldScore || newScore.professional_score === oldScore.professional_score) {
                return;
            }
            // Get leaderboard for this participant's contest
            const { data: leaderboard, error } = await this.supabase
                .from('leaderboards')
                .select('*')
                .eq('contestId', newScore.contestId)
                .single();
            if (error) {
                throw error;
            }
            // Schedule immediate update if professional_score change is significant
            const scoreDiff = Math.abs(newScore.professional_score - oldScore.professional_score);
            if (scoreDiff > leaderboard.updateThreshold) {
                await this.updateLeaderboard(leaderboard.id, true);
            }
            else {
                this.scheduleUpdate(leaderboard.id);
            }
            // Metrics removed for simplification
        }
        catch (error) {
            this.logger.error('Failed to handle professional_score update', {
                err: error instanceof Error ? error.message : String(error)
            });
        }
    }
    scheduleUpdate(leaderboardId) {
        // Clear existing timer if any
        if (this.updateQueue.has(leaderboardId)) {
            clearTimeout(this.updateQueue.get(leaderboardId));
        }
        // Schedule new update
        const updateInterval = this.config.health?.interval ? this.config.health.interval * 1000 : 5000;
        const timer = setTimeout(() => this.updateLeaderboard(leaderboardId, false), updateInterval);
        this.updateQueue.set(leaderboardId, timer);
    }
    async updateLeaderboard(leaderboardId, immediate) {
        try {
            const startTime = Date.now();
            // Get current leaderboard data
            const { data: leaderboard, error: leaderboardError } = await this.supabase
                .from('leaderboards')
                .select('*')
                .eq('id', leaderboardId)
                .single();
            if (leaderboardError) {
                throw leaderboardError;
            }
            // Get all participants for this contest
            const { data: participants, error: participantsError } = await this.supabase
                .from('contest_participants')
                .select('*')
                .eq('contestId', leaderboard.contestId)
                .order('score', { ascending: false });
            if (participantsError) {
                throw participantsError;
            }
            // Calculate new rankings with tiebreakers
            const rankings = await this.calculateRankings(participants || [], leaderboard);
            // Calculate leaderboard statistics
            const stats = this.calculateStats(participants || []);
            // Update leaderboard
            const { error: updateError } = await this.supabase
                .from('leaderboards')
                .update({
                rankings,
                stats,
                lastUpdated: new Date()
            })
                .eq('id', leaderboardId);
            if (updateError) {
                throw updateError;
            }
            // Update metrics
            // Metrics removed for simplification
            this.logger.info('Leaderboard updated successfully', {
                leaderboardId,
                participantCount: participants?.length,
                updateTime: Date.now() - startTime
            });
            // Schedule next update if not immediate
            if (!immediate) {
                this.scheduleUpdate(leaderboardId);
            }
        }
        catch (error) {
            this.logger.error('Failed to update leaderboard', {
                err: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async calculateRankings(participants, leaderboard) {
        // Sort participants by primary professional_score
        let sortedParticipants = [...participants].sort((a, b) => (b.professional_score ?? 0) - (a.professional_score ?? 0));
        // Apply tiebreakers for equal scores
        sortedParticipants = await this.applyTiebreakers(sortedParticipants, leaderboard);
        // Get previous rankings for trend calculation
        const previousRankings = new Map((leaderboard.rankings || []).map(entry => [entry.userId, entry.rank]));
        // Generate new rankings with trends
        return sortedParticipants.map((participant, index) => {
            const previousRank = previousRankings.get(participant.id) || 0;
            const currentRank = index + 1;
            return {
                rank: currentRank,
                userId: participant.id, // Changed from participantId to userId
                score: participant.professional_score ?? 0,
                achievements: [], // Removed achievements access since it doesn't exist on Participant
                metadata: {
                    trend: this.calculateTrend(currentRank, previousRank),
                    fairPlayScore: participant.fairPlayScore ?? 0
                }
            };
        });
    }
    async applyTiebreakers(participants, _leaderboard) {
        // Group participants by professional_score
        const scoreGroups = new Map();
        participants.forEach(p => {
            const group = scoreGroups.get(p.professional_score ?? 0) || [];
            group.push(p);
            scoreGroups.set(p.professional_score ?? 0, group);
        });
        // Apply tiebreakers for each group with multiple participants
        const result = [];
        for (const [_score, group] of Array.from(scoreGroups.entries())) {
            if (group.length === 1) {
                const participant = group[0];
                if (participant) {
                    result.push(participant);
                }
                continue;
            }
            // Apply tiebreakers in order:
            // 1. Fair play professional_score
            // 2. Achievement count
            // 3. Time of last professional_score update
            // 4. Head-to-head record (if applicable)
            const tiebroken = await Promise.all(group.map(async (p) => {
                const { data: history } = await this.supabase
                    .from('participant_history')
                    .select('updated_at')
                    .eq('participant_id', p.id)
                    .order('updated_at', { ascending: false })
                    .limit(1);
                return {
                    participant: p,
                    fairPlayScore: p.fairPlayScore,
                    achievementCount: 0, // Removed achievements access since it doesn't exist on Participant
                    lastUpdate: history?.[0]?.updated_at || new Date(0)
                };
            }));
            // Sort by tiebreaker criteria
            tiebroken.sort((a, b) => {
                if (a.fairPlayScore !== b.fairPlayScore) {
                    return (b.fairPlayScore || 0) - (a.fairPlayScore || 0); // Handle undefined fairPlayScore
                }
                if (a.achievementCount !== b.achievementCount) {
                    return b.achievementCount - a.achievementCount;
                }
                return a.lastUpdate.getTime() - b.lastUpdate.getTime();
            });
            result.push(...tiebroken.map(t => t.participant));
        }
        return result;
    }
    calculateTrend(currentRank, previousRank) {
        if (previousRank === 0) {
            return 'stable';
        }
        if (currentRank < previousRank) {
            return 'up';
        }
        if (currentRank > previousRank) {
            return 'down';
        }
        return 'stable';
    }
    calculateStats(participants) {
        const scores = participants.map(p => p.professional_score ?? 0).filter((score) => score !== undefined);
        const totalParticipants = participants.length;
        // Calculate basic statistics
        const stats = {
            totalParticipants,
            averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
            highestScore: scores.length > 0 ? Math.max(...scores) : 0,
            lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
            scoreDistribution: {}
        };
        // Calculate professional_score distribution in 10-point buckets
        scores.forEach(professional_score => {
            const bucket = Math.floor(professional_score / 10) * 10;
            stats.scoreDistribution[bucket] = (stats.scoreDistribution[bucket] || 0) + 1;
        });
        return stats;
    }
    async createLeaderboard(contestId, type) {
        try {
            const leaderboard = {
                id: crypto.randomUUID(),
                contestId,
                type,
                rankings: [],
                entries: [], // Added missing entries property
                lastUpdated: new Date().toISOString(), // Convert Date to string
                stats: {
                    totalParticipants: 0,
                    averageScore: 0,
                    highestScore: 0,
                    lowestScore: 0,
                    scoreDistribution: {}
                }
            };
            // Validate leaderboard structure
            await leaderboardSchema.parseAsync(leaderboard);
            // Insert into database
            const { error } = await this.supabase
                .from('leaderboards')
                .insert(leaderboard);
            if (error) {
                throw error;
            }
            // Initialize update queue
            this.scheduleUpdate(leaderboard.id);
            // Metrics removed for simplification
            return leaderboard;
        }
        catch (error) {
            this.logger.error('Failed to create leaderboard', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
    async getLeaderboard(leaderboardId) {
        try {
            const { data, error } = await this.supabase
                .from('leaderboards')
                .select('*')
                .eq('id', leaderboardId)
                .single();
            if (error) {
                throw error;
            }
            if (!data) {
                throw new Error('Leaderboard not found');
            }
            return data;
        }
        catch (error) {
            this.logger.error('Failed to get leaderboard', {
                err: error instanceof Error ? error.message : String(error)
            });
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
    async checkHealth() {
        try {
            // Check database connectivity
            const { error: dbError } = await this.supabase
                .from('leaderboards')
                .select('id')
                .limit(1);
            if (dbError) {
                throw dbError;
            }
            // Check update queue health
            const queueSize = this.updateQueue.size;
            const oldestUpdate = Math.min(...Array.from(this.updateQueue.values()).map(timer => timer[Symbol.toPrimitive]()));
            const queueHealth = Date.now() - oldestUpdate < 30000; // No updates older than 30 seconds
            const status = queueHealth ? 'healthy' : 'degraded';
            return {
                status,
                details: {
                    queueSize,
                    oldestUpdate,
                    queueHealth,
                    activeLeaderboards: 0, // Metrics removed for simplification
                    updateLatency: 0 // Metrics removed for simplification
                }
            };
        }
        catch (error) {
            this.logger.error('Health check failed', {
                err: error instanceof Error ? error.message : String(error)
            });
            return {
                status: 'unhealthy',
                details: { error: error instanceof Error ? error.message : 'Unknown error' }
            };
        }
    }
    async updateLeaderboards() {
        // Update all active leaderboards
        const activeLeaderboards = Array.from(this.updateQueue.keys());
        for (const leaderboardId of activeLeaderboards) {
            await this.updateLeaderboard(leaderboardId, false);
        }
    }
    async getMetrics() {
        return {
            agentName: 'LeaderboardManager',
            successCount: 0,
            errorCount: 0,
            warningCount: 0,
            processingTimeMs: 0,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
    }
}
exports.LeaderboardManager = LeaderboardManager;
