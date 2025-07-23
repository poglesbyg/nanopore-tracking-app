import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Progress } from '../ui/progress';
import { useMCPTools } from '../../hooks/useMCPTools';
import { 
  Lightbulb, 
  Zap, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Star,
  Beaker,
  TrendingUp,
  Info
} from 'lucide-react';

interface ProtocolRecommendationWidgetProps {
  sampleData?: {
    sample_type: 'DNA' | 'RNA' | 'Protein' | 'Other';
    concentration?: number;
    volume?: number;
    flow_cell_type?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    special_instructions?: string;
  };
  targetApplication?: string;
  onProtocolSelected?: (protocol: any) => void;
  className?: string;
}

export function ProtocolRecommendationWidget({
  sampleData,
  targetApplication = 'genome sequencing',
  onProtocolSelected,
  className = ''
}: ProtocolRecommendationWidgetProps) {
  const { analyzeProtocolRecommendation, isLoading, error } = useMCPTools();
  const [recommendations, setRecommendations] = useState<any>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-analyze when sample data changes
  useEffect(() => {
    if (sampleData?.sample_type) {
      analyzeProtocol();
    }
  }, [sampleData]);

  const analyzeProtocol = async () => {
    if (!sampleData?.sample_type) return;

    try {
      const params = {
        sample_type: sampleData.sample_type,
        sample_concentration: sampleData.concentration,
        sample_volume: sampleData.volume,
        target_application: targetApplication,
        budget_level: 'medium' as const,
        timeline: sampleData.priority === 'urgent' ? 'urgent' as const : 'standard' as const,
        special_requirements: sampleData.special_instructions ? [sampleData.special_instructions] : []
      };

      const result = await analyzeProtocolRecommendation(params);
      setRecommendations(result);
      
      // Auto-select the top recommendation
      if (result.recommendations && result.recommendations.length > 0) {
        setSelectedProtocol(result.recommendations[0]);
      }
    } catch (err) {
      console.error('Failed to analyze protocol:', err);
    }
  };

  const handleProtocolSelect = (protocol: any) => {
    setSelectedProtocol(protocol);
    onProtocolSelected?.(protocol);
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!sampleData?.sample_type) {
    return (
      <Card className={`${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            Protocol Recommendations
          </CardTitle>
          <CardDescription>
            Add sample information to get intelligent protocol recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Beaker className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Sample data required for protocol analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          Protocol Recommendations
          {recommendations?.summary?.top_recommendation && (
            <Badge variant="outline" className="ml-auto">
              {recommendations.recommendations.length} protocols found
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          AI-powered protocol suggestions based on your sample characteristics
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
            <span>Failed to get protocol recommendations: {error}</span>
          </div>
        )}

        {recommendations && !isLoading && (
          <>
            {/* Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Top Recommendation</span>
              </div>
              <p className="text-blue-800 font-medium">
                {recommendations.summary.top_recommendation}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-blue-700">
                <span>Prep Time: {recommendations.summary.estimated_prep_time}</span>
                <span>Est. Yield: {recommendations.summary.estimated_yield}</span>
              </div>
            </div>

            {/* Protocol Options */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Beaker className="h-4 w-4" />
                Available Protocols
              </h4>
              
              {recommendations.recommendations.map((protocol: any, index: number) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProtocol?.protocol_name === protocol.protocol_name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleProtocolSelect(protocol)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="font-medium">{protocol.protocol_name}</h5>
                      <p className="text-sm text-gray-600">{protocol.protocol_version}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${getScoreColor(protocol.suitability_score)}`}>
                        {protocol.suitability_score}%
                      </span>
                      <Badge className={getDifficultyColor(protocol.difficulty_level)}>
                        {protocol.difficulty_level}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span>{protocol.preparation_time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-gray-500" />
                      <span>{protocol.estimated_yield}</span>
                    </div>
                  </div>

                  <Progress value={protocol.suitability_score} className="mb-2" />

                  {protocol.warnings && protocol.warnings.length > 0 && (
                    <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 rounded">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <strong>Warnings:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {protocol.warnings.map((warning: string, i: number) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Selected Protocol Details */}
            {selectedProtocol && (
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDetails(!showDetails)}
                  className="mb-3"
                >
                  <Info className="h-4 w-4 mr-2" />
                  {showDetails ? 'Hide' : 'Show'} Protocol Details
                </Button>

                {showDetails && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    {selectedProtocol.special_requirements && (
                      <div>
                        <h6 className="font-medium mb-2">Special Requirements</h6>
                        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                          {selectedProtocol.special_requirements.map((req: string, i: number) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedProtocol.optimization_tips && (
                      <div>
                        <h6 className="font-medium mb-2 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          Optimization Tips
                        </h6>
                        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                          {selectedProtocol.optimization_tips.map((tip: string, i: number) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <h6 className="font-medium mb-2">Expected Results</h6>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Read Length:</span>
                          <span className="ml-2 font-medium">{selectedProtocol.estimated_read_length}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Kit:</span>
                          <span className="ml-2 font-medium">{selectedProtocol.recommended_kit}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expert Notes */}
            {recommendations.expert_notes && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-900">Expert Notes</span>
                </div>
                <ul className="text-sm text-green-800 space-y-1">
                  {recommendations.expert_notes.map((note: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-1">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={analyzeProtocol}
                variant="outline"
                size="sm"
              >
                <Zap className="h-4 w-4 mr-2" />
                Re-analyze
              </Button>
              
              {selectedProtocol && onProtocolSelected && (
                <Button 
                  onClick={() => onProtocolSelected(selectedProtocol)}
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Use This Protocol
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 