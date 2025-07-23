import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ProtocolRecommendationWidget } from './protocol-recommendation-widget';
import { QualityAssessmentPanel } from './quality-assessment-panel';
import { useMCPTools } from '../../hooks/useMCPTools';
import { trpc } from '@/client/trpc';
import { 
  Brain, 
  Lightbulb, 
  Microscope, 
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Activity,
  CheckCircle,
  Zap,
  HelpCircle,
  Settings
} from 'lucide-react';

interface MCPEnhancedDashboardProps {
  submissionId?: string;
  sampleData?: any;
  className?: string;
}

export function MCPEnhancedDashboard({
  submissionId,
  sampleData,
  className = ''
}: MCPEnhancedDashboardProps) {
  const [activeTab, setActiveTab] = useState('protocol');
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [workflowAnalysis, setWorkflowAnalysis] = useState<any>(null);
  const [troubleshootingMode, setTroubleshootingMode] = useState(false);
  
  const { 
    analyzeWorkflowPerformance, 
    troubleshootSequencingIssue,
    optimizeSequencingWorkflow,
    getNanoporeBestPractices,
    isLoading 
  } = useMCPTools();

  // Get submission data if submissionId is provided
  const { data: submission } = trpc.nanoporeSubmission.getWithSamples.useQuery(
    { id: submissionId! },
    { enabled: !!submissionId }
  );

  // Use either provided sample data or first sample from submission
  const currentSample = sampleData || (submission?.samples && submission.samples[0]);

  useEffect(() => {
    if (currentSample) {
      setSelectedSample(currentSample);
    }
  }, [currentSample]);

  // Auto-analyze workflow performance
  useEffect(() => {
    analyzeWorkflow();
  }, []);

  const analyzeWorkflow = async () => {
    try {
      const analysis = await analyzeWorkflowPerformance({
        time_period: 'week',
        sample_types: ['DNA', 'RNA'],
        include_bottlenecks: true
      });
      setWorkflowAnalysis(analysis);
    } catch (error) {
      console.error('Failed to analyze workflow:', error);
    }
  };

  const handleTroubleshooting = async (issueDescription: string, symptoms: string[]) => {
    try {
      await troubleshootSequencingIssue({
        issue_description: issueDescription,
        workflow_stage: 'library_preparation',
        observed_symptoms: symptoms,
        sample_type: selectedSample?.sample_type
      });
    } catch (error) {
      console.error('Failed to get troubleshooting help:', error);
    }
  };

  // Mock quality metrics for demonstration
  const mockQualityMetrics = selectedSample ? {
    concentration: selectedSample.concentration || 75,
    volume: selectedSample.volume || 50,
    purity_260_280: 1.85,
    purity_260_230: 2.1,
    dna_integrity_number: 8.2,
    contamination_level: 'low' as const
  } : undefined;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* MCP Intelligence Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" />
            AI-Powered Laboratory Intelligence
            <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-800">
              MCP Enabled
            </Badge>
          </CardTitle>
          <CardDescription>
            Intelligent assistance powered by Nanopore Domain Expert and Sample Management MCP servers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <Lightbulb className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="font-medium">Protocol Recommendations</div>
                <div className="text-sm text-gray-600">AI-powered protocol selection</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <Microscope className="h-8 w-8 text-purple-500" />
              <div>
                <div className="font-medium">Quality Assessment</div>
                <div className="text-sm text-gray-600">Intelligent quality analysis</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <div className="font-medium">Workflow Optimization</div>
                <div className="text-sm text-gray-600">Performance insights</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Performance Summary */}
      {workflowAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Workflow Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {workflowAnalysis.performance_metrics?.total_samples_processed || 45}
                </div>
                <div className="text-sm text-gray-600">Samples Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {workflowAnalysis.performance_metrics?.completion_rate || 92.3}%
                </div>
                <div className="text-sm text-gray-600">Completion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {workflowAnalysis.performance_metrics?.average_processing_time_hours || 72}h
                </div>
                <div className="text-sm text-gray-600">Avg Processing Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {workflowAnalysis.performance_metrics?.quality_pass_rate || 88.9}%
                </div>
                <div className="text-sm text-gray-600">Quality Pass Rate</div>
              </div>
            </div>

            {workflowAnalysis.bottlenecks && workflowAnalysis.bottlenecks.length > 0 && (
              <div className="mt-4 p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-900">Detected Bottlenecks</span>
                </div>
                {workflowAnalysis.bottlenecks.map((bottleneck: any, index: number) => (
                  <div key={index} className="text-sm text-orange-800">
                    <strong>{bottleneck.stage}:</strong> {bottleneck.average_delay_hours}h average delay 
                    ({bottleneck.affected_samples} samples affected)
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MCP Tools Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="protocol" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Protocols
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <Microscope className="h-4 w-4" />
            Quality
          </TabsTrigger>
          <TabsTrigger value="optimization" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Help
          </TabsTrigger>
        </TabsList>

        <TabsContent value="protocol" className="space-y-4">
          <ProtocolRecommendationWidget
            sampleData={selectedSample}
            targetApplication="genome sequencing"
            onProtocolSelected={(protocol) => {
              console.log('Protocol selected:', protocol);
              // Could integrate with sample workflow here
            }}
          />
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <QualityAssessmentPanel
            sampleData={selectedSample}
            qualityMetrics={mockQualityMetrics || {}}
            intendedApplication="genome sequencing"
            onAssessmentComplete={(assessment) => {
              console.log('Quality assessment complete:', assessment);
              // Could trigger workflow actions based on assessment
            }}
          />
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Workflow Optimization Suggestions
              </CardTitle>
              <CardDescription>
                AI-powered recommendations to improve laboratory efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-900">Quick Win</span>
                    <Badge className="bg-green-100 text-green-800">High Priority</Badge>
                  </div>
                  <p className="text-sm text-green-800 mb-2">
                    Implement batch processing for library preparation
                  </p>
                  <p className="text-xs text-green-700">
                    Expected improvement: 50-75% reduction in hands-on time
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Resource Optimization</span>
                    <Badge className="bg-blue-100 text-blue-800">Medium Priority</Badge>
                  </div>
                  <p className="text-sm text-blue-800 mb-2">
                    Optimize sample-to-operator assignments based on expertise
                  </p>
                  <p className="text-xs text-blue-700">
                    Expected improvement: 25% reduction in processing time
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium text-yellow-900">Schedule Optimization</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Long Term</Badge>
                  </div>
                  <p className="text-sm text-yellow-800 mb-2">
                    Implement predictive scheduling based on historical patterns
                  </p>
                  <p className="text-xs text-yellow-700">
                    Expected improvement: 15% increase in throughput
                  </p>
                </div>

                <Button 
                  onClick={() => {
                    optimizeSequencingWorkflow({
                      current_workflow: 'Standard nanopore sequencing workflow',
                      sample_types: ['DNA', 'RNA'],
                      optimization_goals: ['increase_throughput', 'improve_quality']
                    });
                  }}
                  className="w-full"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Get Detailed Optimization Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-orange-600" />
                Troubleshooting Assistant
              </CardTitle>
              <CardDescription>
                Get expert help with sequencing issues and problems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handleTroubleshooting(
                      'Low yield from library preparation',
                      ['Low library concentration', 'Poor size distribution']
                    )}
                    className="h-auto p-4 flex flex-col items-start"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Low Yield Issues</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      Get help with library preparation yield problems
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleTroubleshooting(
                      'Poor quality sequencing results',
                      ['High error rates', 'Short read lengths']
                    )}
                    className="h-auto p-4 flex flex-col items-start"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Microscope className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">Quality Issues</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      Diagnose sequencing quality problems
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => getNanoporeBestPractices({
                      expertise_area: 'sample_preparation',
                      experience_level: 'intermediate'
                    })}
                    className="h-auto p-4 flex flex-col items-start"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Best Practices</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      Get expert guidance and best practices
                    </span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      // Open custom troubleshooting form
                      setTroubleshootingMode(true);
                    }}
                    className="h-auto p-4 flex flex-col items-start"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Custom Issue</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      Describe a specific problem for expert help
                    </span>
                  </Button>
                </div>

                {troubleshootingMode && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Describe Your Issue</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      The AI troubleshooting assistant will analyze your problem and provide expert solutions.
                    </p>
                    <Button 
                      onClick={() => setTroubleshootingMode(false)}
                      variant="outline"
                      size="sm"
                    >
                      Close
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sample Context Info */}
      {selectedSample && (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-sm">Current Sample Context</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Sample:</span>
                <div className="font-medium">{selectedSample.sample_name}</div>
              </div>
              <div>
                <span className="text-gray-600">Type:</span>
                <div className="font-medium">{selectedSample.sample_type}</div>
              </div>
              <div>
                <span className="text-gray-600">Concentration:</span>
                <div className="font-medium">
                  {selectedSample.concentration ? `${selectedSample.concentration} ng/μL` : 'Not specified'}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Priority:</span>
                <Badge variant={selectedSample.priority === 'urgent' ? 'destructive' : 'secondary'}>
                  {selectedSample.priority}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 