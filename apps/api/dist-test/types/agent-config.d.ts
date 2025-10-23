import { z } from 'zod';
export interface AgentConfig {
    name: string;
    version: string;
    description: string;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    circuitBreaker?: {
        failureThreshold?: number;
        resetTimeout?: number;
    };
    metrics?: {
        enabled: boolean;
        interval: number;
    };
    health?: {
        enabled: boolean;
        interval: number;
        checks?: Array<{
            name: string;
            check: () => Promise<boolean>;
            timeout?: number;
        }>;
    };
}
export declare const AgentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    logLevel: z.ZodOptional<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    circuitBreaker: z.ZodOptional<z.ZodObject<{
        failureThreshold: z.ZodOptional<z.ZodNumber>;
        resetTimeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }>>;
    metrics: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
    }, {
        enabled: boolean;
        interval: number;
    }>>;
    health: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
        checks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            check: z.ZodAny;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    description: string;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
}, {
    name: string;
    version: string;
    description: string;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
}>;
export interface FeedAgentConfig extends AgentConfig {
    feedSources: string[];
    updateInterval: number;
    batchSize: number;
    retryConfig?: {
        maxRetries: number;
        backoffMs: number;
    };
}
export declare const FeedAgentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    logLevel: z.ZodOptional<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    circuitBreaker: z.ZodOptional<z.ZodObject<{
        failureThreshold: z.ZodOptional<z.ZodNumber>;
        resetTimeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }>>;
    metrics: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
    }, {
        enabled: boolean;
        interval: number;
    }>>;
    health: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
        checks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            check: z.ZodAny;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }>>;
} & {
    feedSources: z.ZodArray<z.ZodString, "many">;
    updateInterval: z.ZodNumber;
    batchSize: z.ZodNumber;
    retryConfig: z.ZodOptional<z.ZodObject<{
        maxRetries: z.ZodNumber;
        backoffMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        backoffMs: number;
    }, {
        maxRetries: number;
        backoffMs: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    description: string;
    batchSize: number;
    updateInterval: number;
    feedSources: string[];
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    retryConfig?: {
        maxRetries: number;
        backoffMs: number;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
}, {
    name: string;
    version: string;
    description: string;
    batchSize: number;
    updateInterval: number;
    feedSources: string[];
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    retryConfig?: {
        maxRetries: number;
        backoffMs: number;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
}>;
export interface AlertAgentConfig extends AgentConfig {
    alertTypes: string[];
    channels: {
        discord?: {
            webhookUrl: string;
            roleId?: string;
        };
        slack?: {
            webhookUrl: string;
            channel: string;
        };
        email?: {
            recipients: string[];
            from: string;
        };
    };
    throttling?: {
        maxAlerts: number;
        windowMs: number;
    };
}
export declare const AlertAgentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    logLevel: z.ZodOptional<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    circuitBreaker: z.ZodOptional<z.ZodObject<{
        failureThreshold: z.ZodOptional<z.ZodNumber>;
        resetTimeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }>>;
    metrics: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
    }, {
        enabled: boolean;
        interval: number;
    }>>;
    health: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
        checks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            check: z.ZodAny;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }>>;
} & {
    alertTypes: z.ZodArray<z.ZodString, "many">;
    channels: z.ZodObject<{
        discord: z.ZodOptional<z.ZodObject<{
            webhookUrl: z.ZodString;
            roleId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            webhookUrl: string;
            roleId?: string | undefined;
        }, {
            webhookUrl: string;
            roleId?: string | undefined;
        }>>;
        slack: z.ZodOptional<z.ZodObject<{
            webhookUrl: z.ZodString;
            channel: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            channel: string;
            webhookUrl: string;
        }, {
            channel: string;
            webhookUrl: string;
        }>>;
        email: z.ZodOptional<z.ZodObject<{
            recipients: z.ZodArray<z.ZodString, "many">;
            from: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            recipients: string[];
            from: string;
        }, {
            recipients: string[];
            from: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        discord?: {
            webhookUrl: string;
            roleId?: string | undefined;
        } | undefined;
        email?: {
            recipients: string[];
            from: string;
        } | undefined;
        slack?: {
            channel: string;
            webhookUrl: string;
        } | undefined;
    }, {
        discord?: {
            webhookUrl: string;
            roleId?: string | undefined;
        } | undefined;
        email?: {
            recipients: string[];
            from: string;
        } | undefined;
        slack?: {
            channel: string;
            webhookUrl: string;
        } | undefined;
    }>;
    throttling: z.ZodOptional<z.ZodObject<{
        maxAlerts: z.ZodNumber;
        windowMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        windowMs: number;
        maxAlerts: number;
    }, {
        windowMs: number;
        maxAlerts: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    description: string;
    channels: {
        discord?: {
            webhookUrl: string;
            roleId?: string | undefined;
        } | undefined;
        email?: {
            recipients: string[];
            from: string;
        } | undefined;
        slack?: {
            channel: string;
            webhookUrl: string;
        } | undefined;
    };
    alertTypes: string[];
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
    throttling?: {
        windowMs: number;
        maxAlerts: number;
    } | undefined;
}, {
    name: string;
    version: string;
    description: string;
    channels: {
        discord?: {
            webhookUrl: string;
            roleId?: string | undefined;
        } | undefined;
        email?: {
            recipients: string[];
            from: string;
        } | undefined;
        slack?: {
            channel: string;
            webhookUrl: string;
        } | undefined;
    };
    alertTypes: string[];
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
    throttling?: {
        windowMs: number;
        maxAlerts: number;
    } | undefined;
}>;
export interface ScoringAgentConfig extends AgentConfig {
    models: {
        name: string;
        version: string;
        path: string;
    }[];
    thresholds: {
        confidence: number;
        quality: number;
    };
    features: string[];
    validation?: {
        enabled: boolean;
        sampleSize: number;
    };
}
export declare const ScoringAgentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    logLevel: z.ZodOptional<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    circuitBreaker: z.ZodOptional<z.ZodObject<{
        failureThreshold: z.ZodOptional<z.ZodNumber>;
        resetTimeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }, {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    }>>;
    metrics: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
    }, {
        enabled: boolean;
        interval: number;
    }>>;
    health: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        interval: z.ZodNumber;
        checks: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            check: z.ZodAny;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }, {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }, {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    }>>;
} & {
    models: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        name: string;
        version: string;
    }, {
        path: string;
        name: string;
        version: string;
    }>, "many">;
    thresholds: z.ZodObject<{
        confidence: z.ZodNumber;
        quality: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        quality: number;
    }, {
        confidence: number;
        quality: number;
    }>;
    features: z.ZodArray<z.ZodString, "many">;
    validation: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        sampleSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        sampleSize: number;
    }, {
        enabled: boolean;
        sampleSize: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    description: string;
    features: string[];
    thresholds: {
        confidence: number;
        quality: number;
    };
    models: {
        path: string;
        name: string;
        version: string;
    }[];
    validation?: {
        enabled: boolean;
        sampleSize: number;
    } | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
}, {
    name: string;
    version: string;
    description: string;
    features: string[];
    thresholds: {
        confidence: number;
        quality: number;
    };
    models: {
        path: string;
        name: string;
        version: string;
    }[];
    validation?: {
        enabled: boolean;
        sampleSize: number;
    } | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    metrics?: {
        enabled: boolean;
        interval: number;
    } | undefined;
    health?: {
        enabled: boolean;
        interval: number;
        checks?: {
            name: string;
            timeout?: number | undefined;
            check?: any;
        }[] | undefined;
    } | undefined;
    circuitBreaker?: {
        failureThreshold?: number | undefined;
        resetTimeout?: number | undefined;
    } | undefined;
}>;
export declare function createAgentConfig(config: Partial<AgentConfig>): AgentConfig;
//# sourceMappingURL=agent-config.d.ts.map