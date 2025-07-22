const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.SERVICE_PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-processing',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Basic AI processing endpoint
app.post('/process', async (req, res) => {
  try {
    // Placeholder for AI processing logic
    const { text, pdfData } = req.body;
    
    // Simulate AI processing
    const result = {
      processed: true,
      text: text || 'No text provided',
      timestamp: new Date().toISOString(),
      confidence: 0.95,
      extractedData: {
        // Placeholder for extracted data
        sampleId: 'AI-' + Date.now(),
        status: 'processed'
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({
      error: 'Processing failed',
      message: error.message
    });
  }
});

// PDF processing endpoint
app.post('/process-pdf', async (req, res) => {
  try {
    const { filename, content } = req.body;
    
    // Placeholder for PDF processing
    const result = {
      processed: true,
      filename: filename,
      timestamp: new Date().toISOString(),
      extractedData: {
        text: 'Extracted text from PDF',
        metadata: {
          pages: 1,
          author: 'Unknown'
        }
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('PDF processing error:', error);
    res.status(500).json({
      error: 'PDF processing failed',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Processing Service listening on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
}); 