import dotenv from "dotenv";
dotenv.config();
import { OutlineSchema, OutlineResponse } from "../processors/schema-processor";
import { Slide } from "../../../types/slides";
import { getOpenAIService } from "../../services/openai";

const openaiService = getOpenAIService();

export const generateOutline = async (
  slides: Slide[],
  language: string,
  page: number,
  topic: string
): Promise<OutlineResponse> => {
  const result = await openaiService.createJsonCompletion<OutlineResponse>({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a professional presentation assistant. Generate a structured outline and slides for a presentation.

Return ONLY valid JSON in this EXACT format:
{
  "outline": [
    {
      "id": "outline-1",
      "title": "Main Title",
      "points": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "slides": [
    {
      "id": "slide-1",
      "title": "Slide Title",
      "description": "Description",
      "outlineRef": "outline-1"
    }
  ]
}

STRICT RULES:
1. "outline" array: EXACTLY 1 object
2. "points" array: EXACTLY 3 strings
3. "slides" array: EXACTLY ${page} objects
4. All "outlineRef" must be "outline-1"
5. Language: ${language}
6. Topic: ${topic}
7. Return ONLY the JSON object, no markdown, no comments`,
      },
      {
        role: "user",
        content: `Generate ${page} slides about "${topic}" in ${language}.`,
      },
    ],
  });

  console.log(result, "response");

  const parsed = OutlineSchema.parse(result);
  return parsed;
};
