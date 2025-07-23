import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { useMCPTools } from '../../hooks/useMCPTools';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  TrendingUp,
  Microscope,
  Target,
  Zap,
  Info,
  RefreshCw
} from 'lucide-react';

interface QualityAssessmentPanelProps {
  sampleData?: {
    id?: string;
    sample_type: 'DNA' | 'RNA' | 'Protein' | 'Other';
    concentration?: number;
    volume?: number;
    flow_cell_type?: string;
    metadata?: any;
  };
  qualityMetrics?: {
    concentration?: number;
    volume?: number;
    purity_260_280?: number;
    purity_260_230?: number;
    dna_integrity_number?: number;
    fragment_size_distribution?: string;
    contamination_level?: 'none' | 'low' | 'medium' | 'high';
  };
  intendedApplication?: string;
  onAssessmentComplete?: (assessment: any) => void;
  className?: string;
}

export function QualityAssessmentPanel({
  sampleData,
  qualityMetrics,
  intendedApplication = 'genome sequencing',
  onAssessmentComplete,
  className = ''
}: QualityAssessmentPanelProps) {
  const { assessSampleQuality, isLoading, error } = useMCPTools();
  const [assessment, setAssessment] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-assess when data changes
  useEffect(() => {
    if (sampleData?.sample_type && qualityMetrics) {
      performAssessment();
    }
  }, [sampleData, qualityMetrics]);

  const performAssessment = async () => {
    if (!sampleData?.sample_type || !qualityMetrics) return;

    try {
      const params = {
        sample_id: sampleData.id,
        quality_metrics: qualityMetrics,
        sample_type: sampleData.sample_type,
        intended_application: intendedApplication,
        flow_cell_type: sampleData.flow_cell_type as any
      };

      const result = await assessSampleQuality(params);
      setAssessment(result);
      onAssessmentComplete?.(result);
    } catch (err) {
      console.error('Failed to assess quality:', err);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'acceptable': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-orange-600 bg-orange-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getGradeIcon = (grade: string) => {
    switch (grade) {
      case 'excellent':
      case 'good':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'acceptable':
        return <AlertTriangle className="h-4 w-4" />;
      case 'poor':
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSuccessProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'text-green-600';
    if (probability >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!sampleData?.sample_type || !qualityMetrics) {
    return (
      <Card className={`${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-purple-600" />
            Quality Assessment
          </CardTitle>
          <CardDescription>
            Add sample data and quality metrics for intelligent assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Quality metrics required for assessment</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Microscope className="h-5 w-5 text-purple-600" />
          Quality Assessment
          {assessment && (
            <Badge className={`ml-auto ${getGradeColor(assessment.quality_grade)}`}>
              {getGradeIcon(assessment.quality_grade)}
              <span className="ml-1">{assessment.quality_grade.toUpperCase()}</span>
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          AI-powered quality analysis with success probability prediction
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
            <AlertTriangle className="h-4 w-4" />
            <span>Failed to assess quality: {error}</span>
          </div>
        )}

        {assessment && !isLoading && (
          <>
            {/* Overall Score */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-purple-900">Overall Quality Score</span>
                <span className="text-2xl font-bold text-purple-800">
                  {assessment.overall_score}/100
                </span>
              </div>
              <Progress value={assessment.overall_score} className="mb-2" />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-purple-600" />
                  <span className="text-purple-700">
                    Success Probability: 
                    <span className={`ml-1 font-medium ${getSuccessProbabilityColor(assessment.estimated_success_probability)}`}>
                      {assessment.estimated_success_probability}%
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Critical Issues */}
            {assessment.critical_issues && assessment.critical_issues.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-900">Critical Issues</span>
                  <Badge variant="destructive" className="ml-auto">
                    {assessment.critical_issues.length}
                  </Badge>
                </div>
                <ul className="text-sm text-red-800 space-y-1">
                  {assessment.critical_issues.map((issue: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {assessment.warnings && assessment.warnings.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-900">Warnings</span>
                  <Badge variant="secondary" className="ml-auto bg-yellow-200 text-yellow-800">
                    {assessment.warnings.length}
                  </Badge>
                </div>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {assessment.warnings.map((warning: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-600 mt-1">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {assessment.recommendations && assessment.recommendations.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Recommendations</span>
                </div>
                <ul className="text-sm text-blue-800 space-y-1">
                  {assessment.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quality Metrics Details */}
            <div className="border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDetails(!showDetails)}
                className="mb-3"
              >
                <Info className="h-4 w-4 mr-2" />
                {showDetails ? 'Hide' : 'Show'} Quality Metrics
              </Button>

              {showDetails && (
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    {qualityMetrics.concentration && (
                      <div>
                        <span className="text-sm text-gray-600">Concentration</span>
                        <div className="font-medium">{qualityMetrics.concentration} ng/μL</div>
                      </div>
                    )}
                    
                    {qualityMetrics.volume && (
                      <div>
                        <span className="text-sm text-gray-600">Volume</span>
                        <div className="font-medium">{qualityMetrics.volume} μL</div>
                      </div>
                    )}
                    
                    {qualityMetrics.purity_260_280 && (
                      <div>
                        <span className="text-sm text-gray-600">Purity (260/280)</span>
                        <div className="font-medium">{qualityMetrics.purity_260_280}</div>
                      </div>
                    )}
                    
                    {qualityMetrics.purity_260_230 && (
                      <div>
                        <span className="text-sm text-gray-600">Purity (260/230)</span>
                        <div className="font-medium">{qualityMetrics.purity_260_230}</div>
                      </div>
                    )}
                    
                    {qualityMetrics.dna_integrity_number && (
                      <div>
                        <span className="text-sm text-gray-600">DNA Integrity (DIN)</span>
                        <div className="font-medium">{qualityMetrics.dna_integrity_number}</div>
                      </div>
                    )}
                    
                    {qualityMetrics.contamination_level && (
                      <div>
                        <span className="text-sm text-gray-600">Contamination Level</span>
                        <Badge 
                          variant={qualityMetrics.contamination_level === 'none' ? 'default' : 'destructive'}
                          className="mt-1"
                        >
                          {qualityMetrics.contamination_level}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {qualityMetrics.fragment_size_distribution && (
                    <div>
                      <span className="text-sm text-gray-600">Fragment Size Distribution</span>
                      <div className="font-medium">{qualityMetrics.fragment_size_distribution}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Suggested Modifications */}
            {assessment.suggested_modifications && assessment.suggested_modifications.length > 0 && (
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-900">Suggested Modifications</span>
                </div>
                <ul className="text-sm text-orange-800 space-y-1">
                  {assessment.suggested_modifications.map((mod: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-600 mt-1">•</span>
                      <span>{mod}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={performAssessment}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-assess
              </Button>
              
              {assessment.quality_grade !== 'failed' && (
                <Button 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Proceed with Sequencing
                </Button>
              )}
              
              {assessment.quality_grade === 'failed' && (
                <Button 
                  size="sm"
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Sample Requires Improvement
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 