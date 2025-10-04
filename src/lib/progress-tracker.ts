/**
 * Progress Tracker
 * Event-driven progress tracking with visual feedback and history
 */

import { EventEmitter } from 'events';

export enum ProgressStage {
  INITIALIZING = 'initializing',
  ANALYZING = 'analyzing',
  GENERATING = 'generating',
  VALIDATING = 'validating',
  FINALIZING = 'finalizing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ProgressEvent {
  stage: ProgressStage;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface StageInfo {
  stage: ProgressStage;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export class ProgressTracker extends EventEmitter {
  private currentStage: ProgressStage = ProgressStage.INITIALIZING;
  private currentProgress: number = 0;
  private stages: Map<ProgressStage, StageInfo> = new Map();
  private history: ProgressEvent[] = [];
  private startTime: Date;
  private enableEmoji: boolean = true;

  constructor(enableEmoji: boolean = true) {
    super();
    this.startTime = new Date();
    this.enableEmoji = enableEmoji;
    this.initializeStages();
  }

  /**
   * Initialize all stages
   */
  private initializeStages(): void {
    const allStages = [
      ProgressStage.INITIALIZING,
      ProgressStage.ANALYZING,
      ProgressStage.GENERATING,
      ProgressStage.VALIDATING,
      ProgressStage.FINALIZING,
      ProgressStage.COMPLETED,
    ];

    allStages.forEach((stage) => {
      this.stages.set(stage, {
        stage,
        startTime: new Date(),
        status: 'pending',
      });
    });
  }

  /**
   * Get emoji for stage
   */
  private getStageEmoji(stage: ProgressStage): string {
    if (!this.enableEmoji) return '';

    const emojis: Record<ProgressStage, string> = {
      [ProgressStage.INITIALIZING]: '🚀',
      [ProgressStage.ANALYZING]: '🔍',
      [ProgressStage.GENERATING]: '✨',
      [ProgressStage.VALIDATING]: '✅',
      [ProgressStage.FINALIZING]: '🎯',
      [ProgressStage.COMPLETED]: '🎉',
      [ProgressStage.FAILED]: '❌',
    };

    return emojis[stage] || '📌';
  }

  /**
   * Get status symbol for stage
   */
  private getStatusSymbol(status: 'pending' | 'active' | 'completed' | 'failed'): string {
    const symbols = {
      pending: '⏳',
      active: '▶️',
      completed: '✓',
      failed: '✗',
    };

    return this.enableEmoji ? symbols[status] : status[0].toUpperCase();
  }

  /**
   * Update current stage
   */
  setStage(stage: ProgressStage, message?: string): void {
    // Complete previous stage
    const prevStageInfo = this.stages.get(this.currentStage);
    if (prevStageInfo && prevStageInfo.status === 'active') {
      prevStageInfo.endTime = new Date();
      prevStageInfo.duration = prevStageInfo.endTime.getTime() - prevStageInfo.startTime.getTime();
      prevStageInfo.status = 'completed';
    }

    // Start new stage
    this.currentStage = stage;
    const stageInfo = this.stages.get(stage);
    if (stageInfo) {
      stageInfo.startTime = new Date();
      stageInfo.status = 'active';
    }

    const event: ProgressEvent = {
      stage,
      progress: this.currentProgress,
      message: message || `Entering ${stage} stage`,
      timestamp: new Date(),
    };

    this.history.push(event);
    this.emit('stage-change', event);
    this.renderProgress(event);
  }

  /**
   * Update progress within current stage
   */
  updateProgress(progress: number, message?: string, metadata?: Record<string, any>): void {
    this.currentProgress = Math.max(0, Math.min(100, progress));

    const event: ProgressEvent = {
      stage: this.currentStage,
      progress: this.currentProgress,
      message: message || `Progress: ${this.currentProgress}%`,
      timestamp: new Date(),
      metadata,
    };

    this.history.push(event);
    this.emit('progress', event);
    this.renderProgress(event);
  }

  /**
   * Mark current operation as completed
   */
  complete(message?: string): void {
    this.currentProgress = 100;
    this.setStage(ProgressStage.COMPLETED, message || 'Operation completed successfully');

    const stageInfo = this.stages.get(ProgressStage.COMPLETED);
    if (stageInfo) {
      stageInfo.endTime = new Date();
      stageInfo.duration = stageInfo.endTime.getTime() - this.startTime.getTime();
      stageInfo.status = 'completed';
    }

    this.emit('complete', this.getSummary());
  }

  /**
   * Mark current operation as failed
   */
  fail(error: Error, message?: string): void {
    this.setStage(ProgressStage.FAILED, message || `Operation failed: ${error.message}`);

    const stageInfo = this.stages.get(this.currentStage);
    if (stageInfo) {
      stageInfo.status = 'failed';
      stageInfo.endTime = new Date();
      stageInfo.duration = stageInfo.endTime.getTime() - stageInfo.startTime.getTime();
    }

    this.emit('error', { error, message });
  }

  /**
   * Render progress bar
   */
  private renderProgress(event: ProgressEvent): void {
    const barLength = 30;
    const filledLength = Math.round((barLength * this.currentProgress) / 100);
    const emptyLength = barLength - filledLength;

    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    const percentage = `${this.currentProgress.toFixed(0)}%`.padStart(4);
    const emoji = this.getStageEmoji(event.stage);

    console.log(`${emoji} [${bar}] ${percentage} - ${event.message}`);
  }

  /**
   * Get current progress
   */
  getCurrentProgress(): number {
    return this.currentProgress;
  }

  /**
   * Get current stage
   */
  getCurrentStage(): ProgressStage {
    return this.currentStage;
  }

  /**
   * Get stage information
   */
  getStageInfo(stage: ProgressStage): StageInfo | undefined {
    return this.stages.get(stage);
  }

  /**
   * Get all stage information
   */
  getAllStages(): StageInfo[] {
    return Array.from(this.stages.values());
  }

  /**
   * Get progress history
   */
  getHistory(): ProgressEvent[] {
    return [...this.history];
  }

  /**
   * Get operation summary
   */
  getSummary(): {
    totalDuration: number;
    stages: StageInfo[];
    totalEvents: number;
    status: 'completed' | 'failed' | 'in-progress';
  } {
    const now = new Date();
    const totalDuration = now.getTime() - this.startTime.getTime();

    let status: 'completed' | 'failed' | 'in-progress' = 'in-progress';
    if (this.currentStage === ProgressStage.COMPLETED) {
      status = 'completed';
    } else if (this.currentStage === ProgressStage.FAILED) {
      status = 'failed';
    }

    return {
      totalDuration,
      stages: this.getAllStages(),
      totalEvents: this.history.length,
      status,
    };
  }

  /**
   * Print summary
   */
  printSummary(): void {
    const summary = this.getSummary();
    const emoji = this.enableEmoji ? '📊' : '';

    console.log(`\n${emoji} === Operation Summary ===`);
    console.log(`Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`Status: ${summary.status}`);
    console.log(`Total Events: ${summary.totalEvents}`);
    console.log('\nStage Breakdown:');

    summary.stages.forEach((stage) => {
      if (stage.status !== 'pending') {
        const symbol = this.getStatusSymbol(stage.status);
        const duration = stage.duration ? `${(stage.duration / 1000).toFixed(2)}s` : 'N/A';
        console.log(`  ${symbol} ${stage.stage.padEnd(15)} - ${duration}`);
      }
    });

    console.log('');
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.currentStage = ProgressStage.INITIALIZING;
    this.currentProgress = 0;
    this.startTime = new Date();
    this.history = [];
    this.initializeStages();
  }

  /**
   * Export progress data to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(
      {
        summary: this.getSummary(),
        history: this.history,
      },
      null,
      2
    );
  }
}
