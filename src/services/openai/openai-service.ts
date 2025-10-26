/**
 * Centralized OpenAI Service
 *
 * Single point of management for all OpenAI API interactions
 * Supports both OpenAI and Azure OpenAI configurations
 *
 * Features:
 * - Singleton pattern for consistent configuration
 * - Support for both OpenAI and Azure OpenAI
 * - Automatic retry logic with exponential backoff
 * - Request/response logging
 * - Error handling and reporting
 * - Usage tracking
 */

import OpenAI from "openai";
import { AzureOpenAI } from "openai";
import * as dotenv from "dotenv";

dotenv.config();

export type OpenAIProvider = "openai" | "azure";

export interface OpenAIServiceConfig {
  provider: OpenAIProvider;
  apiKey: string;
  azureEndpoint?: string;
  azureApiVersion?: string;
  azureDeployment?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeout?: number;
  enableLogging?: boolean;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" | "text" };
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export class OpenAIService {
  private static instance: OpenAIService;
  private client: OpenAI | AzureOpenAI;
  private config: OpenAIServiceConfig;
  private usageStats = {
    totalRequests: 0,
    totalTokens: 0,
    totalErrors: 0,
  };

  private constructor(config: OpenAIServiceConfig) {
    this.config = config;
    this.client = this.initializeClient();

    if (this.config.enableLogging) {
      console.log(
        `[OpenAI Service] Initialized with ${this.config.provider} provider`
      );
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: OpenAIServiceConfig): OpenAIService {
    if (!OpenAIService.instance) {
      if (!config) {
        config = OpenAIService.getDefaultConfig();
      }
      OpenAIService.instance = new OpenAIService(config);
    }
    return OpenAIService.instance;
  }

  /**
   * Reset instance (useful for testing or reconfiguration)
   */
  public static resetInstance(): void {
    OpenAIService.instance = null as any;
  }

  /**
   * Get default configuration from environment variables
   */
  private static getDefaultConfig(): OpenAIServiceConfig {
    const useAzure =
      process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY;

    if (useAzure) {
      return {
        provider: "azure",
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
        azureApiVersion:
          process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
        azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
        defaultModel: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
        maxRetries: 3,
        timeout: 60000,
        enableLogging: process.env.NODE_ENV !== "production",
      };
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "No OpenAI API configuration found. Please set either OPENAI_API_KEY or Azure OpenAI credentials."
        );
      }

      return {
        provider: "openai",
        apiKey,
        defaultModel: "gpt-4o",
        maxRetries: 3,
        timeout: 60000,
        enableLogging: process.env.NODE_ENV !== "production",
      };
    }
  }

  /**
   * Initialize OpenAI or Azure OpenAI client
   */
  private initializeClient(): OpenAI | AzureOpenAI {
    if (this.config.provider === "azure") {
      if (!this.config.azureEndpoint || !this.config.azureApiVersion) {
        throw new Error("Azure OpenAI requires endpoint and API version");
      }

      return new AzureOpenAI({
        apiKey: this.config.apiKey,
        endpoint: this.config.azureEndpoint,
        apiVersion: this.config.azureApiVersion,
        deployment: this.config.azureDeployment,
        maxRetries: this.config.maxRetries || 3,
        timeout: this.config.timeout || 60000,
      });
    } else {
      return new OpenAI({
        apiKey: this.config.apiKey,
        maxRetries: this.config.maxRetries || 3,
        timeout: this.config.timeout || 60000,
      });
    }
  }

  /**
   * Create chat completion
   */
  async createChatCompletion(
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const startTime = Date.now();
    this.usageStats.totalRequests++;

    try {
      const model = options.model || this.config.defaultModel || "gpt-4o";

      if (this.config.enableLogging) {
        console.log(
          `[OpenAI Service] Creating chat completion with model: ${model}`
        );
      }

      const response = await this.client.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: options.responseFormat,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
      });

      const content = response.choices[0]?.message?.content || "";
      const usage = response.usage;

      if (usage) {
        this.usageStats.totalTokens += usage.total_tokens;
      }

      const duration = Date.now() - startTime;

      if (this.config.enableLogging) {
        console.log(
          `[OpenAI Service] Completion successful in ${duration}ms | Tokens: ${
            usage?.total_tokens || 0
          }`
        );
      }

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        finishReason: response.choices[0]?.finish_reason || "unknown",
      };
    } catch (error) {
      this.usageStats.totalErrors++;

      const duration = Date.now() - startTime;
      console.error(
        `[OpenAI Service] Error after ${duration}ms:`,
        error instanceof Error ? error.message : error
      );

      throw error;
    }
  }

  /**
   * Create chat completion with JSON response
   */
  async createJsonCompletion<T = any>(
    options: Omit<ChatCompletionOptions, "responseFormat">
  ): Promise<T> {
    const result = await this.createChatCompletion({
      ...options,
      responseFormat: { type: "json_object" },
    });

    try {
      return JSON.parse(result.content) as T;
    } catch (error) {
      console.error("[OpenAI Service] Failed to parse JSON response:", error);
      throw new Error("Invalid JSON response from OpenAI");
    }
  }

  /**
   * Get raw OpenAI client (for advanced use cases)
   */
  getClient(): OpenAI | AzureOpenAI {
    return this.client;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<OpenAIServiceConfig> {
    return { ...this.config };
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.usageStats = {
      totalRequests: 0,
      totalTokens: 0,
      totalErrors: 0,
    };
  }

  /**
   * Check if service is using Azure OpenAI
   */
  isAzure(): boolean {
    return this.config.provider === "azure";
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.config.defaultModel || "gpt-4o";
  }
}

/**
 * Convenience function to get OpenAI service instance
 */
export function getOpenAIService(config?: OpenAIServiceConfig): OpenAIService {
  return OpenAIService.getInstance(config);
}

/**
 * Convenience function for quick chat completions
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const service = getOpenAIService();
  return service.createChatCompletion(options);
}

/**
 * Convenience function for JSON completions
 */
export async function createJsonCompletion<T = any>(
  options: Omit<ChatCompletionOptions, "responseFormat">
): Promise<T> {
  const service = getOpenAIService();
  return service.createJsonCompletion<T>(options);
}

export default OpenAIService;
