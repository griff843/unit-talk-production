// Stub type declarations for @tensorflow/tfjs-node
// TODO: Install proper @types/tensorflow__tfjs-node package

declare module '@tensorflow/tfjs-node' {
  export interface Tensor {
    dispose(): void;
  }

  export interface Sequential {
    compile(config: any): void;
    fit(x: any, y: any, config: any): Promise<any>;
    predict(x: any): Tensor;
  }

  export function sequential(config?: any): Sequential;
  export function tensor(data: any, shape?: number[]): Tensor;
  export const train: any;
  export const losses: any;
  export const metrics: any;
}
