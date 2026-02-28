import * as XLSX from 'xlsx';

import { logger } from '../utils/logger';

import { SupabaseService } from './supabase';

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

      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new();

      // Picks sheet
      const picksData = picks.map((pick: any) => ({
        Date: new Date(pick.created_at).toLocaleDateString(),
        Sport: pick.sport,
        'Pick Type': pick.pick_type,
        Team: pick.team_name,
        Odds: pick.odds,
        Units: pick.units,
        Confidence: pick.confidence,
        Status: pick.status,
        'Profit/Loss': pick.profit_loss || 0,
        Notes: pick.notes || '',
      }));
      const picksSheet = XLSX.utils.json_to_sheet(picksData);
      XLSX.utils.book_append_sheet(workbook, picksSheet, 'Picks');

      // Analytics sheet
      const analyticsData = [
        {
          'Total Picks': analytics?.total_picks || 0,
          'Win Rate': `${(analytics?.win_rate || 0).toFixed(1)}%`,
          ROI: `${(analytics?.roi || 0).toFixed(1)}%`,
          'Total Units Risked': analytics?.total_units_risked || 0,
          'Total Units Won': analytics?.total_units_won || 0,
          'Total Units Lost': analytics?.total_units_lost || 0,
          'Average Odds': analytics?.average_odds || 0,
        },
      ];
      const analyticsSheet = XLSX.utils.json_to_sheet(analyticsData);
      XLSX.utils.book_append_sheet(workbook, analyticsSheet, 'Analytics');

      // Trends sheet
      const trendsData = [
        {
          'Best Sport': trends?.bestSport || 'N/A',
          'Worst Sport': trends?.worstSport || 'N/A',
          'Favorite Pick Type': trends?.favoritePickType || 'N/A',
          'Units per Play': trends?.unitsPerPlay || 0,
          'Win Rate': `${(trends?.winRate || 0).toFixed(1)}%`,
          ROI: `${(trends?.roi || 0).toFixed(1)}%`,
        },
      ];
      const trendsSheet = XLSX.utils.json_to_sheet(trendsData);
      XLSX.utils.book_append_sheet(workbook, trendsSheet, 'Trends');

      // Convert to buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return excelBuffer;
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
        const workbook = XLSX.utils.book_new();

        const data = [
          {
            'Total Picks': analytics?.total_picks || 0,
            'Win Rate': `${(analytics?.win_rate || 0).toFixed(1)}%`,
            ROI: `${(analytics?.roi || 0).toFixed(1)}%`,
            'Total Units Risked': analytics?.total_units_risked || 0,
            'Total Units Won': analytics?.total_units_won || 0,
            'Total Units Lost': analytics?.total_units_lost || 0,
            'Average Odds': analytics?.average_odds || 0,
            'Best Sport': trends?.bestSport || 'N/A',
            'Worst Sport': trends?.worstSport || 'N/A',
            'Favorite Pick Type': trends?.favoritePickType || 'N/A',
            'Units per Play': trends?.unitsPerPlay || 0,
          },
        ];

        const sheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Analytics');

        return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      }
    } catch (error) {
      logger.error('Error exporting analytics:', error);
      throw error;
    }
  }
}
