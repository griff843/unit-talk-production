import { ServerInstance, LoadBalancerConfig } from '../types/load-balancer';
export declare class MLPredictionLoadBalancer {
    private config;
    private instances;
    private healthChecks;
    private requestCounts;
    constructor(config: LoadBalancerConfig);
    routeRequest<T>(request: any, handler: (instance: ServerInstance, request: any) => Promise<T>): Promise<T>;
    addInstance(instance: ServerInstance): Promise<void>;
    removeInstance(instanceId: string): Promise<void>;
    private selectInstance;
    private selectRoundRobin;
    private selectLeastConnections;
    private selectWeighted;
    private selectAdaptive;
    private handleFailover;
    private updateMetrics;
}
//# sourceMappingURL=enhanced-load-balancer.d.ts.map