import { NotionRecapEntry } from '../../types/picks';
/**
 * NotionSyncService - Syncs recap data to Notion database
 * Provides backup and searchable archive of all recaps
 */
export declare class NotionSyncService {
    private notion;
    private databaseId;
    constructor(token: string, databaseId: string);
    /**
     * Initialize and test Notion connection
     */
    initialize(): Promise<void>;
    /**
     * Test Notion database connection
     */
    testConnection(): Promise<void>;
    /**
     * Sync recap entry to Notion database
     */
    syncRecap(entry: NotionRecapEntry): Promise<string>;
    /**
     * Search recaps in Notion database
     */
    searchRecaps(period?: string, startDate?: string, endDate?: string): Promise<NotionRecapEntry[]>;
    /**
     * Get recap by ID from Notion
     */
    getRecapById(id: string): Promise<NotionRecapEntry | null>;
    /**
     * Update existing recap in Notion
     */
    updateRecap(id: string, updates: Partial<NotionRecapEntry>): Promise<void>;
    /**
     * Delete recap from Notion
     */
    deleteRecap(id: string): Promise<void>;
    /**
     * Map Notion page to RecapEntry
     */
    private mapNotionPageToRecapEntry;
    /**
     * Get database schema for validation
     */
    getDatabaseSchema(): Promise<any>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=notionSyncService.d.ts.map