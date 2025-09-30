/**
 * Enhanced Logging System
 * Provides structured logging with levels, categories, and performance monitoring
 */

import eventSystem from '../core/EventSystem.js';
import configManager from '../core/ConfigManager.js';

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.logLevel = 'info';
    this.categories = new Map();
    this.startTime = Date.now();
    
    // Performance monitoring
    this.performanceMarks = new Map();
    this.performanceMetrics = new Map();
    
    // Error tracking
    this.errors = [];
    this.maxErrors = 100;
    
    // Log levels (higher number = more verbose)
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.setupGlobalErrorHandling();
    this.setupPerformanceMonitoring();
  }
  
  setupGlobalErrorHandling() {
    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('Unhandled Error', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
      });
    });
    
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    });
  }
  
  setupPerformanceMonitoring() {
    // Monitor frame rate
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsHistory = [];
    
    setInterval(() => {
      this.updateFPSMetrics();
    }, 1000);
  }
  
  updateFPSMetrics() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    const fps = this.frameCount / (deltaTime / 1000);
    
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) { // Keep last 60 seconds
      this.fpsHistory.shift();
    }
    
    this.performanceMetrics.set('fps', {
      current: fps,
      average: this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length,
      min: Math.min(...this.fpsHistory),
      max: Math.max(...this.fpsHistory)
    });
    
    this.frameCount = 0;
    this.lastFrameTime = currentTime;
  }
  
  /**
   * Log a message with specified level
   */
  log(level, category, message, data = null) {
    if (this.levels[level] > this.levels[this.logLevel]) {
      return; // Skip if below current log level
    }
    
    const timestamp = Date.now();
    const logEntry = {
      id: this.generateLogId(),
      timestamp,
      level,
      category,
      message,
      data,
      relativeTime: timestamp - this.startTime,
      stack: level === 'error' ? new Error().stack : null
    };
    
    // Add to logs array
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    const categoryLogs = this.categories.get(category);
    categoryLogs.push(logEntry);
    if (categoryLogs.length > 100) { // Limit per category
      categoryLogs.shift();
    }
    
    // Track errors separately
    if (level === 'error') {
      this.errors.push(logEntry);
      if (this.errors.length > this.maxErrors) {
        this.errors.shift();
      }
    }
    
    // Console output
    this.outputToConsole(logEntry);
    
    // Emit event
    eventSystem.emit('log:entry', logEntry);
  }
  
  /**
   * Convenience methods for different log levels
   */
  error(message, data = null, category = 'general') {
    this.log('error', category, message, data);
  }
  
  warn(message, data = null, category = 'general') {
    this.log('warn', category, message, data);
  }
  
  info(message, data = null, category = 'general') {
    this.log('info', category, message, data);
  }
  
  debug(message, data = null, category = 'general') {
    this.log('debug', category, message, data);
  }
  
  trace(message, data = null, category = 'general') {
    this.log('trace', category, message, data);
  }
  
  /**
   * Performance logging
   */
  startPerformanceMark(name) {
    this.performanceMarks.set(name, performance.now());
  }
  
  endPerformanceMark(name, logResult = true) {
    const startTime = this.performanceMarks.get(name);
    if (!startTime) {
      this.warn(`Performance mark '${name}' not found`, null, 'performance');
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.performanceMarks.delete(name);
    
    // Store metric
    if (!this.performanceMetrics.has(name)) {
      this.performanceMetrics.set(name, {
        calls: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0
      });
    }
    
    const metric = this.performanceMetrics.get(name);
    metric.calls++;
    metric.totalTime += duration;
    metric.averageTime = metric.totalTime / metric.calls;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    
    if (logResult) {
      this.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`, {
        duration,
        calls: metric.calls,
        average: metric.averageTime.toFixed(2)
      }, 'performance');
    }
    
    return duration;
  }
  
  /**
   * Time a function execution
   */
  time(name, fn) {
    this.startPerformanceMark(name);
    const result = fn();
    this.endPerformanceMark(name);
    return result;
  }
  
  /**
   * Time an async function execution
   */
  async timeAsync(name, fn) {
    this.startPerformanceMark(name);
    const result = await fn();
    this.endPerformanceMark(name);
    return result;
  }
  
  /**
   * Group related log entries
   */
  group(name, fn) {
    this.info(`--- ${name} START ---`, null, 'group');
    try {
      const result = fn();
      this.info(`--- ${name} END ---`, null, 'group');
      return result;
    } catch (error) {
      this.error(`--- ${name} ERROR ---`, error, 'group');
      throw error;
    }
  }
  
  /**
   * Memory usage logging
   */
  logMemoryUsage() {
    if (!performance.memory) {
      this.warn('Memory API not available', null, 'performance');
      return;
    }
    
    const memInfo = {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    };
    
    this.debug(`Memory usage: ${memInfo.used}MB / ${memInfo.total}MB (limit: ${memInfo.limit}MB)`, memInfo, 'performance');
    
    return memInfo;
  }
  
  /**
   * Entity count logging for debugging
   */
  logEntityCounts() {
    if (typeof entityManager === 'undefined') return;
    
    const stats = entityManager.getStats();
    this.debug('Entity counts', stats, 'entities');
    
    return stats;
  }
  
  /**
   * Game state logging
   */
  logGameState() {
    if (typeof stateManager === 'undefined') return;
    
    const state = stateManager.getState();
    this.debug('Game state snapshot', state, 'gamestate');
    
    return state;
  }
  
  /**
   * Output to console with formatting
   */
  outputToConsole(logEntry) {
    const { level, category, message, data, relativeTime } = logEntry;
    const timeStr = `[${(relativeTime / 1000).toFixed(3)}s]`;
    const categoryStr = `[${category}]`;
    
    let consoleMethod = console.log;
    let style = '';
    
    switch (level) {
      case 'error':
        consoleMethod = console.error;
        style = 'color: red; font-weight: bold;';
        break;
      case 'warn':
        consoleMethod = console.warn;
        style = 'color: orange; font-weight: bold;';
        break;
      case 'info':
        consoleMethod = console.info;
        style = 'color: blue;';
        break;
      case 'debug':
        consoleMethod = console.debug;
        style = 'color: gray;';
        break;
      case 'trace':
        consoleMethod = console.trace;
        style = 'color: purple;';
        break;
    }
    
    if (data) {
      consoleMethod(`%c${timeStr} ${categoryStr} ${message}`, style, data);
    } else {
      consoleMethod(`%c${timeStr} ${categoryStr} ${message}`, style);
    }
  }
  
  /**
   * Set log level
   */
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.logLevel = level;
      this.info(`Log level set to: ${level}`, null, 'logger');
    } else {
      this.warn(`Invalid log level: ${level}`, null, 'logger');
    }
  }
  
  /**
   * Get logs by level
   */
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }
  
  /**
   * Get logs by category
   */
  getLogsByCategory(category) {
    return this.categories.get(category) || [];
  }
  
  /**
   * Get recent logs
   */
  getRecentLogs(count = 50) {
    return this.logs.slice(-count);
  }
  
  /**
   * Get error summary
   */
  getErrorSummary() {
    const errorsByMessage = new Map();
    
    for (const error of this.errors) {
      const key = error.message;
      if (!errorsByMessage.has(key)) {
        errorsByMessage.set(key, { count: 0, lastOccurrence: 0, category: error.category });
      }
      
      const errorStats = errorsByMessage.get(key);
      errorStats.count++;
      errorStats.lastOccurrence = Math.max(errorStats.lastOccurrence, error.timestamp);
    }
    
    return Array.from(errorsByMessage.entries()).map(([message, stats]) => ({
      message,
      ...stats
    })).sort((a, b) => b.lastOccurrence - a.lastOccurrence);
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const metrics = {};
    
    for (const [name, metric] of this.performanceMetrics.entries()) {
      metrics[name] = { ...metric };
    }
    
    return metrics;
  }
  
  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
    this.errors = [];
    this.categories.clear();
    this.performanceMetrics.clear();
    this.info('Logs cleared', null, 'logger');
  }
  
  /**
   * Export logs for debugging
   */
  exportLogs(format = 'json') {
    const exportData = {
      logs: this.logs,
      errors: this.errors,
      performanceMetrics: this.getPerformanceMetrics(),
      summary: {
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        categories: Array.from(this.categories.keys()),
        timespan: {
          start: this.startTime,
          end: Date.now(),
          duration: Date.now() - this.startTime
        }
      }
    };
    
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.logsToCSV(this.logs);
    }
    
    return exportData;
  }
  
  /**
   * Convert logs to CSV format
   */
  logsToCSV(logs) {
    const headers = ['timestamp', 'level', 'category', 'message', 'data'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.level,
      log.category,
      log.message.replace(/"/g, '""'), // Escape quotes
      log.data ? JSON.stringify(log.data).replace(/"/g, '""') : ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }
  
  /**
   * Generate unique log ID
   */
  generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Frame update (call this every frame for FPS tracking)
   */
  frameUpdate() {
    this.frameCount++;
  }
  
  /**
   * Get logger statistics
   */
  getStats() {
    return {
      totalLogs: this.logs.length,
      totalErrors: this.errors.length,
      categories: this.categories.size,
      logLevel: this.logLevel,
      uptime: Date.now() - this.startTime,
      performanceMetrics: this.performanceMetrics.size
    };
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;