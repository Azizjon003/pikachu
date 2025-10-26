/**
 * Performance Monitor
 *
 * Lightweight performance tracking system for slide generation
 * Tracks timing, throughput, and bottlenecks
 */

import { performance } from 'perf_hooks';

interface TimingEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface PerformanceMetrics {
  totalDuration: number;
  stages: {
    name: string;
    duration: number;
    percentage: number;
  }[];
  throughput: {
    slidesPerSecond: number;
    totalSlides: number;
  };
  bottlenecks: string[];
}

export class PerformanceMonitor {
  private timings: Map<string, TimingEntry> = new Map();
  private completedTimings: TimingEntry[] = [];
  private startTime: number = 0;
  private totalSlides: number = 0;

  /**
   * Start monitoring
   */
  start(totalSlides: number): void {
    this.startTime = performance.now();
    this.totalSlides = totalSlides;
    this.timings.clear();
    this.completedTimings = [];
    console.log(`\n⏱️  Performance monitoring started for ${totalSlides} slides\n`);
  }

  /**
   * Start timing a stage
   */
  startStage(name: string, metadata?: Record<string, any>): void {
    this.timings.set(name, {
      name,
      startTime: performance.now(),
      metadata
    });
  }

  /**
   * End timing a stage
   */
  endStage(name: string): void {
    const entry = this.timings.get(name);
    if (!entry) {
      console.warn(`⚠️  No timing entry found for: ${name}`);
      return;
    }

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;

    this.completedTimings.push(entry);
    this.timings.delete(name);

    console.log(`   ✓ ${name}: ${entry.duration.toFixed(0)}ms`);
  }

  /**
   * Get metrics for current session
   */
  getMetrics(): PerformanceMetrics {
    const totalDuration = performance.now() - this.startTime;

    // Calculate stage breakdown
    const stages = this.completedTimings.map(entry => ({
      name: entry.name,
      duration: entry.duration || 0,
      percentage: ((entry.duration || 0) / totalDuration) * 100
    })).sort((a, b) => b.duration - a.duration);

    // Identify bottlenecks (stages taking >20% of total time)
    const bottlenecks = stages
      .filter(stage => stage.percentage > 20)
      .map(stage => `${stage.name} (${stage.percentage.toFixed(1)}%)`);

    // Calculate throughput
    const slidesPerSecond = this.totalSlides / (totalDuration / 1000);

    return {
      totalDuration,
      stages,
      throughput: {
        slidesPerSecond,
        totalSlides: this.totalSlides
      },
      bottlenecks
    };
  }

  /**
   * Print performance report
   */
  printReport(): void {
    const metrics = this.getMetrics();

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║              PERFORMANCE REPORT                          ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    console.log(`⏱️  Total Duration: ${(metrics.totalDuration / 1000).toFixed(1)}s`);
    console.log(`📊 Throughput: ${metrics.throughput.slidesPerSecond.toFixed(2)} slides/sec\n`);

    console.log("📈 Stage Breakdown:");
    metrics.stages.forEach((stage, idx) => {
      const bar = '█'.repeat(Math.floor(stage.percentage / 2));
      console.log(
        `   ${idx + 1}. ${stage.name.padEnd(30)} ${stage.duration.toFixed(0).padStart(6)}ms ${bar} ${stage.percentage.toFixed(1)}%`
      );
    });

    if (metrics.bottlenecks.length > 0) {
      console.log(`\n⚠️  Bottlenecks Detected:`);
      metrics.bottlenecks.forEach(bottleneck => {
        console.log(`   - ${bottleneck}`);
      });
    }

    console.log("");
  }

  /**
   * Quick timing function for ad-hoc measurements
   */
  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startStage(name);
    try {
      const result = await fn();
      this.endStage(name);
      return result;
    } catch (error) {
      this.endStage(name);
      throw error;
    }
  }
}

// Singleton instance for easy access
export const perfMonitor = new PerformanceMonitor();
