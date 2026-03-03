import { ActivityResult, FeedIngestionResult } from '../shared/activity-results';

export interface FeedAgentActivities {
  fetchFeed(params: {
    source: string;
    batchSize?: number;
    filters?: Record<string, unknown>;
  }): Promise<FeedIngestionResult>;

  processFeed(params: {
    feedId: string;
    transformations: string[];
    options?: Record<string, unknown>;
  }): Promise<
    ActivityResult<{
      itemsProcessed: number;
      duration: number;
      timestamp: string;
    }>
  >;

  monitorFeeds(params: { sources: string[]; interval?: number }): Promise<
    ActivityResult<{
      activeSources: number;
      totalItems: number;
      timestamp: string;
    }>
  >;
}
