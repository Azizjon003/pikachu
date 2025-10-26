/**
 * OpenAI Service Module
 *
 * Centralized OpenAI/Azure OpenAI service management
 */

export {
  OpenAIService,
  getOpenAIService,
  createChatCompletion,
  createJsonCompletion,
  type OpenAIProvider,
  type OpenAIServiceConfig,
  type ChatCompletionOptions,
  type ChatCompletionResult,
} from "./openai-service";
