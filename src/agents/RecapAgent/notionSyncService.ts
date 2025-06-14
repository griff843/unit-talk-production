/* import { Client } from '@notionhq/client'; */
// Notion client is optional - install @notionhq/client if needed
interface Client {
  databases: any;
  pages: any;
}
import { NotionRecapEntry, RecapError } from '../../types/picks';

/**
 * NotionSyncService - Syncs recap data to Notion database
 * Provides backup and searchable archive of all recaps
 */
export class NotionSyncService {
  private notion: Client;
  private databaseId: string;

  constructor(token: string, databaseId: string) {
    this.notion = new Client({ auth: token });
    this.databaseId = databaseId;
  }

  /**
   * Initialize and test Notion connection
   */
  async initialize(): Promise<void> {
    try {
      await this.testConnection();
      console.log('NotionSyncService initialized successfully');
    } catch (error) {
      throw new RecapError({
        code: 'NOTION_INIT_FAILED',
        message: `Failed to initialize Notion sync: ${error}`,
        timestamp: new Date().toISOString(),
        severity: 'high'
      });
    }
  }

  /**
   * Test Notion database connection
   */
  async testConnection(): Promise<void> {
    try {
      await this.notion.databases.retrieve({ database_id: this.databaseId });
    } catch (error) {
      throw new Error(`Notion connection failed: ${error}`);
    }
  }

  /**
   * Sync recap entry to Notion database
   */
  async syncRecap(entry: NotionRecapEntry): Promise<string> {
    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          'Title': {
            title: [
              {
                text: {
                  content: entry.title
                }
              }
            ]
          },
          'Date': {
            date: {
              start: entry.date
            }
          },
          'Period': {
            select: {
              name: entry.period
            }
          },
          'Net Units': {
            number: entry.summary.netUnits
          },
          'ROI': {
            number: entry.summary.roi
          },
          'Win Rate': {
            number: entry.summary.winRate
          },
          'Total Picks': {
            number: entry.summary.totalPicks
          },
          'Created At': {
            date: {
              start: entry.createdAt
            }
          }
        },
        children: [
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Recap Summary'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: `Period: ${entry.period}\nTotal Picks: ${entry.summary.totalPicks}\nRecord: ${entry.summary.wins}W-${entry.summary.losses}L\nNet Units: ${entry.summary.netUnits.toFixed(1)}U\nROI: ${entry.summary.roi.toFixed(1)}%\nWin Rate: ${entry.summary.winRate.toFixed(1)}%`
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: 'Capper Breakdown'
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: entry.summary.capperBreakdown.map(capper => 
                      `${capper.capper}: ${capper.wins}W-${capper.losses}L, ${capper.netUnits.toFixed(1)}U, ${capper.roi.toFixed(1)}% ROI`
                    ).join('\n')
                  }
                }
              ]
            }
          },
          {
            object: 'block',
            type: 'code',
            code: {
              language: 'json',
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: JSON.stringify(entry.embedData, null, 2)
                  }
                }
              ]
            }
          }
        ]
      });

      return response.id;
    } catch (error) {
      throw new RecapError({
        code: 'NOTION_SYNC_FAILED',
        message: `Failed to sync recap to Notion: ${error}`,
        timestamp: new Date().toISOString(),
        context: { entryTitle: entry.title },
        severity: 'medium'
      });
    }
  }

  /**
   * Search recaps in Notion database
   */
  async searchRecaps(period?: string, startDate?: string, endDate?: string): Promise<NotionRecapEntry[]> {
    try {
      const filter: any = {};
      
      if (period) {
        filter.and = filter.and || [];
        filter.and.push({
          property: 'Period',
          select: {
            equals: period
          }
        });
      }

      if (startDate) {
        filter.and = filter.and || [];
        filter.and.push({
          property: 'Date',
          date: {
            on_or_after: startDate
          }
        });
      }

      if (endDate) {
        filter.and = filter.and || [];
        filter.and.push({
          property: 'Date',
          date: {
            on_or_before: endDate
          }
        });
      }

      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        sorts: [
          {
            property: 'Date',
            direction: 'descending'
          }
        ]
      });

      return response.results.map(this.mapNotionPageToRecapEntry);
    } catch (error) {
      throw new RecapError({
        code: 'NOTION_SEARCH_FAILED',
        message: `Failed to search Notion recaps: ${error}`,
        timestamp: new Date().toISOString(),
        context: { period, startDate, endDate },
        severity: 'low'
      });
    }
  }

  /**
   * Get recap by ID from Notion
   */
  async getRecapById(id: string): Promise<NotionRecapEntry | null> {
    try {
      const response = await this.notion.pages.retrieve({ page_id: id });
      return this.mapNotionPageToRecapEntry(response);
    } catch (error) {
      console.error('Failed to get recap by ID:', error);
      return null;
    }
  }

  /**
   * Update existing recap in Notion
   */
  async updateRecap(id: string, updates: Partial<NotionRecapEntry>): Promise<void> {
    try {
      const properties: any = {};

      if (updates.title) {
        properties['Title'] = {
          title: [{ text: { content: updates.title } }]
        };
      }

      if (updates.summary) {
        if (updates.summary.netUnits !== undefined) {
          properties['Net Units'] = { number: updates.summary.netUnits };
        }
        if (updates.summary.roi !== undefined) {
          properties['ROI'] = { number: updates.summary.roi };
        }
        if (updates.summary.winRate !== undefined) {
          properties['Win Rate'] = { number: updates.summary.winRate };
        }
      }

      await this.notion.pages.update({
        page_id: id,
        properties
      });
    } catch (error) {
      throw new RecapError({
        code: 'NOTION_UPDATE_FAILED',
        message: `Failed to update Notion recap: ${error}`,
        timestamp: new Date().toISOString(),
        context: { id },
        severity: 'medium'
      });
    }
  }

  /**
   * Delete recap from Notion
   */
  async deleteRecap(id: string): Promise<void> {
    try {
      await this.notion.pages.update({
        page_id: id,
        archived: true
      });
    } catch (error) {
      throw new RecapError({
        code: 'NOTION_DELETE_FAILED',
        message: `Failed to delete Notion recap: ${error}`,
        timestamp: new Date().toISOString(),
        context: { id },
        severity: 'medium'
      });
    }
  }

  /**
   * Map Notion page to RecapEntry
   */
  private mapNotionPageToRecapEntry(page: any): NotionRecapEntry {
    const properties = page.properties;
    
    return {
      id: page.id,
      title: properties.Title?.title?.[0]?.text?.content || '',
      date: properties.Date?.date?.start || '',
      period: properties.Period?.select?.name as 'daily' | 'weekly' | 'monthly' || 'daily',
      summary: {
        date: properties.Date?.date?.start || '',
        period: properties.Period?.select?.name as 'daily' | 'weekly' | 'monthly' || 'daily',
        totalPicks: properties['Total Picks']?.number || 0,
        wins: 0, // Would need to be stored separately or calculated
        losses: 0,
        pushes: 0,
        winRate: properties['Win Rate']?.number || 0,
        totalUnits: 0,
        netUnits: properties['Net Units']?.number || 0,
        roi: properties.ROI?.number || 0,
        avgEdge: 0,
        capperBreakdown: [],
        tierBreakdown: [],
        hotStreaks: []
      },
      embedData: {}, // Would need to be extracted from page content
      createdAt: properties['Created At']?.date?.start || page.created_time,
      updatedAt: page.last_edited_time
    };
  }

  /**
   * Get database schema for validation
   */
  async getDatabaseSchema(): Promise<any> {
    try {
      const response = await this.notion.databases.retrieve({ 
        database_id: this.databaseId 
      });
      return response.properties;
    } catch (error) {
      throw new RecapError({
        code: 'NOTION_SCHEMA_FAILED',
        message: `Failed to get database schema: ${error}`,
        timestamp: new Date().toISOString(),
        severity: 'low'
      });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Notion client doesn't require explicit cleanup
    console.log('NotionSyncService cleanup completed');
  }
}