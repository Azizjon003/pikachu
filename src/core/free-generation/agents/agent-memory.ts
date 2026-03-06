/**
 * Agent Memory — Shared memory system for inter-agent communication.
 *
 * Allows agents to:
 * 1. Record their decisions, fixes, and warnings
 * 2. Read what other agents have done
 * 3. Query specific slides/elements for prior modifications
 * 4. Coordinate to avoid conflicting changes
 *
 * Memory is created once per pipeline run and passed to all agents.
 */

export interface MemoryEntry {
  /** Which agent wrote this entry */
  agent: string;
  /** What type of entry: decision, fix, warning, info */
  type: 'decision' | 'fix' | 'warning' | 'info';
  /** Which slide this relates to (-1 for global) */
  slideIndex: number;
  /** Which element this relates to (-1 for slide-level) */
  elementIndex: number;
  /** What happened */
  message: string;
  /** Structured data for machine reading */
  data?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

export interface SlideSnapshot {
  slideIndex: number;
  /** Agents that modified this slide */
  modifiedBy: string[];
  /** Total fixes applied to this slide */
  fixCount: number;
  /** Warnings about this slide */
  warnings: string[];
}

export class AgentMemory {
  private entries: MemoryEntry[] = [];
  private slideSnapshots: Map<number, SlideSnapshot> = new Map();
  private agentOrder: string[] = [];

  /**
   * Record a decision or action taken by an agent.
   */
  log(
    agent: string,
    type: MemoryEntry['type'],
    slideIndex: number,
    elementIndex: number,
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.entries.push({
      agent,
      type,
      slideIndex,
      elementIndex,
      message,
      data,
      timestamp: Date.now(),
    });

    // Track agent execution order
    if (!this.agentOrder.includes(agent)) {
      this.agentOrder.push(agent);
    }

    // Update slide snapshot
    if (slideIndex >= 0) {
      const snap = this.slideSnapshots.get(slideIndex) || {
        slideIndex,
        modifiedBy: [],
        fixCount: 0,
        warnings: [],
      };
      if (!snap.modifiedBy.includes(agent)) {
        snap.modifiedBy.push(agent);
      }
      if (type === 'fix') snap.fixCount++;
      if (type === 'warning') snap.warnings.push(`[${agent}] ${message}`);
      this.slideSnapshots.set(slideIndex, snap);
    }
  }

  // ===== Convenience logging methods =====

  /** Record a fix applied to a slide/element */
  logFix(agent: string, slideIndex: number, elementIndex: number, message: string, data?: Record<string, unknown>): void {
    this.log(agent, 'fix', slideIndex, elementIndex, message, data);
  }

  /** Record a decision (why agent chose to do/not do something) */
  logDecision(agent: string, slideIndex: number, message: string, data?: Record<string, unknown>): void {
    this.log(agent, 'decision', slideIndex, -1, message, data);
  }

  /** Record a warning for downstream agents */
  logWarning(agent: string, slideIndex: number, message: string, data?: Record<string, unknown>): void {
    this.log(agent, 'warning', slideIndex, -1, message, data);
  }

  /** Record general info */
  logInfo(agent: string, message: string, data?: Record<string, unknown>): void {
    this.log(agent, 'info', -1, -1, message, data);
  }

  // ===== Query methods =====

  /** Get all entries from a specific agent */
  getByAgent(agent: string): MemoryEntry[] {
    return this.entries.filter(e => e.agent === agent);
  }

  /** Get all entries for a specific slide */
  getBySlide(slideIndex: number): MemoryEntry[] {
    return this.entries.filter(e => e.slideIndex === slideIndex);
  }

  /** Get all entries for a specific element */
  getByElement(slideIndex: number, elementIndex: number): MemoryEntry[] {
    return this.entries.filter(e => e.slideIndex === slideIndex && e.elementIndex === elementIndex);
  }

  /** Get all warnings (useful for downstream agents to read) */
  getWarnings(): MemoryEntry[] {
    return this.entries.filter(e => e.type === 'warning');
  }

  /** Get all fixes applied so far */
  getFixes(): MemoryEntry[] {
    return this.entries.filter(e => e.type === 'fix');
  }

  /** Check if a specific slide was modified by any agent */
  wasSlideModified(slideIndex: number): boolean {
    return this.slideSnapshots.has(slideIndex);
  }

  /** Check if a specific element was already fixed by another agent */
  wasElementFixed(slideIndex: number, elementIndex: number, excludeAgent?: string): boolean {
    return this.entries.some(
      e => e.slideIndex === slideIndex && e.elementIndex === elementIndex && e.type === 'fix' && e.agent !== excludeAgent
    );
  }

  /** Get slide snapshot with modification history */
  getSlideSnapshot(slideIndex: number): SlideSnapshot | undefined {
    return this.slideSnapshots.get(slideIndex);
  }

  /** Get which agents modified a specific slide */
  getSlideModifiers(slideIndex: number): string[] {
    return this.slideSnapshots.get(slideIndex)?.modifiedBy || [];
  }

  /** Check if an agent has already run */
  hasAgentRun(agent: string): boolean {
    return this.agentOrder.includes(agent);
  }

  /** Get execution order of agents */
  getAgentOrder(): string[] {
    return [...this.agentOrder];
  }

  /** Get total number of fixes applied across all agents */
  getTotalFixes(): number {
    return this.entries.filter(e => e.type === 'fix').length;
  }

  /** Get summary for pipeline metadata */
  getSummary(): {
    totalEntries: number;
    totalFixes: number;
    totalWarnings: number;
    agentsRun: string[];
    slidesModified: number;
    heavilyModifiedSlides: number[];
  } {
    const fixes = this.entries.filter(e => e.type === 'fix').length;
    const warnings = this.entries.filter(e => e.type === 'warning').length;
    const heavilyModified: number[] = [];

    for (const [si, snap] of this.slideSnapshots) {
      if (snap.fixCount >= 5) heavilyModified.push(si);
    }

    return {
      totalEntries: this.entries.length,
      totalFixes: fixes,
      totalWarnings: warnings,
      agentsRun: [...this.agentOrder],
      slidesModified: this.slideSnapshots.size,
      heavilyModifiedSlides: heavilyModified,
    };
  }

  /** Get all entries (for debugging/logging) */
  getAllEntries(): MemoryEntry[] {
    return [...this.entries];
  }
}
