# Nanopore Domain Expert MCP Server

A specialized Model Context Protocol (MCP) server that provides expert-level guidance and domain knowledge for nanopore sequencing workflows. This server acts as a virtual nanopore sequencing expert, offering protocol recommendations, quality assessments, troubleshooting guidance, workflow optimization, and best practices.

## Overview

The Nanopore Domain Expert MCP Server transforms the nanopore tracking application into an intelligent laboratory management platform by providing:

- **Protocol Recommendations**: AI-powered analysis of sample characteristics to recommend optimal sequencing protocols
- **Quality Assessment**: Comprehensive evaluation of sample quality metrics with success probability predictions
- **Troubleshooting**: Expert diagnosis and solutions for common nanopore sequencing issues
- **Workflow Optimization**: Intelligent suggestions for improving laboratory efficiency and data quality
- **Best Practices**: Curated guidance tailored to user experience level and specific expertise areas

## Features

### 🧬 Protocol Analysis
- Sample-specific protocol recommendations
- Budget and timeline-aware suggestions
- Kit compatibility analysis
- Yield and read length predictions

### 🔬 Quality Assessment
- Multi-parameter quality scoring
- Success probability calculations
- Critical issue identification
- Actionable improvement recommendations

### 🔧 Troubleshooting
- Symptom-based problem diagnosis
- Workflow stage-specific guidance
- Root cause analysis
- Prevention strategies

### ⚡ Workflow Optimization
- Efficiency improvement suggestions
- Resource constraint consideration
- Goal-oriented recommendations
- Implementation roadmaps

### 📚 Best Practices
- Experience-level tailored guidance
- Area-specific expertise
- Implementation guides
- Common pitfall avoidance

## Available Tools

### 1. `analyze_protocol_recommendation`
Analyzes sample characteristics and recommends optimal nanopore sequencing protocols.

**Parameters:**
- `sample_type` (required): DNA, RNA, Protein, or Other
- `sample_concentration` (optional): Concentration in ng/μL
- `sample_volume` (optional): Available volume in μL
- `target_application` (required): Intended sequencing application
- `budget_level` (optional): low, medium, high, or unlimited
- `timeline` (optional): urgent, standard, or flexible
- `special_requirements` (optional): Array of special requirements

**Example Usage:**
```json
{
  "sample_type": "DNA",
  "sample_concentration": 75,
  "target_application": "genome assembly",
  "budget_level": "medium",
  "timeline": "standard"
}
```

### 2. `assess_sample_quality`
Assesses sample quality metrics and predicts sequencing success probability.

**Parameters:**
- `quality_metrics` (required): Object containing quality measurements
- `sample_type` (required): Type of sample being assessed
- `intended_application` (required): Intended use of sequencing data
- `sample_id` (optional): Sample identifier
- `flow_cell_type` (optional): Target flow cell type

**Example Usage:**
```json
{
  "quality_metrics": {
    "concentration": 125,
    "purity_260_280": 1.85,
    "dna_integrity_number": 8.2,
    "contamination_level": "low"
  },
  "sample_type": "DNA",
  "intended_application": "whole genome sequencing"
}
```

### 3. `troubleshoot_sequencing_issue`
Diagnoses and provides solutions for common nanopore sequencing problems.

**Parameters:**
- `issue_description` (required): Detailed problem description
- `workflow_stage` (required): Stage where issue occurred
- `observed_symptoms` (required): Array of symptoms
- `sample_type` (optional): Type of sample involved
- `recent_changes` (optional): Recent protocol or equipment changes

**Example Usage:**
```json
{
  "issue_description": "Low yield from library preparation",
  "workflow_stage": "library_preparation",
  "observed_symptoms": ["Low library concentration", "Poor size distribution"],
  "sample_type": "DNA",
  "recent_changes": ["New adapter lot", "Different incubation temperature"]
}
```

### 4. `optimize_sequencing_workflow`
Provides optimization suggestions for nanopore sequencing workflows.

**Parameters:**
- `current_workflow` (required): Description of current process
- `sample_types` (required): Array of sample types processed
- `optimization_goals` (required): Array of optimization objectives
- `throughput_requirements` (optional): Required throughput
- `quality_requirements` (optional): Quality level needed
- `resource_constraints` (optional): Budget/equipment constraints

**Example Usage:**
```json
{
  "current_workflow": "Manual DNA extraction followed by standard library prep",
  "sample_types": ["DNA"],
  "optimization_goals": ["increase_throughput", "reduce_cost"],
  "quality_requirements": "standard",
  "resource_constraints": ["Limited budget", "Small team"]
}
```

### 5. `get_nanopore_best_practices`
Retrieves best practices and expert guidance for specific nanopore sequencing areas.

**Parameters:**
- `expertise_area` (required): Specific area of expertise
- `experience_level` (optional): beginner, intermediate, or advanced
- `specific_focus` (optional): Specific aspect within the area

**Example Usage:**
```json
{
  "expertise_area": "sample_preparation",
  "experience_level": "intermediate",
  "specific_focus": "DNA integrity preservation"
}
```

## Expertise Areas

The server provides guidance across multiple nanopore sequencing domains:

- **Sample Preparation**: DNA/RNA extraction, purification, quality control
- **Library Preparation**: Adapter ligation, size selection, quantification
- **Sequencing Optimization**: Flow cell setup, run parameters, monitoring
- **Quality Control**: QC checkpoints, metrics interpretation, troubleshooting
- **Troubleshooting**: Problem diagnosis, root cause analysis, solutions
- **Data Analysis**: Basecalling, quality assessment, downstream processing
- **Protocol Selection**: Choosing optimal protocols for specific applications
- **Contamination Detection**: Prevention and identification strategies
- **Yield Optimization**: Maximizing data output and quality
- **Read Length Optimization**: Achieving optimal read lengths

## Installation

1. Navigate to the server directory:
```bash
cd services/mcp-servers/nanopore-domain
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

## Development

### Building
```bash
npm run build
```

### Development Mode (with watch)
```bash
npm run dev
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Configuration

The server can be configured through environment variables or configuration files:

- **LOG_LEVEL**: Logging level (debug, info, warn, error)
- **MAX_RECOMMENDATIONS**: Maximum protocol recommendations to return
- **QUALITY_THRESHOLDS**: Custom quality assessment thresholds

## Integration with Claude Desktop

Add the following configuration to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "nanopore-domain-expert": {
      "command": "node",
      "args": ["./services/mcp-servers/nanopore-domain/dist/index.js"],
      "cwd": "/path/to/nanopore-tracking-app"
    }
  }
}
```

## Domain Knowledge Base

The server includes comprehensive domain knowledge covering:

### Protocol Recommendations
- **DNA Protocols**: Ligation sequencing, rapid sequencing, PCR barcoding
- **RNA Protocols**: Direct RNA, direct cDNA, PCR-cDNA
- **Specialized Protocols**: Amplicon sequencing, metagenomics, targeted sequencing

### Quality Thresholds
- **DNA**: Concentration >50 ng/μL optimal, >10 ng/μL minimum
- **RNA**: Concentration >25 ng/μL optimal, >5 ng/μL minimum
- **Purity**: 260/280 ratio guidelines for different sample types
- **Integrity**: DIN/RIN score requirements for optimal results

### Troubleshooting Knowledge
- **Common Issues**: Low yield, poor quality, library prep failures
- **Diagnostic Steps**: Systematic problem identification
- **Solutions**: Evidence-based remediation strategies
- **Prevention**: Best practices to avoid common problems

### Optimization Strategies
- **Efficiency**: Batch processing, automation opportunities
- **Quality**: QC improvements, protocol refinements
- **Cost**: Resource optimization, waste reduction
- **Throughput**: Capacity improvements, bottleneck removal

## API Response Format

All tools return structured JSON responses with:

- **Analysis Type**: Type of analysis performed
- **Input Summary**: Summary of provided parameters
- **Results**: Main analysis results
- **Expert Guidance**: Additional recommendations and insights
- **Implementation**: Actionable next steps

## Error Handling

The server provides comprehensive error handling:

- **Validation Errors**: Invalid input parameters
- **Domain Errors**: Expert system failures
- **System Errors**: Infrastructure issues

All errors include detailed messages and suggested resolutions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Check the troubleshooting section
- Review the API documentation
- Contact the development team
- Submit issues on GitHub

## Changelog

### Version 1.0.0
- Initial release
- Five core MCP tools
- Comprehensive domain knowledge base
- Expert-level guidance system
- Integration with nanopore tracking application

---

*Context improved by Giga AI - The Nanopore Domain Expert MCP Server provides specialized domain knowledge and expert guidance for nanopore sequencing workflows, transforming the tracking application into an intelligent laboratory management platform.* 