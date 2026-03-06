/**
 * Data Visualization Agent
 *
 * Enhances data-heavy slides with proper chart elements:
 * 1. Detects stat-numbers and generates supporting chart data
 * 2. Validates chart data consistency (labels match series)
 * 3. Suggests chart type based on data characteristics
 * 4. Ensures chart color themes match presentation theme
 */

import crypto from 'crypto';
import { AIClient } from '@/src/core/ai/ai-client';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import type { ColorTheme } from '../design-system';
import type { PPTChartElement, ChartType, ChartData } from '../../../../types/slides';

export interface DataVizResult {
  chartsGenerated: number;
  chartsFixed: number;
  slidesProcessed: number;
}

export class DataVisualizationAgent {
  private aiClient: AIClient;
  private theme: ColorTheme;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, theme: ColorTheme, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.theme = theme;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Process slides: fix existing charts and generate new ones for data slides
   */
  async process(
    slides: any[],
    topic: string,
    language: string,
    patterns: string[]
  ): Promise<DataVizResult> {
    let chartsGenerated = 0;
    let chartsFixed = 0;

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];

      // 1. Fix existing chart elements
      for (const el of slide.elements) {
        if (el.type !== 'chart') continue;

        // Validate chart data
        if (this.isChartDataInvalid(el)) {
          this.fixChartData(el);
          chartsFixed++;
        }

        // Ensure theme colors match
        el.themeColors = this.generateChartColors(el.data?.series?.length || 3);
        el.textColor = this.theme.text;
        el.lineColor = this.theme.muted + '40';
      }

      // 2. Generate chart for chart-pattern slides that lack chart elements
      const contentIdx = si - 2; // offset for title + outline
      const pattern = patterns[contentIdx];
      if (!pattern) continue;

      const isChartPattern = ['chart-bar', 'chart-pie', 'chart-line', 'chart-combo'].includes(pattern);
      const hasChart = slide.elements.some((el: any) => el.type === 'chart');

      if (isChartPattern && !hasChart) {
        const chartType = this.patternToChartType(pattern);
        const chartData = await this.generateChartData(slide, topic, language, chartType);

        if (chartData) {
          const chartElement = this.createChartElement(chartType, chartData);
          // Find a good position — replace the largest text body or append
          const bodyIdx = this.findBestChartPosition(slide);
          if (bodyIdx >= 0) {
            slide.elements[bodyIdx] = chartElement;
          } else {
            slide.elements.push(chartElement);
          }
          chartsGenerated++;
        }
      }
    }

    return {
      chartsGenerated,
      chartsFixed,
      slidesProcessed: slides.length,
    };
  }

  /**
   * Generate chart data using AI based on slide content
   */
  private async generateChartData(
    slide: any,
    topic: string,
    language: string,
    chartType: ChartType
  ): Promise<ChartData | null> {
    const slideTexts = slide.elements
      .filter((el: any) => el.type === 'text' && el.content)
      .map((el: any) => el.content.replace(/<[^>]+>/g, '').substring(0, 100))
      .join('\n');

    try {
      const result = await this.aiClient.call<{
        labels: string[];
        legends: string[];
        series: number[][];
      }>({
        operationName: 'chartDataGen',
        temperature: 0.6,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `Generate realistic chart data for a presentation slide. The chart type is "${chartType}".

RULES:
- labels: 3-6 category names (${language})
- legends: 1-3 series names (${language})
- series: array of number arrays matching [legends.length][labels.length]
- Use realistic, plausible numbers (not round numbers like 10,20,30)
- For pie charts: only 1 series, values should sum to ~100
- For bar/line: 1-2 series with meaningful differences
- Return JSON: { "labels": [...], "legends": [...], "series": [[...], ...] }`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"\nSlide content:\n${slideTexts}\n\nGenerate ${chartType} chart data.`,
          },
        ],
        fallback: () => null,
      });

      if (!result.data) return null;

      return {
        labels: result.data.labels,
        legends: result.data.legends,
        series: result.data.series,
      };
    } catch (error) {
      this.logger.warn('Chart data generation failed', { error });
      return null;
    }
  }

  /**
   * Create a chart PPT element
   */
  private createChartElement(chartType: ChartType, data: ChartData): PPTChartElement {
    return {
      type: 'chart',
      id: crypto.randomUUID(),
      left: 100,
      top: 200,
      width: 800,
      height: 500,
      rotate: 0,
      chartType,
      data,
      themeColors: this.generateChartColors(data.series.length),
      textColor: this.theme.text,
      lineColor: this.theme.muted + '40',
    };
  }

  /**
   * Generate harmonious chart colors from theme
   */
  private generateChartColors(seriesCount: number): string[] {
    const baseColors = [
      this.theme.primary,
      this.theme.accent,
      this.theme.primary + 'AA',
      this.theme.accent + 'AA',
      this.theme.muted,
      this.theme.text + '80',
    ];
    return baseColors.slice(0, Math.max(seriesCount, 2));
  }

  /**
   * Check if chart data is invalid or empty
   */
  private isChartDataInvalid(el: any): boolean {
    if (!el.data) return true;
    if (!el.data.labels || el.data.labels.length === 0) return true;
    if (!el.data.series || el.data.series.length === 0) return true;
    if (!el.data.legends || el.data.legends.length === 0) return true;

    // Check if series dimensions match labels
    for (const series of el.data.series) {
      if (!Array.isArray(series) || series.length !== el.data.labels.length) return true;
    }

    return false;
  }

  /**
   * Fix invalid chart data with defaults
   */
  private fixChartData(el: any): void {
    if (!el.data) {
      el.data = {
        labels: ['A', 'B', 'C', 'D'],
        legends: ['Series 1'],
        series: [[30, 45, 60, 35]],
      };
      return;
    }

    const labelCount = el.data.labels?.length || 4;
    if (!el.data.labels || el.data.labels.length === 0) {
      el.data.labels = Array.from({ length: labelCount }, (_, i) => `Item ${i + 1}`);
    }
    if (!el.data.legends || el.data.legends.length === 0) {
      el.data.legends = ['Series 1'];
    }
    if (!el.data.series || el.data.series.length === 0) {
      el.data.series = [Array.from({ length: labelCount }, () => Math.round(Math.random() * 80 + 20))];
    }

    // Fix mismatched dimensions
    for (let i = 0; i < el.data.series.length; i++) {
      if (el.data.series[i].length !== el.data.labels.length) {
        el.data.series[i] = Array.from({ length: el.data.labels.length }, () => Math.round(Math.random() * 80 + 20));
      }
    }
  }

  /**
   * Map pattern name to chart type
   */
  private patternToChartType(pattern: string): ChartType {
    switch (pattern) {
      case 'chart-bar': return 'bar';
      case 'chart-pie': return 'pie';
      case 'chart-line': return 'line';
      case 'chart-combo': return 'bar';
      default: return 'bar';
    }
  }

  /**
   * Find the best position to place a chart (replace large body text area)
   */
  private findBestChartPosition(slide: any): number {
    let bestIdx = -1;
    let bestArea = 0;

    for (let i = 0; i < slide.elements.length; i++) {
      const el = slide.elements[i];
      if (el.type !== 'text') continue;

      const fontSize = this.extractFontSize(el.content || '');
      // Look for body text (not title)
      if (fontSize >= 24) continue;

      const area = (el.width || 0) * (el.height || 0);
      if (area > bestArea) {
        bestArea = area;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }
}
