# Sample Management MCP Server

An intelligent Model Context Protocol (MCP) server for nanopore sample workflow management and optimization.

## Features

### 🔬 Workflow Analysis
- **Performance Analysis**: Analyze workflow performance and identify bottlenecks over time periods
- **Stage Metrics**: Track success rates, processing times, and resource utilization per workflow stage
- **Bottleneck Detection**: Automatically identify stages causing delays and suggest improvements

### 📅 Intelligent Scheduling
- **Priority-Based Scheduling**: Optimize sample processing order based on priority, age, and resource constraints
- **Resource Optimization**: Balance workload across prep and sequencing capacity
- **Capacity Planning**: Predict resource utilization and identify optimization opportunities

### 👥 Assignment Optimization
- **Skill-Based Assignment**: Match samples to operators based on skills, workload, and efficiency
- **Workload Balancing**: Analyze and optimize workload distribution across team members
- **Performance Tracking**: Monitor operator efficiency and suggest reassignments

### 📊 Predictive Analytics
- **Completion Predictions**: Estimate completion times based on current workflow state
- **Risk Assessment**: Identify potential delays and bottlenecks before they occur
- **Resource Forecasting**: Predict future resource needs based on current pipeline

## Available Tools

### `analyze_workflow_performance`
Analyze workflow performance over a specified time period.

**Parameters:**
- `timeRangeStart` (required): Start date for analysis (ISO 8601)
- `timeRangeEnd` (required): End date for analysis (ISO 8601)
- `includeCompleted` (optional): Include completed samples in analysis (default: true)

**Returns:**
- Overall metrics (total samples, processing time, completion rate)
- Stage-by-stage performance analysis
- Bottleneck identification and recommendations

### `optimize_sample_schedule`
Generate optimized scheduling recommendations for pending samples.

**Parameters:**
- `priorityWeights` (optional): Custom priority weights for scheduling algorithm
- `resourceConstraints` (optional): Maximum capacity constraints for prep and sequencing

**Returns:**
- Optimized processing queue with priority scores
- Resource utilization analysis
- Scheduling insights and recommendations

### `generate_assignment_recommendations`
Generate intelligent assignment recommendations for samples to operators.

**Parameters:**
- `sample_ids` (optional): Specific samples to assign (defaults to all unassigned)
- `consider_workload` (optional): Factor in current operator workload (default: true)
- `consider_skills` (optional): Match operator skills to sample requirements (default: true)
- `consider_efficiency` (optional): Consider operator efficiency ratings (default: true)

**Returns:**
- Sample-to-operator assignment recommendations with confidence scores
- Workload distribution after assignments
- Optimization insights and warnings

### `analyze_workload_balance`
Analyze current workload balance across operators.

**Parameters:** None

**Returns:**
- Overall balance score (0-100%)
- Identification of overloaded and underutilized operators
- Rebalancing suggestions

### `predict_completion_times`
Predict completion times for samples (currently in development).

**Parameters:**
- `sample_ids` (optional): Specific samples to predict for
- `include_confidence_intervals` (optional): Include prediction confidence intervals

**Returns:**
- Completion time predictions with confidence intervals
- Risk factor analysis
- Resource availability impact

## Installation

1. **Install Dependencies**
   ```bash
   cd services/mcp-servers/sample-management
   npm install
   ```

2. **Environment Setup**
   Create a `.env` file with database connection details:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=nanopore_db
   DB_USER=postgres
   DB_PASSWORD=postgres
   ```

3. **Build the Server**
   ```bash
   npm run build
   ```

4. **Run the Server**
   ```bash
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Integration with Claude Desktop

To use this MCP server with Claude Desktop, add it to your MCP configuration:

```json
{
  "mcpServers": {
    "sample-management": {
      "command": "node",
      "args": ["/path/to/services/mcp-servers/sample-management/dist/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "nanopore_db",
        "DB_USER": "postgres",
        "DB_PASSWORD": "postgres"
      }
    }
  }
}
```

## Usage Examples

### Analyzing Workflow Performance
```
Please analyze our workflow performance for the last 30 days and identify any bottlenecks.
```

### Optimizing Sample Schedule
```
Generate an optimized schedule for our pending samples, prioritizing urgent samples with a weight of 5.
```

### Assignment Recommendations
```
Recommend assignments for all unassigned DNA samples, considering operator skills and current workload.
```

### Workload Balance Analysis
```
Analyze the current workload balance across our team and suggest improvements.
```

## Architecture

The MCP server is built with:

- **TypeScript**: Type-safe development with full IntelliSense support
- **Kysely**: Type-safe SQL query builder for database operations
- **Zod**: Runtime type validation for API parameters
- **Date-fns**: Robust date manipulation and calculations

### Key Components

- **WorkflowAnalyzer**: Analyzes performance metrics and identifies bottlenecks
- **AssignmentOptimizer**: Optimizes sample-to-operator assignments
- **DatabaseConnection**: Manages database connectivity and connection pooling
- **Types**: Comprehensive type definitions for all data structures

## Development

### Adding New Tools

1. Define the tool schema in the `ListToolsRequestSchema` handler
2. Add the tool handler in the `CallToolRequestSchema` switch statement
3. Implement the tool logic in the appropriate analyzer class
4. Add comprehensive error handling and validation

### Testing

```bash
npm test
```

### Building

```bash
npm run build
```

## Performance Considerations

- **Connection Pooling**: Database connections are pooled for optimal performance
- **Query Optimization**: All database queries are optimized with proper indexing
- **Memory Management**: Efficient memory usage with proper cleanup on shutdown
- **Error Handling**: Comprehensive error handling with graceful degradation

## Security

- **Input Validation**: All inputs are validated using Zod schemas
- **SQL Injection Prevention**: Parameterized queries prevent SQL injection
- **Environment Variables**: Sensitive configuration stored in environment variables
- **Connection Security**: Secure database connections with proper authentication

## Future Enhancements

- **Machine Learning**: Advanced prediction models for completion times
- **Real-time Updates**: WebSocket support for real-time workflow updates
- **Advanced Analytics**: More sophisticated performance metrics and insights
- **Integration APIs**: REST API endpoints for external system integration
- **Notification System**: Automated alerts for bottlenecks and delays

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with comprehensive tests
4. Submit a pull request with detailed description

## License

This project is part of the Nanopore Tracking Application suite. 