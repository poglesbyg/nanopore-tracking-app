// AI Processing Service Configuration
const config = {
  // Service configuration
  service: {
    port: process.env.SERVICE_PORT || 3002,
    name: 'ai-processing-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // Ollama configuration
  ollama: {
    enabled: process.env.OLLAMA_ENABLED === 'true',
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama2',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000'),
    options: {
      temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
      top_p: parseFloat(process.env.OLLAMA_TOP_P || '0.9'),
      max_tokens: parseInt(process.env.OLLAMA_MAX_TOKENS || '2048')
    }
  },

  // Qdrant configuration
  qdrant: {
    enabled: process.env.QDRANT_ENABLED === 'true',
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    collection: process.env.QDRANT_COLLECTION || 'nanopore_documents',
    vectorSize: parseInt(process.env.QDRANT_VECTOR_SIZE || '1536')
  },

  // PDF processing configuration
  pdf: {
    maxFileSize: parseInt(process.env.MAX_PDF_SIZE || '10485760'), // 10MB
    extractImages: process.env.EXTRACT_PDF_IMAGES === 'true',
    ocrEnabled: process.env.OCR_ENABLED === 'true'
  },

  // Field extraction patterns
  fieldPatterns: {
    sampleName: /sample\s*name[:\s]*([^\n\r]+)/i,
    projectId: /project\s*(?:id|number)[:\s]*([^\n\r]+)/i,
    submitterEmail: /email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    submitterName: /(?:submitter|contact\s*person)[:\s]*([^\n\r]+)/i,
    labName: /(?:lab|laboratory)[:\s]*([^\n\r]+)/i,
    sampleType: /sample\s*type[:\s]*(dna|rna|protein|other)/i,
    concentration: /concentration[:\s]*([0-9.]+)\s*(?:ng\/ul|ng\/ml)/i,
    volume: /volume[:\s]*([0-9.]+)\s*(?:ul|ml)/i,
    flowCellType: /flow\s*cell[:\s]*(FLO-MIN[0-9]+)/i,
    flowCellCount: /flow\s*cell\s*count[:\s]*([0-9]+)/i,
    priority: /priority[:\s]*(low|normal|high|urgent)/i,
    chartField: /chart\s*field[:\s]*([A-Z]+-[0-9]+)/i
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  }
};

// Validation
function validateConfig() {
  const errors = [];
  
  if (config.ollama.enabled && !config.ollama.url) {
    errors.push('Ollama URL is required when Ollama is enabled');
  }
  
  if (config.qdrant.enabled && !config.qdrant.url) {
    errors.push('Qdrant URL is required when Qdrant is enabled');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }
}

// Export configuration
module.exports = {
  config,
  validateConfig
}; 