// FIX: Add jest imports
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GoogleGenAI } from '@google/genai';

// Mock the entire @google/genai module
jest.mock('@google/genai', () => {
  const mockGenerateContent = jest.fn();
  const mockGenerateContentStream = jest.fn();
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
      },
    })),
  };
});

const MockGoogleGenAI = GoogleGenAI as jest.Mock;
// FIX: Cast mock result value to 'any' to fix type error when accessing 'models' property.
const mockGenerateContent = ((GoogleGenAI as jest.Mock).mock.results[0]?.value as any)?.models.generateContent;
// FIX: Cast mock result value to 'any' to fix type error when accessing 'models' property.
const mockGenerateContentStream = ((GoogleGenAI as jest.Mock).mock.results[0]?.value as any)?.models.generateContentStream;


describe('geminiService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // This is key to re-importing the service with new env vars
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    it('should initialize GoogleGenAI with the API_KEY from process.env', async () => {
      process.env.API_KEY = 'test-key-from-env';
      await import('../../services/geminiService');
      expect(MockGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key-from-env' });
    });

    it('should not initialize if API_KEY is not in process.env', async () => {
      delete process.env.API_KEY;
      await import('../../services/geminiService');
      expect(MockGoogleGenAI).not.toHaveBeenCalled();
    });
  });

  describe('generateText', () => {
    it('should throw an error if not initialized', async () => {
      delete process.env.API_KEY;
      const { generateText } = await import('../../services/geminiService');
      await expect(generateText('Say hello')).rejects.toThrow('Gemini API not initialized. Please set the API_KEY environment variable.');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
    
    it('should return generated text on successful API call', async () => {
      process.env.API_KEY = 'test-key';
      const { generateText } = await import('../../services/geminiService');
      mockGenerateContent.mockResolvedValue({ text: 'Hello, world!' });
      const result = await generateText('Say hello');
      expect(result).toBe('Hello, world!');
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: 'Say hello',
        config: {},
      });
    });

    it('should pass config options to the API call', async () => {
      process.env.API_KEY = 'test-key';
      const { generateText } = await import('../../services/geminiService');
      mockGenerateContent.mockResolvedValue({ text: 'Creative response!' });
      await generateText('Be creative', { temperature: 0.9, thinkingEnabled: false });
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: 'Be creative',
        config: {
          temperature: 0.9,
          thinkingConfig: { thinkingBudget: 0 }
        },
      });
    });

    it('should throw an error if prompt is empty', async () => {
      process.env.API_KEY = 'test-key';
      const { generateText } = await import('../../services/geminiService');
      await expect(generateText('')).rejects.toThrow('Please provide a prompt.');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('should throw an error on API failure', async () => {
      process.env.API_KEY = 'test-key';
      const { generateText } = await import('../../services/geminiService');
      const error = new Error('API Error');
      mockGenerateContent.mockRejectedValue(error);
      await expect(generateText('Say hello')).rejects.toThrow('Gemini API Error: API Error');
    });
  });

  describe('generateTextStream', () => {
    async function* createMockStream(chunks: string[]) {
      for (const chunk of chunks) {
        yield { text: chunk };
      }
    }
    
    it('should throw an error if not initialized', async () => {
       delete process.env.API_KEY;
       const { generateTextStream } = await import('../../services/geminiService');
       await expect(generateTextStream('Say hello').next()).rejects.toThrow('Gemini API not initialized. Please set the API_KEY environment variable.');
       expect(mockGenerateContentStream).not.toHaveBeenCalled();
    });

    it('should yield generated text chunks on successful API call', async () => {
      process.env.API_KEY = 'test-key';
      const { generateTextStream } = await import('../../services/geminiService');
      const chunks = ['Hello', ', ', 'world!'];
      mockGenerateContentStream.mockResolvedValue(createMockStream(chunks));
      
      const result = [];
      for await (const chunk of generateTextStream('Say hello')) {
        result.push(chunk);
      }

      expect(result).toEqual(chunks);
      expect(mockGenerateContentStream).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: 'Say hello',
        config: {},
      });
    });

    it('should pass config options to the stream API call', async () => {
      process.env.API_KEY = 'test-key';
      const { generateTextStream } = await import('../../services/geminiService');
      mockGenerateContentStream.mockResolvedValue(createMockStream(['...']));
      const generator = generateTextStream('Be creative', { temperature: 1.0, thinkingEnabled: true });
      await generator.next(); // Start the generator
      expect(mockGenerateContentStream).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: 'Be creative',
        config: {
          temperature: 1.0,
        },
      });
    });


     it('should throw an error if prompt is empty', async () => {
       process.env.API_KEY = 'test-key';
       const { generateTextStream } = await import('../../services/geminiService');
       const generator = generateTextStream('');
       await expect(generator.next()).rejects.toThrow('Please provide a prompt.');
       expect(mockGenerateContentStream).not.toHaveBeenCalled();
    });

    it('should throw an error on API failure', async () => {
      process.env.API_KEY = 'test-key';
      const { generateTextStream } = await import('../../services/geminiService');
      const error = new Error('API Stream Error');
      mockGenerateContentStream.mockRejectedValue(error);
      
      const generator = generateTextStream('Say hello');
      await expect(generator.next()).rejects.toThrow('Gemini API Error: API Stream Error');
    });
  });
});