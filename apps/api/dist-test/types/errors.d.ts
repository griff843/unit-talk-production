import { z } from 'zod';
export interface BaseError {
    message: string;
    code?: string;
    stack?: string;
    context?: Record<string, unknown>;
}
export declare class ValidationError extends Error implements BaseError {
    code: string;
    context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class DatabaseError extends Error implements BaseError {
    code: string;
    context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class AgentError extends Error implements BaseError {
    code: string;
    context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class WorkflowError extends Error implements BaseError {
    code: string;
    context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class ExternalServiceError extends Error implements BaseError {
    code: string;
    context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>);
}
export declare function handleError(error: unknown, _context?: string): BaseError;
export declare const errorSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
    stack: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    code?: string | undefined;
    context?: Record<string, unknown> | undefined;
    stack?: string | undefined;
}, {
    message: string;
    code?: string | undefined;
    context?: Record<string, unknown> | undefined;
    stack?: string | undefined;
}>;
export declare const validationErrorSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodLiteral<"VALIDATION_ERROR">;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: "VALIDATION_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}, {
    code: "VALIDATION_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}>;
export declare const databaseErrorSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodLiteral<"DATABASE_ERROR">;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: "DATABASE_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}, {
    code: "DATABASE_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}>;
export declare const agentErrorSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodLiteral<"AGENT_ERROR">;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: "AGENT_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}, {
    code: "AGENT_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}>;
export declare const workflowErrorSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodLiteral<"WORKFLOW_ERROR">;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: "WORKFLOW_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}, {
    code: "WORKFLOW_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}>;
export declare const externalServiceErrorSchema: z.ZodObject<{
    message: z.ZodString;
    code: z.ZodLiteral<"EXTERNAL_SERVICE_ERROR">;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: "EXTERNAL_SERVICE_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}, {
    code: "EXTERNAL_SERVICE_ERROR";
    message: string;
    context?: Record<string, unknown> | undefined;
}>;
export declare function isValidationError(error: unknown): error is ValidationError;
export declare function isDatabaseError(error: unknown): error is DatabaseError;
export declare function isAgentError(error: unknown): error is AgentError;
export declare function isWorkflowError(error: unknown): error is WorkflowError;
export declare function isExternalServiceError(error: unknown): error is ExternalServiceError;
//# sourceMappingURL=errors.d.ts.map