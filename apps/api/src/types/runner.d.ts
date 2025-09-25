declare var require: any;
declare var module: any;
declare var __dirname: string;
declare var process: any;

declare module 'dotenv' {
  const x: any;
  export default x;
}

declare module 'path' {
  const x: any;
  export default x;
}

declare module '../../../../packages/shared-utils/src/providers/cachedOddsApiClient' {
  export const CachedOddsApiClient: any;
  const _default: any;
  export default _default;
}

// Broad bypass for runner Option A; do not affect runtime behavior
declare module '*Professional*' {
  const content: any;
  export = content;
}

declare module '../services/ProfessionalPropProcessor' {
  export const professionalPropProcessor: any;
}

declare module '*/agents/FeedAgent/*' {
  const content: any;
  export = content;
}

