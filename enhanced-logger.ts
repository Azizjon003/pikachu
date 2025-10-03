/**
 * Enhanced Logger System
 * Provides structured logging with levels, colors, metadata, and export functionality
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  stack?: string;
}

export class EnhancedLogger {
  private logHistory: LogEntry[] = [];
  private currentLevel: LogLevel = LogLevel.INFO;
  private enableColors: boolean = true;

  // ANSI color codes
  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  };

  constructor(level: LogLevel = LogLevel.INFO, enableColors: boolean = true) {
    this.currentLevel = level;
    this.enableColors = enableColors;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Format timestamp to readable string
   */
  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * Get color for log level
   */
  private getLevelColor(level: LogLevel): string {
    if (!this.enableColors) return '';

    switch (level) {
      case LogLevel.DEBUG:
        return this.colors.cyan;
      case LogLevel.INFO:
        return this.colors.green;
      case LogLevel.WARN:
        return this.colors.yellow;
      case LogLevel.ERROR:
        return this.colors.red;
      default:
        return this.colors.white;
    }
  }

  /**
   * Get level name string
   */
  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO ';
      case LogLevel.WARN:
        return 'WARN ';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Core logging function
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): void {
    if (level < this.currentLevel) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata,
      stack: error?.stack,
    };

    this.logHistory.push(entry);

    // Format console output
    const color = this.getLevelColor(level);
    const reset = this.enableColors ? this.colors.reset : '';
    const levelName = this.getLevelName(level);
    const timestamp = this.formatTimestamp(entry.timestamp);

    let output = `${color}[${timestamp}] [${levelName}]${reset} ${message}`;

    if (metadata && Object.keys(metadata).length > 0) {
      output += `\n  ${this.colors.dim}Metadata: ${JSON.stringify(metadata, null, 2)}${reset}`;
    }

    if (error?.stack) {
      output += `\n  ${this.colors.red}Stack: ${error.stack}${reset}`;
    }

    console.log(output);
  }

  /**
   * Debug level logging
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Info level logging
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Warning level logging
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  /**
   * Get all log history
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logHistory.filter((entry) => entry.level === level);
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Export logs to JSON format
   */
  exportToJSON(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  /**
   * Export logs to text format
   */
  exportToText(): string {
    return this.logHistory
      .map((entry) => {
        const timestamp = this.formatTimestamp(entry.timestamp);
        const levelName = this.getLevelName(entry.level);
        let line = `[${timestamp}] [${levelName}] ${entry.message}`;

        if (entry.metadata) {
          line += `\n  Metadata: ${JSON.stringify(entry.metadata)}`;
        }

        if (entry.stack) {
          line += `\n  Stack: ${entry.stack}`;
        }

        return line;
      })
      .join('\n\n');
  }

  /**
   * Get log statistics
   */
  getStats(): Record<string, number> {
    const stats = {
      total: this.logHistory.length,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    this.logHistory.forEach((entry) => {
      switch (entry.level) {
        case LogLevel.DEBUG:
          stats.debug++;
          break;
        case LogLevel.INFO:
          stats.info++;
          break;
        case LogLevel.WARN:
          stats.warn++;
          break;
        case LogLevel.ERROR:
          stats.error++;
          break;
      }
    });

    return stats;
  }
}

// Export a default logger instance
export const logger = new EnhancedLogger();
