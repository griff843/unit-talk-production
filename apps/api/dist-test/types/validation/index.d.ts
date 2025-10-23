import { z } from 'zod';
import { ValidationError, DatabaseError } from '../../utils/errorHandling';
export { ValidationError, DatabaseError };
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: string[];
}
export declare function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown, context?: string): Promise<T>;
export declare const DatabaseModelSchema: z.ZodObject<{
    id: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    id: string;
    updated_at?: string | undefined;
}, {
    created_at: string;
    id: string;
    updated_at?: string | undefined;
}>;
export declare function validateModel<T>(schema: z.ZodSchema<T>, data: unknown): T;
export declare function validateDatabaseModel<T>(schema: z.ZodSchema<T>, data: unknown): T;
export declare const BaseConfigSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    version: z.ZodString;
    environment: z.ZodEnum<["development", "staging", "production"]>;
    logLevel: z.ZodEnum<["debug", "info", "warn", "error"]>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    version: string;
    logLevel: "error" | "warn" | "info" | "debug";
    environment: "development" | "production" | "staging";
}, {
    enabled: boolean;
    version: string;
    logLevel: "error" | "warn" | "info" | "debug";
    environment: "development" | "production" | "staging";
}>;
export declare function validateConfig<T>(schema: z.ZodSchema<T>, config: unknown): T;
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
}, {
    limit?: number | undefined;
    page?: number | undefined;
}>;
export declare const ApiErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    details?: Record<string, unknown> | undefined;
}, {
    code: string;
    message: string;
    details?: Record<string, unknown> | undefined;
}>;
export declare const BaseEventSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    source: z.ZodString;
    timestamp: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    id: string;
    source: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    type: string;
    data: Record<string, unknown>;
    timestamp: string;
    id: string;
    source: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const MetricSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodNumber;
    labels: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: number;
    timestamp: string;
    name: string;
    labels?: Record<string, string> | undefined;
}, {
    value: number;
    timestamp: string;
    name: string;
    labels?: Record<string, string> | undefined;
}>;
export declare const AlertSchema: z.ZodObject<{
    severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
    message: z.ZodString;
    source: z.ZodString;
    timestamp: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    channels: z.ZodArray<z.ZodEnum<["email", "slack", "discord", "pagerduty"]>, "many">;
}, "strip", z.ZodTypeAny, {
    message: string;
    timestamp: string;
    severity: "error" | "info" | "warning" | "critical";
    source: string;
    channels: ("discord" | "email" | "slack" | "pagerduty")[];
    metadata?: Record<string, unknown> | undefined;
}, {
    message: string;
    timestamp: string;
    severity: "error" | "info" | "warning" | "critical";
    source: string;
    channels: ("discord" | "email" | "slack" | "pagerduty")[];
    metadata?: Record<string, unknown> | undefined;
}>;
//# sourceMappingURL=index.d.ts.map