const axios = require('axios');
const { config } = require('../config');

class OllamaService {
  constructor() {
    this.baseUrl = config.ollama.url;
    this.model = config.ollama.model;
    this.timeout = config.ollama.timeout;
    this.enabled = config.ollama.enabled;
  }

  // Check if Ollama is available
  async isAvailable() {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('Ollama availability check failed:', error.message);
      return false;
    }
  }

  // Generate text using Ollama
  async generate(prompt, options = {}) {
    if (!this.enabled) {
      throw new Error('Ollama is not enabled');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || config.ollama.options.temperature,
            top_p: options.top_p || config.ollama.options.top_p,
            num_predict: options.max_tokens || config.ollama.options.max_tokens
          }
        },
        {
          timeout: this.timeout
        }
      );

      return response.data.response;
    } catch (error) {
      console.error('Ollama generation failed:', error.message);
      throw error;
    }
  }

  // Extract fields from text using LLM
  async extractFields(text) {
    const prompt = `Extract the following information from this nanopore sequencing submission form. 
Return ONLY the requested fields in a JSON format.

Text:
${text}

Extract these fields:
- sampleName: The name of the sample
- projectId: Project ID or number
- submitterName: Name of the person submitting
- submitterEmail: Email address
- labName: Laboratory name
- sampleType: Type of sample (DNA, RNA, protein, or other)
- concentration: Concentration value (number only)
- volume: Volume value (number only)
- flowCellType: Flow cell type (e.g., FLO-MIN114)
- flowCellCount: Number of flow cells
- priority: Priority level (low, normal, high, or urgent)
- chartField: Chart field or account code

Return as JSON with null for missing fields.`;

    try {
      const response = await this.generate(prompt);
      
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to regex extraction
      return null;
    } catch (error) {
      console.error('Field extraction with LLM failed:', error.message);
      return null;
    }
  }

  // Validate extracted data using LLM
  async validateData(extractedData) {
    const prompt = `Validate the following nanopore sequencing sample data and identify any issues:

${JSON.stringify(extractedData, null, 2)}

Check for:
1. Missing required fields (sampleName, submitterEmail)
2. Invalid email format
3. Unrealistic concentration or volume values
4. Invalid flow cell types
5. Any data inconsistencies

Return a JSON object with:
- isValid: boolean
- errors: array of error messages
- warnings: array of warning messages
- suggestions: array of improvement suggestions`;

    try {
      const response = await this.generate(prompt);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };
    } catch (error) {
      console.error('Data validation with LLM failed:', error.message);
      return null;
    }
  }

  // Generate embeddings for text
  async generateEmbedding(text) {
    if (!this.enabled) {
      throw new Error('Ollama is not enabled');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.model,
          prompt: text
        },
        {
          timeout: this.timeout
        }
      );

      return response.data.embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error.message);
      throw error;
    }
  }
}

module.exports = OllamaService; 