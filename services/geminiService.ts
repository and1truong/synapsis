import { GoogleGenAI } from "@google/genai";

// FIX: Initialize Gemini client from environment variables as per guidelines.
// The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.
const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

if (!ai) {
  // Use console.warn to avoid breaking apps that don't use LLM nodes.
  console.warn("Gemini API key not found in process.env.API_KEY. LLM nodes will not work.");
}

interface GenerateTextConfig {
    temperature?: number;
    thinkingEnabled?: boolean;
}

const buildGeminiRequestConfig = (config?: GenerateTextConfig) => {
    const geminiConfig: any = {};
    if (config?.temperature !== undefined) {
        geminiConfig.temperature = config.temperature;
    }
    if (config?.thinkingEnabled === false) {
        geminiConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    return geminiConfig;
}

export const generateText = async (prompt: string, config?: GenerateTextConfig): Promise<string> => {
  if (!ai) {
    // FIX: Update error message to reflect environment variable usage.
    throw new Error("Gemini API not initialized. Please set the API_KEY environment variable.");
  }
  
  if (!prompt) {
    throw new Error("Please provide a prompt.");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: buildGeminiRequestConfig(config),
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while contacting the Gemini API.");
  }
};

export async function* generateTextStream(prompt: string, config?: GenerateTextConfig): AsyncGenerator<string> {
  if (!ai) {
    // FIX: Update error message to reflect environment variable usage.
    throw new Error("Gemini API not initialized. Please set the API_KEY environment variable.");
  }
  
  if (!prompt) {
    throw new Error("Please provide a prompt.");
  }

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: buildGeminiRequestConfig(config),
    });

    for await (const chunk of response) {
      yield chunk.text;
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    } else {
        throw new Error("An unknown error occurred while contacting the Gemini API.");
    }
  }
}