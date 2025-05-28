// /utils/logger.ts

export function logInfo(message: string, ...meta: any[]) {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...meta)
  }
  
  export function logWarn(message: string, ...meta: any[]) {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...meta)
  }
  
  export function logError(message: string, ...meta: any[]) {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...meta)
  }
  