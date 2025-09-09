import { SupabaseService } from './supabase';
import { logger } from '../utils/logger';
import * as ExcelJS from 'exceljs';

export class DataExportService {
  private supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  async exportPicksToCSV(userId: string, period: string = 'all'): Promise<Buffer> {
    try {
      const picks = await this.supabaseService.getPickHistory(userId);

      // Convert picks to CSV format
      const csvData = [
        [
          'Date',
          'Sport',
          'Pick Type',
          'Team',
          'Odds',
          'Units',
          'Confidence',
          'Status',
          'Profit/Loss',
          'Notes',
        ],
      ];

      picks.forEach((pick: any) => {
        csvData.push([
          new Date(pick.created_at).toLocaleDateString(),
          pick.sport,
          pick.pick_type,
          pick.team_name,
          pick.odds,
          pick.units,
          pick.confidence,
          pick.status,
          pick.profit_loss || 0,
          pick.notes || '',
        ]);
      });

      // Convert to CSV string
      const csv = csvData.map(row => row.join(',')).join('\n');
      return Buffer.from(csv);
    } catch (error) {
      logger.error('Error exporting picks to CSV:', error);
      throw error;
    }
  }

  async exportPicksToExcel(userId: string, period: string = 'all'): Promise<Buffer> {
    try {
      const picks = await this.supabaseService.getPickHistory(userId);
      const analytics = await this.supabaseService.getPickAnalytics(userId);
      const trends = await this.supabaseService.getEdgeTrackerTrends(userId);

      // Create workbook with multiple sheets using ExcelJS
      const workbook = new ExcelJS.Workbook();

      // Picks sheet
      const picksSheet = workbook.addWorksheet('Picks');
      picksSheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Sport', key: 'sport', width: 10 },
        { header: 'Pick Type', key: 'pickType', width: 15 },
        { header: 'Team', key: 'team', width: 20 },
        { header: 'Odds', key: 'odds', width: 8 },
        { header: 'Units', key: 'units', width: 8 },
        { header: 'Confidence', key: 'confidence', width: 12 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Profit/Loss', key: 'profitLoss', width: 12 },
        { header: 'Notes', key: 'notes', width: 30 }
      ];

      picks.forEach((pick: any) => {
        picksSheet.addRow({
          date: new Date(pick.created_at).toLocaleDateString(),
          sport: pick.sport,
          pickType: pick.pick_type,
          team: pick.team_name,
          odds: pick.odds,
          units: pick.units,
          confidence: pick.confidence,
          status: pick.status,
          profitLoss: pick.profit_loss || 0,
          notes: pick.notes || ''
        });
      });

      // Analytics sheet
      const analyticsSheet = workbook.addWorksheet('Analytics');
      analyticsSheet.columns = [
        { header: 'Metric', key: 'metric', width: 20 },
        { header: 'Value', key: 'value', width: 15 }
      ];

      const analyticsMetrics = [
        { metric: 'Total Picks', value: analytics?.total_picks || 0 },
        { metric: 'Win Rate', value: `${(analytics?.win_rate || 0).toFixed(1)}%` },
        { metric: 'ROI', value: `${(analytics?.roi || 0).toFixed(1)}%` },
        { metric: 'Total Units Risked', value: analytics?.total_units_risked || 0 },
        { metric: 'Total Units Won', value: analytics?.total_units_won || 0 },
        { metric: 'Total Units Lost', value: analytics?.total_units_lost || 0 },
        { metric: 'Average Odds', value: analytics?.average_odds || 0 }
      ];

      analyticsMetrics.forEach(item => analyticsSheet.addRow(item));

      // Trends sheet
      const trendsSheet = workbook.addWorksheet('Trends');
      trendsSheet.columns = [
        { header: 'Metric', key: 'metric', width: 20 },
        { header: 'Value', key: 'value', width: 15 }
      ];

      const trendsMetrics = [
        { metric: 'Best Sport', value: trends?.bestSport || 'N/A' },
        { metric: 'Worst Sport', value: trends?.worstSport || 'N/A' },
        { metric: 'Favorite Pick Type', value: trends?.favoritePickType || 'N/A' },
        { metric: 'Units per Play', value: trends?.unitsPerPlay || 0 },
        { metric: 'Win Rate', value: `${(trends?.winRate || 0).toFixed(1)}%` },
        { metric: 'ROI', value: `${(trends?.roi || 0).toFixed(1)}%` }
      ];

      trendsMetrics.forEach(item => trendsSheet.addRow(item));

      // Convert to buffer
      return Buffer.from(await workbook.xlsx.writeBuffer());
    } catch (error) {
      logger.error('Error exporting picks to Excel:', error);
      throw error;
    }
  }

  async exportAnalytics(userId: string, format: 'csv' | 'excel' = 'excel'): Promise<Buffer> {
    try {
      const analytics = await this.supabaseService.getPickAnalytics(userId);
      const trends = await this.supabaseService.getEdgeTrackerTrends(userId);

      if (format === 'csv') {
        const csvData = [
          ['Metric', 'Value'],
          ['Total Picks', analytics?.total_picks || 0],
          ['Win Rate', `${(analytics?.win_rate || 0).toFixed(1)}%`],
          ['ROI', `${(analytics?.roi || 0).toFixed(1)}%`],
          ['Total Units Risked', analytics?.total_units_risked || 0],
          ['Total Units Won', analytics?.total_units_won || 0],
          ['Total Units Lost', analytics?.total_units_lost || 0],
          ['Average Odds', analytics?.average_odds || 0],
          ['Best Sport', trends?.bestSport || 'N/A'],
          ['Worst Sport', trends?.worstSport || 'N/A'],
          ['Favorite Pick Type', trends?.favoritePickType || 'N/A'],
          ['Units per Play', trends?.unitsPerPlay || 0],
        ];

        const csv = csvData.map(row => row.join(',')).join('\n');
        return Buffer.from(csv);
      } else {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Analytics');

        sheet.columns = [
          { header: 'Metric', key: 'metric', width: 20 },
          { header: 'Value', key: 'value', width: 15 }
        ];

        const data = [
          { metric: 'Total Picks', value: analytics?.total_picks || 0 },
          { metric: 'Win Rate', value: `${(analytics?.win_rate || 0).toFixed(1)}%` },
          { metric: 'ROI', value: `${(analytics?.roi || 0).toFixed(1)}%` },
          { metric: 'Total Units Risked', value: analytics?.total_units_risked || 0 },
          { metric: 'Total Units Won', value: analytics?.total_units_won || 0 },
          { metric: 'Total Units Lost', value: analytics?.total_units_lost || 0 },
          { metric: 'Average Odds', value: analytics?.average_odds || 0 },
          { metric: 'Best Sport', value: trends?.bestSport || 'N/A' },
          { metric: 'Worst Sport', value: trends?.worstSport || 'N/A' },
          { metric: 'Favorite Pick Type', value: trends?.favoritePickType || 'N/A' },
          { metric: 'Units per Play', value: trends?.unitsPerPlay || 0 }
        ];

        data.forEach(item => sheet.addRow(item));

        return Buffer.from(await workbook.xlsx.writeBuffer());
      }
    } catch (error) {
      logger.error('Error exporting analytics:', error);
      throw error;
    }
  }
}
