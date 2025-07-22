const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';

// Test text processing
async function testTextProcessing() {
  console.log('\n=== Testing Text Processing ===');
  
  const testText = `
    Sample Name: DNA-2024-001
    Project ID: PROJ-12345
    Submitter Name: Dr. Jane Smith
    Email: jane.smith@university.edu
    Lab Name: Genomics Research Lab
    Sample Type: DNA
    Concentration: 150 ng/ul
    Volume: 50 ul
    Flow Cell Type: FLO-MIN114
    Flow Cell Count: 2
    Priority: high
    Chart Field: NANO-001
  `;

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/process/text`, {
      text: testText,
      sampleId: 'TEST-001'
    });

    console.log('Text Processing Result:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Text processing failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Test PDF processing with sample PDF
async function testPDFProcessing() {
  console.log('\n=== Testing PDF Processing ===');
  
  // Create a sample PDF content (base64 encoded)
  // This is a minimal PDF with text content
  const samplePDFBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggMjI4Cj4+CnN0cmVhbQpCVApxCjcwIDcwMCBUZAovRjEgMTIgVGYKKFNhbXBsZSBOYW1lOiBETkEtMjAyNC0wMDEpIFRqCjAgLTE1IFRkCihQcm9qZWN0IElEOiBQUk9KLTEyMzQ1KSBUagowIC0xNSBUZAooU3VibWl0dGVyOiBEci4gSmFuZSBTbWl0aCkgVGoKMCAtMTUgVGQKKEVtYWlsOiBqYW5lLnNtaXRoQHVuaXZlcnNpdHkuZWR1KSBUagowIC0xNSBUZAooQ29uY2VudHJhdGlvbjogMTUwIG5nL3VsKSBUagowIC0xNSBUZAooVm9sdW1lOiA1MCB1bCkgVGoKRVQKUQplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY4IDAwMDAwIG4gCjAwMDAwMDAxNTcgMDAwMDAgbiAKMDAwMDAwMDI3NiAwMDAwMCBuIAowMDAwMDAwMzY0IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNjQzCiUlRU9G';

  try {
    // Test with base64 content
    console.log('Testing with base64 PDF content...');
    const response1 = await axios.post(`${AI_SERVICE_URL}/process-pdf`, {
      filename: 'test-sample.pdf',
      content: samplePDFBase64
    });

    console.log('PDF Processing Result (base64):');
    console.log(JSON.stringify(response1.data, null, 2));

    // Test with file upload
    console.log('\nTesting with file upload...');
    
    // Create a test PDF file
    const pdfBuffer = Buffer.from(samplePDFBase64, 'base64');
    const testFilePath = '/tmp/test-nanopore.pdf';
    fs.writeFileSync(testFilePath, pdfBuffer);

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), 'test-nanopore.pdf');

    const response2 = await axios.post(
      `${AI_SERVICE_URL}/api/process/pdf`,
      form,
      {
        headers: form.getHeaders()
      }
    );

    console.log('PDF Processing Result (file upload):');
    console.log(JSON.stringify(response2.data, null, 2));

    // Clean up
    fs.unlinkSync(testFilePath);

    return response2.data;
  } catch (error) {
    console.error('PDF processing failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Test health endpoint
async function testHealth() {
  console.log('\n=== Testing Health Endpoint ===');
  
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`);
    console.log('Health Check Result:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

// Test statistics endpoint
async function testStats() {
  console.log('\n=== Testing Stats Endpoint ===');
  
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/api/stats`);
    console.log('Statistics Result:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Stats check failed:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log(`Testing AI Processing Service at: ${AI_SERVICE_URL}`);
  console.log('='.repeat(50));

  await testHealth();
  await testTextProcessing();
  await testPDFProcessing();
  await testStats();

  console.log('\n' + '='.repeat(50));
  console.log('All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testHealth,
  testTextProcessing,
  testPDFProcessing,
  testStats
}; 