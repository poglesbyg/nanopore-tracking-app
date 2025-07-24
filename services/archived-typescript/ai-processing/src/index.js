const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.SERVICE_PORT || 3002;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-processing',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    features: {
      pdfProcessing: true,
      textExtraction: true,
      aiAnalysis: false, // Will be enabled when Ollama is connected
      vectorSearch: false // Will be enabled when Qdrant is connected
    }
  });
});

// Extract nanopore-specific fields from text
function extractNanoporeFields(text) {
  const fields = {
    sampleName: null,
    projectId: null,
    submitterName: null,
    submitterEmail: null,
    labName: null,
    sampleType: null,
    concentration: null,
    volume: null,
    flowCellType: null,
    flowCellCount: null,
    priority: null,
    chartField: null
  };

  // Sample name patterns
  const sampleNameMatch = text.match(/sample\s*name[:\s]*([^\n\r]+)/i);
  if (sampleNameMatch) fields.sampleName = sampleNameMatch[1].trim();

  // Project ID patterns
  const projectMatch = text.match(/project\s*(?:id|number)[:\s]*([^\n\r]+)/i);
  if (projectMatch) fields.projectId = projectMatch[1].trim();

  // Email pattern
  const emailMatch = text.match(/email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) fields.submitterEmail = emailMatch[1];

  // Submitter name
  const submitterMatch = text.match(/(?:submitter|contact\s*person)[:\s]*([^\n\r]+)/i);
  if (submitterMatch) fields.submitterName = submitterMatch[1].trim();

  // Lab name
  const labMatch = text.match(/(?:lab|laboratory)[:\s]*([^\n\r]+)/i);
  if (labMatch) fields.labName = labMatch[1].trim();

  // Sample type
  const typeMatch = text.match(/sample\s*type[:\s]*(dna|rna|protein|other)/i);
  if (typeMatch) fields.sampleType = typeMatch[1].toLowerCase();

  // Concentration
  const concMatch = text.match(/concentration[:\s]*([0-9.]+)\s*(?:ng\/ul|ng\/ml)/i);
  if (concMatch) fields.concentration = parseFloat(concMatch[1]);

  // Volume
  const volumeMatch = text.match(/volume[:\s]*([0-9.]+)\s*(?:ul|ml)/i);
  if (volumeMatch) fields.volume = parseFloat(volumeMatch[1]);

  // Flow cell type
  const flowCellMatch = text.match(/flow\s*cell[:\s]*(FLO-MIN[0-9]+)/i);
  if (flowCellMatch) fields.flowCellType = flowCellMatch[1];

  // Flow cell count
  const flowCellCountMatch = text.match(/flow\s*cell\s*count[:\s]*([0-9]+)/i);
  if (flowCellCountMatch) fields.flowCellCount = parseInt(flowCellCountMatch[1]);

  // Priority
  const priorityMatch = text.match(/priority[:\s]*(low|normal|high|urgent)/i);
  if (priorityMatch) fields.priority = priorityMatch[1].toLowerCase();

  // Chart field
  const chartMatch = text.match(/chart\s*field[:\s]*([A-Z]+-[0-9]+)/i);
  if (chartMatch) fields.chartField = chartMatch[1];

  return fields;
}

// Calculate extraction confidence
function calculateConfidence(fields) {
  const totalFields = Object.keys(fields).length;
  const filledFields = Object.values(fields).filter(v => v !== null).length;
  return filledFields / totalFields;
}

// Basic text processing endpoint
app.post('/api/process/text', async (req, res) => {
  try {
    const { text, sampleId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const extractedFields = extractNanoporeFields(text);
    const confidence = calculateConfidence(extractedFields);

    const result = {
      success: true,
      sampleId: sampleId || `AI-${Date.now()}`,
      timestamp: new Date().toISOString(),
      confidence: confidence,
      extractedFields: extractedFields,
      validationErrors: [],
      processingTime: process.uptime()
    };

    // Basic validation
    if (!extractedFields.sampleName) {
      result.validationErrors.push('Sample name is required');
    }
    if (!extractedFields.submitterEmail) {
      result.validationErrors.push('Submitter email is required');
    }

    res.json(result);
  } catch (error) {
    console.error('Text processing error:', error);
    res.status(500).json({
      error: 'Text processing failed',
      message: error.message
    });
  }
});

// PDF processing endpoint with file upload
app.post('/api/process/pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing PDF: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse PDF
    const pdfData = await pdfParse(req.file.buffer);
    
    // Extract text and process
    const text = pdfData.text;
    const extractedFields = extractNanoporeFields(text);
    const confidence = calculateConfidence(extractedFields);

    const result = {
      success: true,
      jobId: `PDF-${Date.now()}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      timestamp: new Date().toISOString(),
      confidence: confidence,
      extractedFields: extractedFields,
      pdfMetadata: {
        pages: pdfData.numpages,
        version: pdfData.version,
        info: pdfData.info,
        textLength: text.length
      },
      validationErrors: [],
      processingTime: process.uptime()
    };

    // Validation
    if (!extractedFields.sampleName) {
      result.validationErrors.push('Sample name not found in PDF');
    }
    if (!extractedFields.submitterEmail) {
      result.validationErrors.push('Submitter email not found in PDF');
    }

    console.log(`PDF processed successfully: ${result.jobId}`);
    res.json(result);

  } catch (error) {
    console.error('PDF processing error:', error);
    res.status(500).json({
      error: 'PDF processing failed',
      message: error.message,
      details: error.stack
    });
  }
});

// Legacy endpoints for compatibility
app.post('/process', async (req, res) => {
  // Forward to new text processing endpoint
  req.url = '/api/process/text';
  app.handle(req, res);
});

app.post('/process-pdf', async (req, res) => {
  try {
    const { filename, content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'PDF content is required' });
    }

    // Convert base64 content to buffer if needed
    const buffer = Buffer.isBuffer(content) 
      ? content 
      : Buffer.from(content, 'base64');

    // Create a fake file object for multer compatibility
    req.file = {
      buffer: buffer,
      originalname: filename || 'uploaded.pdf',
      size: buffer.length,
      mimetype: 'application/pdf'
    };

    // Forward to new PDF processing endpoint
    req.url = '/api/process/pdf';
    app.handle(req, res);

  } catch (error) {
    console.error('Legacy PDF endpoint error:', error);
    res.status(500).json({
      error: 'PDF processing failed',
      message: error.message
    });
  }
});

// Service statistics endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    service: 'ai-processing',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /api/process/text',
      'POST /api/process/pdf',
      'GET /api/stats'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Processing Service v1.0.0 started`);
  console.log(`Listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 