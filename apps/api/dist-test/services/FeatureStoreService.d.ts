export interface UpsertFeatureInput {
    entityType: string;
    entityId: string;
    featureName: string;
    asOf: string;
    value: unknown;
}
export interface FeatureQuery {
    entityType: string;
    entityId: string;
    featureNames: string[];
    asOf?: string;
}
export declare class FeatureStoreService {
    private logger;
    upsertFeature(input: UpsertFeatureInput): Promise<{
        success: boolean;
    }>;
    queryFeatures(params: FeatureQuery): Promise<Record<string, any>>;
}
//# sourceMappingURL=FeatureStoreService.d.ts.map