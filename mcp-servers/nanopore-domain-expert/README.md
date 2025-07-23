# Nanopore Domain Expert MCP Server

An MCP (Model Context Protocol) server that provides specialized domain expertise for Oxford Nanopore sequencing operations.

## Features

### 1. Sample Validation
- Validates concentration, volume, purity ratios, and fragment sizes
- Provides specific recommendations based on sample type
- Returns confidence scores and detailed issues/warnings

### 2. Flow Cell Recommendations
- Suggests optimal flow cell type based on:
  - Sample characteristics
  - Expected yield requirements
  - Read length targets
  - Budget constraints
- Provides reasoning and alternatives

### 3. Sequencing Outcome Prediction
- Predicts success probability
- Estimates runtime and read counts
- Considers environmental factors
- Generates quality warnings

### 4. QC Analysis & Insights
- Analyzes sequencing run quality metrics
- Compares against historical data
- Provides actionable recommendations
- Detects anomalies and trends

## Installation

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install MCP SDK (when available)
pip install mcp
```

## Usage

### Starting the Server

```bash
python server.py
```

### Example Client Usage

```python
from mcp import Client

# Connect to the server
client = Client("nanopore-domain-expert")

# Validate sample parameters
result = await client.call("validate_sample_parameters", {
    "concentration": 45.0,  # ng/μL
    "volume": 50.0,  # μL
    "purity_ratio": 1.85,
    "fragment_size": 15000,
    "sample_type": "Genomic DNA"
})

# Get flow cell recommendation
recommendation = await client.call("recommend_flow_cell", {
    "sample_type": "Genomic DNA",
    "expected_yield": 20.0,  # Gb
    "read_length_target": 50000,  # bp
    "budget_constraint": 1000  # USD
})

# Predict sequencing outcome
prediction = await client.call("predict_sequencing_outcome", {
    "sample_metrics": {
        "concentration": 45.0,
        "purity_ratio": 1.85,
        "fragment_size": 15000
    },
    "flow_cell_type": "R10.4.1",
    "environmental_conditions": {
        "temperature": 22,
        "humidity": 45
    }
})

# Analyze QC data
insights = await client.call("generate_qc_insights", {
    "qc_data": {
        "n50": 25000,
        "mean_quality": 11.5,
        "total_bases": 15000000000,
        "read_count": 2500000
    },
    "historical_data": [...]  # Previous runs
})
```

## Domain Knowledge

### Sample Type Specifications

| Sample Type | Min Conc (ng/μL) | Max Conc (ng/μL) | Optimal Purity (260/280) |
|-------------|------------------|------------------|--------------------------|
| Genomic DNA | 20 | 200 | 1.8-2.0 |
| Plasmid | 50 | 500 | 1.8-2.0 |
| Amplicon | 10 | 100 | 1.8-2.0 |
| RNA | 100 | 1000 | 2.0-2.2 |
| cDNA | 50 | 300 | 1.8-2.0 |

### Flow Cell Specifications

| Flow Cell | Max Output (Gb) | Read Length | Accuracy | Cost (USD) |
|-----------|-----------------|-------------|----------|------------|
| R9.4.1 | 30 | Long | 95% | $900 |
| R10.4.1 | 50 | Ultra-long | 98% | $900 |
| R10.5.1 | 60 | Ultra-long | 99% | $1200 |
| Flongle | 2 | Moderate | 95% | $90 |

## Testing

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=.
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details 