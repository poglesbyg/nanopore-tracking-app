#!/usr/bin/env node

/**
 * Bulk import samples from JSON file to nanopore tracking system
 */

const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://nanopore-tracking-dept-barc.apps.cloudapps.unc.edu';
const PROJECT_NAME = 'Nanopore Sequencing Project - JL-147';

async function makeRequest(url, options = {}) {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function findOrCreateProject(projectName) {
  console.log('🔍 Finding or creating project...');
  
  // Get existing projects
  const projectsResponse = await makeRequest(`${API_BASE_URL}/api/projects`);
  if (projectsResponse.success && projectsResponse.data.data) {
    const existingProject = projectsResponse.data.data.find(p => p.name === projectName);
    if (existingProject) {
      console.log(`✅ Found existing project: ${existingProject.name} (${existingProject.id})`);
      return existingProject.id;
    }
  }

  // Create new project
  const newProject = {
    name: projectName,
    description: 'Nanopore sequencing project for JL-147 samples',
    owner_name: 'Dr. Jennifer Liu',
    owner_email: 'jliu@university.edu',
    chart_prefix: 'HTSF'
  };

  const createResponse = await makeRequest(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    body: JSON.stringify(newProject),
  });

  if (createResponse.success) {
    console.log(`✅ Created new project: ${createResponse.data.data.name} (${createResponse.data.data.id})`);
    return createResponse.data.data.id;
  } else {
    throw new Error(`Failed to create project: ${createResponse.error || 'Unknown error'}`);
  }
}

async function createSubmission(projectId, sampleCount) {
  console.log('📄 Creating submission...');
  
  const submission = {
    project_id: projectId,
    name: `JL-147 Bulk Import - ${sampleCount} Samples`,
    description: `Bulk import of ${sampleCount} samples from HTSF quote PDF`,
    submitter_name: 'Dr. Jennifer Liu',
    submitter_email: 'jliu@university.edu',
    submission_type: 'pdf',
    priority: 'normal'
  };

  const response = await makeRequest(`${API_BASE_URL}/api/submissions`, {
    method: 'POST',
    body: JSON.stringify(submission),
  });

  if (response.success) {
    console.log(`✅ Created submission: ${response.data.data.name} (${response.data.data.id})`);
    return response.data.data.id;
  } else {
    throw new Error(`Failed to create submission: ${response.error || 'Unknown error'}`);
  }
}

async function createSample(submissionId, sampleData) {
  const sample = {
    submission_id: submissionId,
    sample_name: sampleData.sample_name,
    sample_id: sampleData.sample_id,
    sample_type: sampleData.sample_type,
    submitter_name: 'Dr. Jennifer Liu',
    submitter_email: 'jliu@university.edu',
    lab_name: sampleData.lab_name,
    chart_field: sampleData.chart_field,
    concentration: sampleData.concentration,
    concentration_unit: sampleData.concentration_unit,
    volume: sampleData.volume,
    volume_unit: sampleData.volume_unit,
    priority: sampleData.priority,
    status: sampleData.status
  };

  const response = await makeRequest(`${API_BASE_URL}/api/samples`, {
    method: 'POST',
    body: JSON.stringify(sample),
  });

  return response;
}

async function importSamples(jsonFile) {
  console.log(`🚀 Starting bulk import from: ${jsonFile}`);
  
  // Read samples data
  if (!fs.existsSync(jsonFile)) {
    throw new Error(`JSON file not found: ${jsonFile}`);
  }

  const samplesData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  console.log(`📊 Found ${samplesData.length} samples to import`);

  // Find or create project
  const projectId = await findOrCreateProject(PROJECT_NAME);

  // Create submission
  const submissionId = await createSubmission(projectId, samplesData.length);

  // Import samples in batches
  const batchSize = 10;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < samplesData.length; i += batchSize) {
    const batch = samplesData.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(samplesData.length / batchSize)} (samples ${i + 1}-${Math.min(i + batchSize, samplesData.length)})`);

    const promises = batch.map(sampleData => createSample(submissionId, sampleData));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const sampleName = batch[index].sample_name;
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        console.log(`  ✅ ${sampleName}`);
      } else {
        errorCount++;
        const error = result.status === 'rejected' ? result.reason : result.value.error;
        console.log(`  ❌ ${sampleName}: ${error}`);
      }
    });

    // Small delay between batches to avoid overwhelming the server
    if (i + batchSize < samplesData.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n🎉 Import completed!`);
  console.log(`✅ Successfully imported: ${successCount} samples`);
  console.log(`❌ Failed: ${errorCount} samples`);
  console.log(`📊 Total processed: ${successCount + errorCount} samples`);

  return { successCount, errorCount };
}

// Main execution
async function main() {
  try {
    const jsonFile = process.argv[2];
    if (!jsonFile) {
      console.log('Usage: node bulk-import-samples.js <samples.json>');
      console.log('Example: node bulk-import-samples.js HTSF--JL-147_quote_160217072025_samples.json');
      process.exit(1);
    }

    await importSamples(jsonFile);
  } catch (error) {
    console.error(`\n💥 Import failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { importSamples };
