export interface LoggerConfig {
  service: string
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'json' | 'text'
}

export class Logger {
  private config: LoggerConfig

  constructor(config: LoggerConfig) {
    this.config = config
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.level)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    
    if (this.config.format === 'json') {
      return JSON.stringify({
        timestamp,
        level,
        service: this.config.service,
        message,
        data
      })
    } else {
      const dataStr = data ? ` ${JSON.stringify(data)}` : ''
      return `[${timestamp}] ${level.toUpperCase()} ${this.config.service}: ${message}${dataStr}`
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data))
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data))
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data))
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, data))
    }
  }
} 