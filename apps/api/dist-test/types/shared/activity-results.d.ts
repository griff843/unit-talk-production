import { z } from 'zod';
export interface ActivityResult<T = any> {
    success: boolean;
    data?: T;
    error?: Error;
    timestamp?: string;
    duration?: number;
}
export interface HealthCheckResult extends ActivityResult<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    healthScore: number;
    components: Array<{
        name: string;
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
    }>;
    timestamp: string;
}> {
}
export interface ApiQuotaResult extends ActivityResult<{
    provider: string;
    remainingQuota: number;
    resetTime: string;
    status: 'healthy' | 'warning' | 'critical';
}> {
}
export interface MaintenanceResult extends ActivityResult<{
    operation: string;
    itemsProcessed: number;
    duration: number;
    timestamp: string;
}> {
}
export interface PlayerEnrichmentResult extends ActivityResult<{
    playerId: string;
    enrichedFields: string[];
    timestamp: string;
}> {
}
export interface HeadshotResult extends ActivityResult<{
    playerId: string;
    url: string;
    timestamp: string;
}> {
}
export interface FeedIngestionResult extends ActivityResult<{
    feedId: string;
    itemsIngested: number;
    newItems: number;
    updatedItems: number;
    timestamp: string;
}> {
}
export interface GradingResult extends ActivityResult<{
    propId: string;
    grade: string;
    confidence: number;
    features: Record<string, number>;
    timestamp: string;
}> {
}
export interface AlertResult extends ActivityResult<{
    alertId: string;
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    channels: string[];
    timestamp: string;
}> {
}
export declare const HealthCheckResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
        healthScore: z.ZodNumber;
        components: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
            message: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "healthy" | "unhealthy" | "degraded";
            name: string;
            message?: string | undefined;
        }, {
            status: "healthy" | "unhealthy" | "degraded";
            name: string;
            message?: string | undefined;
        }>, "many">;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        components: {
            status: "healthy" | "unhealthy" | "degraded";
            name: string;
            message?: string | undefined;
        }[];
        healthScore: number;
    }, {
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        components: {
            status: "healthy" | "unhealthy" | "degraded";
            name: string;
            message?: string | undefined;
        }[];
        healthScore: number;
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        components: {
            status: "healthy" | "unhealthy" | "degraded";
            name: string;
            message?: string | undefined;
        }[];
        healthScore: number;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        status: "healthy" | "unhealthy" | "degraded";
        timestamp: string;
        components: {
            status: "healthy" | "unhealthy" | "degraded";
            name: string;
            message?: string | undefined;
        }[];
        healthScore: number;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
export declare const ApiQuotaResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        provider: z.ZodString;
        remainingQuota: z.ZodNumber;
        resetTime: z.ZodString;
        status: z.ZodEnum<["healthy", "warning", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        status: "warning" | "healthy" | "critical";
        provider: string;
        remainingQuota: number;
        resetTime: string;
    }, {
        status: "warning" | "healthy" | "critical";
        provider: string;
        remainingQuota: number;
        resetTime: string;
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        status: "warning" | "healthy" | "critical";
        provider: string;
        remainingQuota: number;
        resetTime: string;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        status: "warning" | "healthy" | "critical";
        provider: string;
        remainingQuota: number;
        resetTime: string;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
export declare const MaintenanceResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        operation: z.ZodString;
        itemsProcessed: z.ZodNumber;
        duration: z.ZodNumber;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        duration: number;
        operation: string;
        itemsProcessed: number;
    }, {
        timestamp: string;
        duration: number;
        operation: string;
        itemsProcessed: number;
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        duration: number;
        operation: string;
        itemsProcessed: number;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        timestamp: string;
        duration: number;
        operation: string;
        itemsProcessed: number;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
export declare const PlayerEnrichmentResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        playerId: z.ZodString;
        enrichedFields: z.ZodArray<z.ZodString, "many">;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        playerId: string;
        enrichedFields: string[];
    }, {
        timestamp: string;
        playerId: string;
        enrichedFields: string[];
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        playerId: string;
        enrichedFields: string[];
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        timestamp: string;
        playerId: string;
        enrichedFields: string[];
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
export declare const HeadshotResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        playerId: z.ZodString;
        url: z.ZodString;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        url: string;
        playerId: string;
    }, {
        timestamp: string;
        url: string;
        playerId: string;
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        url: string;
        playerId: string;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        timestamp: string;
        url: string;
        playerId: string;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
export declare const FeedIngestionResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        feedId: z.ZodString;
        itemsIngested: z.ZodNumber;
        newItems: z.ZodNumber;
        updatedItems: z.ZodNumber;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        feedId: string;
        itemsIngested: number;
        newItems: number;
        updatedItems: number;
    }, {
        timestamp: string;
        feedId: string;
        itemsIngested: number;
        newItems: number;
        updatedItems: number;
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        feedId: string;
        itemsIngested: number;
        newItems: number;
        updatedItems: number;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        timestamp: string;
        feedId: string;
        itemsIngested: number;
        newItems: number;
        updatedItems: number;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
export declare const GradingResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        propId: z.ZodString;
        grade: z.ZodString;
        confidence: z.ZodNumber;
        features: z.ZodRecord<z.ZodString, z.ZodNumber>;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        propId: string;
        confidence: number;
        grade: string;
        features: Record<string, number>;
    }, {
        timestamp: string;
        propId: string;
        confidence: number;
        grade: string;
        features: Record<string, number>;
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        timestamp: string;
        propId: string;
        confidence: number;
        grade: string;
        features: Record<string, number>;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        timestamp: string;
        propId: string;
        confidence: number;
        grade: string;
        features: Record<string, number>;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
export declare const AlertResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodObject<{
        alertId: z.ZodString;
        type: z.ZodString;
        severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
        channels: z.ZodArray<z.ZodString, "many">;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        timestamp: string;
        severity: "error" | "info" | "warning" | "critical";
        channels: string[];
        alertId: string;
    }, {
        type: string;
        timestamp: string;
        severity: "error" | "info" | "warning" | "critical";
        channels: string[];
        alertId: string;
    }>;
    error: z.ZodOptional<z.ZodType<Error, z.ZodTypeDef, Error>>;
    timestamp: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    data: {
        type: string;
        timestamp: string;
        severity: "error" | "info" | "warning" | "critical";
        channels: string[];
        alertId: string;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}, {
    data: {
        type: string;
        timestamp: string;
        severity: "error" | "info" | "warning" | "critical";
        channels: string[];
        alertId: string;
    };
    success: boolean;
    error?: Error | undefined;
    timestamp?: string | undefined;
    duration?: number | undefined;
}>;
//# sourceMappingURL=activity-results.d.ts.map