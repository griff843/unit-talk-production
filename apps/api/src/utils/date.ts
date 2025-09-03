// /utils/date.ts

export function toISO(date?: Date) {
    return (date || new Date()).toISOString()
  }
  
  export function fromISO(str: string) {
    return new Date(str)
  }
  