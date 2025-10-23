"use strict";
/**
 * Phase 9: Live Results Storage and Reporting System
 *
 * Persistent storage system for live testing results with comprehensive
 * reporting capabilities and data export functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveResultsStorage = void 0;
const logger_1 = require("@shared/logger");
const supabaseClient_1 = require("../../services/supabaseClient");
class LiveResultsStorage {
    constructor(config) {
        this.logger = new logger_1.Logger('LiveResultsStorage');
        this.config = config;
    }
    // ========================================
    // Live Bet Storage
    // ========================================
    async storeLiveBet(bet) {
        try {
            const betRecord = {
                id: bet.id,
                prop_id: bet.propId,
                bet_slip_id: bet.betSlipId,
                sport: bet.sport,
                market: bet.market,
                selection: bet.selection,
                line: bet.line,
                odds: bet.odds,
                stake: bet.stake,
                professional_score: bet.professionalScore,
                professional_features: bet.professionalFeatures,
                clv_tracking_id: bet.clvTrackingId,
                kelly_fraction: bet.kellyFraction,
                book: bet.book,
                placed_at: bet.placedAt,
                confirmed_at: bet.confirmedAt,
                settled_at: bet.settledAt,
                status: bet.status,
                result: bet.result,
                pnl: bet.pnl,
                roi: bet.roi,
                clv: bet.clv,
                risk_level: bet.riskLevel,
                correlation_risk: bet.correlationRisk,
                portfolio_impact: bet.portfolioImpact,
                testing_phase: bet.testingPhase,
                automatically_placed: bet.automaticallyPlaced,
                error_message: bet.errorMessage,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { error } = await supabaseClient_1.supabaseClient
                .from('live_test_bets')
                .upsert(betRecord, { onConflict: 'id' });
            if (error) {
                throw new Error(`Failed to store live bet: ${error.message}`);
            }
            this.logger.debug('Live bet stored', {
                betId: bet.id,
                status: bet.status,
                phase: bet.testingPhase
            });
        }
        catch (error) {
            this.logger.error('Failed to store live bet', {
                betId: bet.id,
                error: error.message
            });
            throw error;
        }
    }
    async updateLiveBetResult(betId, result, pnl, clv) {
        try {
            const updateData = {
                result,
                pnl,
                roi: pnl / (await this.getBetStake(betId)),
                status: 'SETTLED',
                settled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            if (clv !== undefined) {
                updateData.clv = clv;
            }
            const { error } = await supabaseClient_1.supabaseClient
                .from('live_test_bets')
                .update(updateData)
                .eq('id', betId);
            if (error) {
                throw new Error(`Failed to update bet result: ${error.message}`);
            }
            this.logger.debug('Bet result updated', {
                betId,
                result,
                pnl,
                clv
            });
        }
        catch (error) {
            this.logger.error('Failed to update bet result', {
                betId,
                error: error.message
            });
            throw error;
        }
    }
    async getBetStake(betId) {
        const { data, error } = await supabaseClient_1.supabaseClient
            .from('live_test_bets')
            .select('stake')
            .eq('id', betId)
            .single();
        if (error || !data) {
            throw new Error(`Could not find bet stake for ${betId}`);
        }
        return data.stake;
    }
    // ========================================
    // Performance Reports Storage
    // ========================================
    async storeDailyReport(report) {
        try {
            const reportRecord = {
                date: report.date,
                total_bets: report.totalBets,
                win_rate: report.winRate,
                roi: report.roi,
                clv: report.clv,
                net_profit: report.netProfit,
                drawdown: report.drawdown,
                sharpe_ratio: report.sharpeRatio,
                testing_phase: this.config.currentPhase,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { error } = await supabaseClient_1.supabaseClient
                .from('live_test_daily_reports')
                .upsert(reportRecord, { onConflict: 'date' });
            if (error) {
                throw new Error(`Failed to store daily report: ${error.message}`);
            }
            this.logger.debug('Daily report stored', {
                date: report.date,
                totalBets: report.totalBets,
                netProfit: report.netProfit
            });
        }
        catch (error) {
            this.logger.error('Failed to store daily report', {
                date: report.date,
                error: error.message
            });
            throw error;
        }
    }
    async storeWeeklyReport(report) {
        try {
            const reportRecord = {
                week: report.week,
                date: report.date,
                total_bets: report.totalBets,
                win_rate: report.winRate,
                roi: report.roi,
                clv: report.clv,
                net_profit: report.netProfit,
                drawdown: report.drawdown,
                sharpe_ratio: report.sharpeRatio,
                avg_bet_size: report.avgBetSize,
                max_drawdown: report.maxDrawdown,
                consistency: report.consistency,
                testing_phase: this.config.currentPhase,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { error } = await supabaseClient_1.supabaseClient
                .from('live_test_weekly_reports')
                .upsert(reportRecord, { onConflict: 'week' });
            if (error) {
                throw new Error(`Failed to store weekly report: ${error.message}`);
            }
            this.logger.debug('Weekly report stored', {
                week: report.week,
                totalBets: report.totalBets,
                winRate: report.winRate
            });
        }
        catch (error) {
            this.logger.error('Failed to store weekly report', {
                week: report.week,
                error: error.message
            });
            throw error;
        }
    }
    async storePhaseReport(report) {
        try {
            const reportRecord = {
                phase: report.phase,
                start_date: report.startDate,
                end_date: report.endDate,
                total_bets: report.totalBets,
                win_rate: report.winRate,
                roi: report.roi,
                avg_clv: report.avgCLV,
                net_profit: report.netProfit,
                success_criteria: report.successCriteria,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { error } = await supabaseClient_1.supabaseClient
                .from('live_test_phase_reports')
                .upsert(reportRecord, { onConflict: 'phase' });
            if (error) {
                throw new Error(`Failed to store phase report: ${error.message}`);
            }
            this.logger.info('Phase report stored', {
                phase: report.phase,
                totalBets: report.totalBets,
                successCriteria: report.successCriteria
            });
        }
        catch (error) {
            this.logger.error('Failed to store phase report', {
                phase: report.phase,
                error: error.message
            });
            throw error;
        }
    }
    // ========================================
    // CLV Tracking Storage
    // ========================================
    async storeCLVTrack(track) {
        try {
            const trackRecord = {
                bet_id: track.betId,
                prop_id: track.propId,
                initial_line: track.initialLine,
                initial_odds: track.initialOdds,
                closing_line: track.closingLine,
                closing_odds: track.closingOdds,
                clv: track.clv,
                clv_category: track.clvCategory,
                timestamp: track.timestamp,
                sport: track.sport,
                market: track.market,
                professional_features: track.professionalFeatures,
                created_at: new Date().toISOString()
            };
            const { error } = await supabaseClient_1.supabaseClient
                .from('live_test_clv_tracks')
                .insert(trackRecord);
            if (error) {
                throw new Error(`Failed to store CLV track: ${error.message}`);
            }
            this.logger.debug('CLV track stored', {
                betId: track.betId,
                clv: track.clv,
                category: track.clvCategory
            });
        }
        catch (error) {
            this.logger.error('Failed to store CLV track', {
                betId: track.betId,
                error: error.message
            });
            throw error;
        }
    }
    // ========================================
    // Risk Reports Storage
    // ========================================
    async storeRiskReport(report) {
        try {
            const reportRecord = {
                report_date: report.reportDate,
                risk_metrics: report.riskMetrics,
                risk_limits: report.riskLimits,
                recommendations: report.recommendations,
                testing_phase: this.config.currentPhase,
                created_at: new Date().toISOString()
            };
            const { error } = await supabaseClient_1.supabaseClient
                .from('live_test_risk_reports')
                .insert(reportRecord);
            if (error) {
                throw new Error(`Failed to store risk report: ${error.message}`);
            }
            this.logger.debug('Risk report stored', {
                date: report.reportDate,
                riskLevel: report.riskMetrics
            });
        }
        catch (error) {
            this.logger.error('Failed to store risk report', {
                date: report.reportDate,
                error: error.message
            });
            throw error;
        }
    }
    // ========================================
    // Data Retrieval
    // ========================================
    async getLiveBets(phase, dateRange, limit = 100) {
        try {
            let query = supabaseClient_1.supabaseClient
                .from('live_test_bets')
                .select('*')
                .order('placed_at', { ascending: false })
                .limit(limit);
            if (phase) {
                query = query.eq('testing_phase', phase);
            }
            if (dateRange) {
                query = query
                    .gte('placed_at', dateRange.start)
                    .lte('placed_at', dateRange.end);
            }
            const { data, error } = await query;
            if (error) {
                throw new Error(`Failed to retrieve live bets: ${error.message}`);
            }
            return (data || []).map(this.convertToLiveBet);
        }
        catch (error) {
            this.logger.error('Failed to retrieve live bets', {
                phase,
                dateRange,
                error: error.message
            });
            throw error;
        }
    }
    async getDailyReports(dateRange, phase) {
        try {
            let query = supabaseClient_1.supabaseClient
                .from('live_test_daily_reports')
                .select('*')
                .order('date', { ascending: false });
            if (phase) {
                query = query.eq('testing_phase', phase);
            }
            if (dateRange) {
                query = query
                    .gte('date', dateRange.start)
                    .lte('date', dateRange.end);
            }
            const { data, error } = await query;
            if (error) {
                throw new Error(`Failed to retrieve daily reports: ${error.message}`);
            }
            return (data || []).map(this.convertToDailyResult);
        }
        catch (error) {
            this.logger.error('Failed to retrieve daily reports', {
                dateRange,
                phase,
                error: error.message
            });
            throw error;
        }
    }
    async getPhaseReports() {
        try {
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('live_test_phase_reports')
                .select('*')
                .order('start_date', { ascending: true });
            if (error) {
                throw new Error(`Failed to retrieve phase reports: ${error.message}`);
            }
            return (data || []).map(this.convertToPhaseResult);
        }
        catch (error) {
            this.logger.error('Failed to retrieve phase reports', {
                error: error.message
            });
            throw error;
        }
    }
    async getCLVTracks(betId, dateRange) {
        try {
            let query = supabaseClient_1.supabaseClient
                .from('live_test_clv_tracks')
                .select('*')
                .order('timestamp', { ascending: false });
            if (betId) {
                query = query.eq('bet_id', betId);
            }
            if (dateRange) {
                query = query
                    .gte('timestamp', dateRange.start)
                    .lte('timestamp', dateRange.end);
            }
            const { data, error } = await query;
            if (error) {
                throw new Error(`Failed to retrieve CLV tracks: ${error.message}`);
            }
            return (data || []).map(this.convertToCLVTrack);
        }
        catch (error) {
            this.logger.error('Failed to retrieve CLV tracks', {
                betId,
                dateRange,
                error: error.message
            });
            throw error;
        }
    }
    // ========================================
    // Data Aggregation and Analytics
    // ========================================
    async getPerformanceByPhase() {
        try {
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('live_test_bets')
                .select(`
          testing_phase,
          COUNT(*) as total_bets,
          AVG(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as win_rate,
          AVG(roi) as avg_roi,
          AVG(clv) as avg_clv,
          SUM(pnl) as net_profit,
          MIN(placed_at) as start_date,
          MAX(placed_at) as end_date
        `)
                .not('result', 'is', null)
                .group('testing_phase');
            if (error) {
                throw new Error(`Failed to get performance by phase: ${error.message}`);
            }
            return (data || []).map(row => ({
                phase: row.testing_phase,
                startDate: row.start_date,
                endDate: row.end_date,
                totalBets: parseInt(row.total_bets),
                winRate: parseFloat(row.win_rate),
                roi: parseFloat(row.avg_roi),
                avgCLV: parseFloat(row.avg_clv),
                netProfit: parseFloat(row.net_profit),
                successCriteria: {
                    winRateTarget: parseFloat(row.win_rate) >= 0.55,
                    clvTarget: parseFloat(row.avg_clv) >= 0.6,
                    systemReliability: true, // Would need additional data
                    riskManagement: true // Would need additional data
                }
            }));
        }
        catch (error) {
            this.logger.error('Failed to get performance by phase', {
                error: error.message
            });
            throw error;
        }
    }
    async getPerformanceBySport() {
        try {
            const { data, error } = await supabaseClient_1.supabaseClient
                .from('live_test_bets')
                .select(`
          sport,
          COUNT(*) as total_bets,
          AVG(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as win_rate,
          AVG(roi) as avg_roi,
          AVG(clv) as avg_clv,
          SUM(pnl) as net_profit,
          STDDEV(roi) as roi_stddev
        `)
                .not('result', 'is', null)
                .group('sport');
            if (error) {
                throw new Error(`Failed to get performance by sport: ${error.message}`);
            }
            return (data || []).map(row => ({
                sport: row.sport,
                totalBets: parseInt(row.total_bets),
                winRate: parseFloat(row.win_rate),
                roi: parseFloat(row.avg_roi),
                avgCLV: parseFloat(row.avg_clv),
                netProfit: parseFloat(row.net_profit),
                confidence: this.calculateConfidence(parseInt(row.total_bets), parseFloat(row.win_rate), parseFloat(row.roi_stddev))
            }));
        }
        catch (error) {
            this.logger.error('Failed to get performance by sport', {
                error: error.message
            });
            throw error;
        }
    }
    calculateConfidence(sampleSize, winRate, stddev) {
        // Simplified confidence calculation
        if (sampleSize < 10)
            return 0.1;
        if (sampleSize < 30)
            return 0.5;
        if (sampleSize < 100)
            return 0.7;
        // Adjust for consistency (lower stddev = higher confidence)
        const consistencyFactor = Math.max(0.1, 1 - (stddev || 0.5));
        return Math.min(0.95, 0.8 * consistencyFactor + (sampleSize / 1000) * 0.2);
    }
    // ========================================
    // Data Export
    // ========================================
    async exportAllData(format = 'json') {
        try {
            const data = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    exportFormat: format,
                    currentPhase: this.config.currentPhase
                },
                liveBets: await this.getLiveBets(),
                dailyReports: await this.getDailyReports(),
                phaseReports: await this.getPhaseReports(),
                clvTracks: await this.getCLVTracks(),
                performanceByPhase: await this.getPerformanceByPhase(),
                performanceBySport: await this.getPerformanceBySport()
            };
            if (format === 'csv') {
                return this.convertDataToCSV(data);
            }
            return JSON.stringify(data, null, 2);
        }
        catch (error) {
            this.logger.error('Failed to export all data', {
                format,
                error: error.message
            });
            throw error;
        }
    }
    convertDataToCSV(data) {
        const sections = [];
        // Live bets section
        if (data.liveBets.length > 0) {
            const betHeaders = ['ID', 'Sport', 'Market', 'Stake', 'Odds', 'Result', 'P&L', 'ROI', 'CLV', 'Professional Score', 'Phase', 'Placed At'];
            const betRows = data.liveBets.map((bet) => [
                bet.id,
                bet.sport,
                bet.market,
                bet.stake,
                bet.odds,
                bet.result || 'PENDING',
                bet.pnl || 0,
                bet.roi || 0,
                bet.clv || 0,
                bet.professionalScore,
                bet.testingPhase,
                bet.placedAt
            ]);
            sections.push('LIVE BETS');
            sections.push([betHeaders, ...betRows].map(row => row.join(',')).join('\n'));
        }
        // Daily reports section
        if (data.dailyReports.length > 0) {
            const dailyHeaders = ['Date', 'Total Bets', 'Win Rate', 'ROI', 'CLV', 'Net Profit', 'Sharpe Ratio'];
            const dailyRows = data.dailyReports.map((report) => [
                report.date,
                report.totalBets,
                (report.winRate * 100).toFixed(2) + '%',
                (report.roi * 100).toFixed(2) + '%',
                (report.clv * 100).toFixed(2) + '%',
                '$' + report.netProfit.toFixed(2),
                report.sharpeRatio.toFixed(2)
            ]);
            sections.push('\n\nDAILY REPORTS');
            sections.push([dailyHeaders, ...dailyRows].map(row => row.join(',')).join('\n'));
        }
        return sections.join('\n');
    }
    // ========================================
    // Database Schema Creation
    // ========================================
    async createTablesIfNotExist() {
        try {
            // This would typically be handled by migrations
            // For live testing, we'll create tables if they don't exist
            const tables = [
                {
                    name: 'live_test_bets',
                    schema: `
            CREATE TABLE IF NOT EXISTS live_test_bets (
              id TEXT PRIMARY KEY,
              prop_id TEXT,
              bet_slip_id TEXT,
              sport TEXT NOT NULL,
              market TEXT NOT NULL,
              selection TEXT NOT NULL,
              line DECIMAL NOT NULL,
              odds DECIMAL NOT NULL,
              stake DECIMAL NOT NULL,
              professional_score INTEGER,
              professional_features JSONB,
              clv_tracking_id TEXT,
              kelly_fraction DECIMAL,
              book TEXT,
              placed_at TIMESTAMPTZ NOT NULL,
              confirmed_at TIMESTAMPTZ,
              settled_at TIMESTAMPTZ,
              status TEXT NOT NULL,
              result TEXT,
              pnl DECIMAL,
              roi DECIMAL,
              clv DECIMAL,
              risk_level TEXT,
              correlation_risk DECIMAL,
              portfolio_impact DECIMAL,
              testing_phase TEXT NOT NULL,
              automatically_placed BOOLEAN DEFAULT TRUE,
              error_message TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )
          `
                },
                {
                    name: 'live_test_daily_reports',
                    schema: `
            CREATE TABLE IF NOT EXISTS live_test_daily_reports (
              date DATE PRIMARY KEY,
              total_bets INTEGER NOT NULL,
              win_rate DECIMAL NOT NULL,
              roi DECIMAL NOT NULL,
              clv DECIMAL NOT NULL,
              net_profit DECIMAL NOT NULL,
              drawdown DECIMAL NOT NULL,
              sharpe_ratio DECIMAL NOT NULL,
              testing_phase TEXT NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )
          `
                },
                {
                    name: 'live_test_weekly_reports',
                    schema: `
            CREATE TABLE IF NOT EXISTS live_test_weekly_reports (
              week TEXT PRIMARY KEY,
              date DATE NOT NULL,
              total_bets INTEGER NOT NULL,
              win_rate DECIMAL NOT NULL,
              roi DECIMAL NOT NULL,
              clv DECIMAL NOT NULL,
              net_profit DECIMAL NOT NULL,
              drawdown DECIMAL NOT NULL,
              sharpe_ratio DECIMAL NOT NULL,
              avg_bet_size DECIMAL NOT NULL,
              max_drawdown DECIMAL NOT NULL,
              consistency DECIMAL NOT NULL,
              testing_phase TEXT NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )
          `
                },
                {
                    name: 'live_test_phase_reports',
                    schema: `
            CREATE TABLE IF NOT EXISTS live_test_phase_reports (
              phase TEXT PRIMARY KEY,
              start_date TIMESTAMPTZ NOT NULL,
              end_date TIMESTAMPTZ,
              total_bets INTEGER NOT NULL,
              win_rate DECIMAL NOT NULL,
              roi DECIMAL NOT NULL,
              avg_clv DECIMAL NOT NULL,
              net_profit DECIMAL NOT NULL,
              success_criteria JSONB NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )
          `
                },
                {
                    name: 'live_test_clv_tracks',
                    schema: `
            CREATE TABLE IF NOT EXISTS live_test_clv_tracks (
              id SERIAL PRIMARY KEY,
              bet_id TEXT NOT NULL,
              prop_id TEXT NOT NULL,
              initial_line DECIMAL NOT NULL,
              initial_odds DECIMAL NOT NULL,
              closing_line DECIMAL NOT NULL,
              closing_odds DECIMAL NOT NULL,
              clv DECIMAL NOT NULL,
              clv_category TEXT NOT NULL,
              timestamp TIMESTAMPTZ NOT NULL,
              sport TEXT NOT NULL,
              market TEXT NOT NULL,
              professional_features JSONB,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )
          `
                },
                {
                    name: 'live_test_risk_reports',
                    schema: `
            CREATE TABLE IF NOT EXISTS live_test_risk_reports (
              id SERIAL PRIMARY KEY,
              report_date DATE NOT NULL,
              risk_metrics JSONB NOT NULL,
              risk_limits JSONB NOT NULL,
              recommendations TEXT[] NOT NULL,
              testing_phase TEXT NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )
          `
                }
            ];
            for (const table of tables) {
                try {
                    await supabaseClient_1.supabaseClient.rpc('execute_sql', { sql: table.schema });
                    this.logger.debug(`Table ${table.name} created or verified`);
                }
                catch (error) {
                    this.logger.warn(`Could not create table ${table.name}`, {
                        error: error.message
                    });
                }
            }
            this.logger.info('Database schema verification completed');
        }
        catch (error) {
            this.logger.error('Failed to create database tables', {
                error: error.message
            });
            // Don't throw - this is optional for development
        }
    }
    // ========================================
    // Data Conversion Helpers
    // ========================================
    convertToLiveBet(record) {
        return {
            id: record.id,
            propId: record.prop_id,
            betSlipId: record.bet_slip_id,
            sport: record.sport,
            market: record.market,
            selection: record.selection,
            line: record.line,
            odds: record.odds,
            stake: record.stake,
            professionalScore: record.professional_score,
            professionalFeatures: record.professional_features,
            clvTrackingId: record.clv_tracking_id,
            kellyFraction: record.kelly_fraction,
            book: record.book,
            placedAt: record.placed_at,
            confirmedAt: record.confirmed_at,
            settledAt: record.settled_at,
            status: record.status,
            result: record.result,
            pnl: record.pnl,
            roi: record.roi,
            clv: record.clv,
            riskLevel: record.risk_level,
            correlationRisk: record.correlation_risk,
            portfolioImpact: record.portfolio_impact,
            testingPhase: record.testing_phase,
            automaticallyPlaced: record.automatically_placed,
            errorMessage: record.error_message
        };
    }
    convertToDailyResult(record) {
        return {
            date: record.date,
            totalBets: record.total_bets,
            winRate: record.win_rate,
            roi: record.roi,
            clv: record.clv,
            netProfit: record.net_profit,
            drawdown: record.drawdown,
            sharpeRatio: record.sharpe_ratio
        };
    }
    convertToPhaseResult(record) {
        return {
            phase: record.phase,
            startDate: record.start_date,
            endDate: record.end_date,
            totalBets: record.total_bets,
            winRate: record.win_rate,
            roi: record.roi,
            avgCLV: record.avg_clv,
            netProfit: record.net_profit,
            successCriteria: record.success_criteria
        };
    }
    convertToCLVTrack(record) {
        return {
            betId: record.bet_id,
            propId: record.prop_id,
            initialLine: record.initial_line,
            initialOdds: record.initial_odds,
            closingLine: record.closing_line,
            closingOdds: record.closing_odds,
            clv: record.clv,
            clvCategory: record.clv_category,
            timestamp: record.timestamp,
            sport: record.sport,
            market: record.market,
            professionalFeatures: record.professional_features
        };
    }
}
exports.LiveResultsStorage = LiveResultsStorage;
