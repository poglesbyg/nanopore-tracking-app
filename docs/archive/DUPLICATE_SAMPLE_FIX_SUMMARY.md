# Duplicate Sample Fix Summary

## Issue Resolved
Fixed duplicate sample functionality that was failing with 400 Bad Request errors due to undefined required fields (`submitterName`, `submitterEmail`, `sampleType`, `chartField`).

## Root Cause Analysis
The duplicate sample feature was not properly mapping the required fields from the original sample to the new sample object. The issues were:

1. **Incorrect Field Mapping**: Using `sample.sample_name` instead of handling both snake_case and camelCase field names
2. **Incomplete Data Transfer**: Only copying some fields and not ensuring all required fields were properly mapped
3. **Missing Field Validation**: Not handling the database field naming inconsistencies (snake_case vs camelCase)

## Original Error
```javascript
TRPCClientError: [
  {
    "code": "invalid_type",
    "expected": "string", 
    "received": "undefined",
    "path": ["submitterName"],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined", 
    "path": ["submitterEmail"],
    "message": "Required"
  },
  {
    "expected": "'DNA' | 'RNA' | 'Protein' | 'Other'",
    "received": "undefined",
    "code": "invalid_type",
    "path": ["sampleType"],
    "message": "This field is required"
  },
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["chartField"], 
    "message": "Required"
  }
]
```

## Solution Implemented

### Before (Problematic Code)
```javascript
case 'duplicate_sample':
  const duplicateData = {
    ...sample,
    sampleName: `${sample.sample_name}_copy`,
    status: 'submitted' as const,
    submittedAt: new Date().toISOString()
  }
  await createSampleMutation.mutateAsync(duplicateData)
```

### After (Fixed Code)
```javascript
case 'duplicate_sample':
  // Create a duplicate sample with all required fields properly mapped
  const duplicateData = {
    sampleName: `${sample.sample_name || sample.sampleName}_copy`,
    projectId: sample.project_id || sample.projectId,
    submitterName: sample.submitter_name || sample.submitterName,
    submitterEmail: sample.submitter_email || sample.submitterEmail,
    labName: sample.lab_name || sample.labName,
    sampleType: sample.sample_type || sample.sampleType,
    sampleBuffer: sample.sample_buffer || sample.sampleBuffer,
    concentration: sample.concentration,
    volume: sample.volume,
    totalAmount: sample.total_amount || sample.totalAmount,
    flowCellType: sample.flow_cell_type || sample.flowCellType,
    flowCellCount: sample.flow_cell_count || sample.flowCellCount || 1,
    priority: sample.priority || 'normal',
    chartField: sample.chart_field || sample.chartField,
    specialInstructions: sample.special_instructions || sample.specialInstructions,
    status: 'submitted' as const
  }
  
  console.log('Duplicating sample with data:', duplicateData)
  console.log('Original sample:', sample)
  
  await createSampleMutation.mutateAsync(duplicateData)
```

## Key Improvements

### 1. Field Name Compatibility
- **Problem**: Database returns snake_case field names but API expects camelCase
- **Solution**: Handle both naming conventions using fallback pattern `sample.snake_case || sample.camelCase`

### 2. Complete Field Mapping
- **Problem**: Only copying partial data, missing required fields
- **Solution**: Explicitly map all required and optional fields to ensure completeness

### 3. Default Values
- **Problem**: Missing default values for optional fields
- **Solution**: Provide sensible defaults (e.g., `flowCellCount: 1`, `priority: 'normal'`)

### 4. Debug Logging
- **Problem**: No visibility into what data was being sent
- **Solution**: Added console logging to track original sample and duplicate data

## Fields Mapped
| Field | Required | Fallback Pattern |
|-------|----------|------------------|
| `sampleName` | ✅ | `sample_name \|\| sampleName` + `_copy` |
| `submitterName` | ✅ | `submitter_name \|\| submitterName` |
| `submitterEmail` | ✅ | `submitter_email \|\| submitterEmail` |
| `sampleType` | ✅ | `sample_type \|\| sampleType` |
| `chartField` | ✅ | `chart_field \|\| chartField` |
| `projectId` | ❌ | `project_id \|\| projectId` |
| `labName` | ❌ | `lab_name \|\| labName` |
| `concentration` | ❌ | Direct copy |
| `volume` | ❌ | Direct copy |
| `flowCellType` | ❌ | `flow_cell_type \|\| flowCellType` |
| `priority` | ❌ | Default: `'normal'` |

## Deployment Details
- **Build**: nanopore-tracking-app-12
- **Status**: Successfully deployed
- **Pods**: 2/2 running
- **File Modified**: `src/components/nanopore/nanopore-dashboard.tsx`

## Testing Instructions
1. Navigate to the application: https://nanopore-tracking-dept-barc.apps.cloudapps.unc.edu/
2. Find an existing sample in the dashboard
3. Click the three-dot menu for the sample
4. Select "Duplicate Sample"
5. **Expected Result**: 
   - Success message: "Sample duplicated"
   - New sample appears in the list with "_copy" suffix
   - All required fields properly populated
   - No 400 Bad Request errors

## Verification
The fix addresses the root cause by ensuring:
- ✅ All required fields are properly mapped from original to duplicate
- ✅ Field naming inconsistencies are handled gracefully
- ✅ Default values are provided where appropriate
- ✅ Debug logging helps with future troubleshooting

The duplicate sample feature should now work correctly without validation errors. 