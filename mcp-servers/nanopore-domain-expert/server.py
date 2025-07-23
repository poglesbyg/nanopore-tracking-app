"""
Nanopore Domain Expert MCP Server

Provides specialized tools for nanopore sequencing validation,
recommendations, and quality control analysis.
"""

import json
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

# MCP SDK imports (placeholder - actual imports depend on MCP Python SDK)
from mcp import Server, Tool, ToolResult


class FlowCellType(Enum):
    R9_4_1 = "R9.4.1"
    R10_4_1 = "R10.4.1"
    R10_5_1 = "R10.5.1"
    FLONGLE = "Flongle"


class SampleType(Enum):
    GENOMIC_DNA = "Genomic DNA"
    PLASMID = "Plasmid"
    AMPLICON = "Amplicon"
    RNA = "RNA"
    CDNA = "cDNA"


@dataclass
class ValidationResult:
    """Result of sample parameter validation"""
    is_valid: bool
    score: float  # 0.0 to 1.0
    issues: List[str]
    warnings: List[str]
    recommendations: List[str]


@dataclass
class FlowCellRecommendation:
    """Recommended flow cell configuration"""
    primary_choice: str
    alternatives: List[str]
    reasoning: str
    expected_yield: float
    estimated_runtime: float
    cost_efficiency_score: float


@dataclass
class QCInsight:
    """Quality control insights"""
    overall_quality: str  # "Excellent", "Good", "Fair", "Poor"
    confidence: float
    key_metrics: Dict[str, Any]
    issues_detected: List[str]
    recommendations: List[str]
    historical_comparison: Optional[Dict[str, Any]]


class NanoporeDomainExpertServer:
    """MCP Server providing nanopore sequencing domain expertise"""
    
    def __init__(self):
        self.server = Server("nanopore-domain-expert")
        self._register_tools()
        
        # Domain knowledge bases
        self.concentration_ranges = {
            SampleType.GENOMIC_DNA: (20.0, 200.0),  # ng/μL
            SampleType.PLASMID: (50.0, 500.0),
            SampleType.AMPLICON: (10.0, 100.0),
            SampleType.RNA: (100.0, 1000.0),
            SampleType.CDNA: (50.0, 300.0),
        }
        
        self.purity_thresholds = {
            "A260/A280": (1.8, 2.0),  # DNA
            "A260/A280_RNA": (2.0, 2.2),  # RNA
            "A260/A230": (2.0, 2.2),  # Both
        }
        
        self.flow_cell_specs = {
            FlowCellType.R9_4_1: {
                "max_output": 30,  # Gb
                "read_length": "Long",
                "accuracy": 0.95,
                "cost": 900,
            },
            FlowCellType.R10_4_1: {
                "max_output": 50,
                "read_length": "Ultra-long",
                "accuracy": 0.98,
                "cost": 900,
            },
            FlowCellType.R10_5_1: {
                "max_output": 60,
                "read_length": "Ultra-long",
                "accuracy": 0.99,
                "cost": 1200,
            },
            FlowCellType.FLONGLE: {
                "max_output": 2,
                "read_length": "Moderate",
                "accuracy": 0.95,
                "cost": 90,
            },
        }
    
    def _register_tools(self):
        """Register all available tools with the MCP server"""
        
        @self.server.tool("validate_sample_parameters")
        async def validate_sample_parameters(
            concentration: float,
            volume: float,
            purity_ratio: float,
            fragment_size: int,
            sample_type: str
        ) -> ToolResult:
            """Validate sample parameters against best practices"""
            result = self._validate_sample(
                concentration, volume, purity_ratio, fragment_size, sample_type
            )
            return ToolResult(success=True, data=result.__dict__)
        
        @self.server.tool("recommend_flow_cell")
        async def recommend_flow_cell(
            sample_type: str,
            expected_yield: float,
            read_length_target: int,
            budget_constraint: Optional[float] = None
        ) -> ToolResult:
            """Suggest optimal flow cell based on sample characteristics"""
            recommendation = self._recommend_flow_cell(
                sample_type, expected_yield, read_length_target, budget_constraint
            )
            return ToolResult(success=True, data=recommendation.__dict__)
        
        @self.server.tool("predict_sequencing_outcome")
        async def predict_sequencing_outcome(
            sample_metrics: Dict[str, Any],
            flow_cell_type: str,
            environmental_conditions: Optional[Dict[str, Any]] = None
        ) -> ToolResult:
            """Predict sequencing run duration and success probability"""
            prediction = self._predict_outcome(
                sample_metrics, flow_cell_type, environmental_conditions
            )
            return ToolResult(success=True, data=prediction)
        
        @self.server.tool("generate_qc_insights")
        async def generate_qc_insights(
            qc_data: Dict[str, Any],
            historical_data: Optional[List[Dict[str, Any]]] = None
        ) -> ToolResult:
            """Generate QC report with insights and recommendations"""
            insights = self._analyze_qc_data(qc_data, historical_data)
            return ToolResult(success=True, data=insights.__dict__)
    
    def _validate_sample(
        self,
        concentration: float,
        volume: float,
        purity_ratio: float,
        fragment_size: int,
        sample_type: str
    ) -> ValidationResult:
        """Validate sample parameters"""
        issues = []
        warnings = []
        recommendations = []
        score = 1.0
        
        # Parse sample type
        try:
            sample_type_enum = SampleType(sample_type)
        except ValueError:
            sample_type_enum = SampleType.GENOMIC_DNA
            warnings.append(f"Unknown sample type '{sample_type}', using Genomic DNA defaults")
        
        # Validate concentration
        min_conc, max_conc = self.concentration_ranges[sample_type_enum]
        if concentration < min_conc:
            issues.append(f"Concentration {concentration} ng/μL is below minimum {min_conc} ng/μL")
            score *= 0.7
            recommendations.append(f"Consider concentrating the sample to at least {min_conc} ng/μL")
        elif concentration > max_conc:
            warnings.append(f"Concentration {concentration} ng/μL exceeds typical range")
            recommendations.append("Consider diluting the sample to avoid overloading")
        
        # Validate volume
        total_amount = concentration * volume
        if total_amount < 100:  # ng
            issues.append(f"Total amount {total_amount:.1f} ng may be insufficient")
            score *= 0.8
            recommendations.append("Increase sample volume or concentration")
        
        # Validate purity
        if sample_type_enum in [SampleType.GENOMIC_DNA, SampleType.PLASMID]:
            min_purity, max_purity = self.purity_thresholds["A260/A280"]
        else:
            min_purity, max_purity = self.purity_thresholds["A260/A280_RNA"]
        
        if purity_ratio < min_purity or purity_ratio > max_purity:
            warnings.append(f"Purity ratio {purity_ratio} is outside optimal range {min_purity}-{max_purity}")
            score *= 0.9
            recommendations.append("Consider additional purification steps")
        
        # Validate fragment size
        if sample_type_enum == SampleType.GENOMIC_DNA and fragment_size < 10000:
            warnings.append("Fragment size may be suboptimal for long-read sequencing")
            recommendations.append("Consider using gentler extraction methods")
        
        return ValidationResult(
            is_valid=len(issues) == 0,
            score=max(0.0, score),
            issues=issues,
            warnings=warnings,
            recommendations=recommendations
        )
    
    def _recommend_flow_cell(
        self,
        sample_type: str,
        expected_yield: float,  # Gb
        read_length_target: int,  # bp
        budget_constraint: Optional[float] = None
    ) -> FlowCellRecommendation:
        """Recommend optimal flow cell type"""
        
        recommendations = []
        
        # Score each flow cell type
        for fc_type, specs in self.flow_cell_specs.items():
            score = 0.0
            
            # Yield compatibility
            if specs["max_output"] >= expected_yield:
                score += 0.4
            else:
                score += 0.4 * (expected_yield / specs["max_output"])
            
            # Read length compatibility
            if read_length_target > 50000 and specs["read_length"] == "Ultra-long":
                score += 0.3
            elif read_length_target > 10000 and specs["read_length"] in ["Long", "Ultra-long"]:
                score += 0.2
            else:
                score += 0.1
            
            # Accuracy bonus
            score += specs["accuracy"] * 0.2
            
            # Budget compatibility
            if budget_constraint:
                if specs["cost"] <= budget_constraint:
                    score += 0.1
                else:
                    score *= 0.5  # Penalty for exceeding budget
            
            recommendations.append((fc_type, score, specs))
        
        # Sort by score
        recommendations.sort(key=lambda x: x[1], reverse=True)
        best = recommendations[0]
        
        # Calculate runtime estimate
        if best[0] == FlowCellType.FLONGLE:
            runtime = 24  # hours
        else:
            runtime = 48  # hours
        
        reasoning = self._generate_flow_cell_reasoning(
            best[0], sample_type, expected_yield, read_length_target
        )
        
        return FlowCellRecommendation(
            primary_choice=best[0].value,
            alternatives=[r[0].value for r in recommendations[1:3]],
            reasoning=reasoning,
            expected_yield=min(expected_yield, best[2]["max_output"]),
            estimated_runtime=runtime,
            cost_efficiency_score=best[1]
        )
    
    def _generate_flow_cell_reasoning(
        self,
        flow_cell: FlowCellType,
        sample_type: str,
        expected_yield: float,
        read_length_target: int
    ) -> str:
        """Generate reasoning for flow cell recommendation"""
        reasons = []
        
        specs = self.flow_cell_specs[flow_cell]
        
        if specs["max_output"] >= expected_yield:
            reasons.append(f"Provides sufficient output capacity ({specs['max_output']} Gb)")
        
        if read_length_target > 50000 and specs["read_length"] == "Ultra-long":
            reasons.append("Excellent for ultra-long read requirements")
        
        if flow_cell == FlowCellType.R10_5_1:
            reasons.append("Latest chemistry with highest accuracy (99%)")
        elif flow_cell == FlowCellType.FLONGLE:
            reasons.append("Cost-effective for small-scale projects")
        
        return ". ".join(reasons)
    
    def _predict_outcome(
        self,
        sample_metrics: Dict[str, Any],
        flow_cell_type: str,
        environmental_conditions: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Predict sequencing outcome"""
        
        # Base success probability
        success_prob = 0.85
        
        # Adjust based on sample quality
        if sample_metrics.get("concentration", 0) < 20:
            success_prob *= 0.8
        if sample_metrics.get("purity_ratio", 1.8) < 1.7:
            success_prob *= 0.9
        
        # Environmental factors
        if environmental_conditions:
            temp = environmental_conditions.get("temperature", 20)
            if temp < 18 or temp > 25:
                success_prob *= 0.95
        
        # Runtime estimation
        if flow_cell_type == "Flongle":
            base_runtime = 24
        else:
            base_runtime = 48
        
        # Adjust runtime based on quality
        runtime_multiplier = 1.0
        if success_prob < 0.7:
            runtime_multiplier = 1.2
        
        return {
            "success_probability": round(success_prob, 2),
            "estimated_runtime_hours": base_runtime * runtime_multiplier,
            "expected_reads": self._estimate_reads(sample_metrics, flow_cell_type),
            "quality_warnings": self._generate_quality_warnings(sample_metrics),
            "optimization_suggestions": [
                "Ensure consistent temperature during run",
                "Monitor pore availability throughout sequencing",
                "Consider adaptive sampling for targeted regions"
            ]
        }
    
    def _estimate_reads(
        self,
        sample_metrics: Dict[str, Any],
        flow_cell_type: str
    ) -> int:
        """Estimate number of reads"""
        base_reads = {
            "R9.4.1": 2_000_000,
            "R10.4.1": 3_000_000,
            "R10.5.1": 4_000_000,
            "Flongle": 200_000,
        }
        
        reads = base_reads.get(flow_cell_type, 2_000_000)
        
        # Adjust based on sample quality
        quality_factor = min(1.0, sample_metrics.get("concentration", 50) / 50)
        
        return int(reads * quality_factor)
    
    def _generate_quality_warnings(self, sample_metrics: Dict[str, Any]) -> List[str]:
        """Generate quality-based warnings"""
        warnings = []
        
        if sample_metrics.get("concentration", 0) < 30:
            warnings.append("Low concentration may affect sequencing efficiency")
        
        if sample_metrics.get("fragment_size", 0) < 5000:
            warnings.append("Short fragments may reduce read length potential")
        
        return warnings
    
    def _analyze_qc_data(
        self,
        qc_data: Dict[str, Any],
        historical_data: Optional[List[Dict[str, Any]]] = None
    ) -> QCInsight:
        """Analyze QC data and generate insights"""
        
        # Calculate overall quality score
        quality_score = 0.0
        key_metrics = {}
        issues = []
        recommendations = []
        
        # Analyze read metrics
        n50 = qc_data.get("n50", 0)
        mean_quality = qc_data.get("mean_quality", 0)
        total_bases = qc_data.get("total_bases", 0)
        
        # N50 analysis
        if n50 > 20000:
            quality_score += 0.3
            key_metrics["n50_assessment"] = "Excellent"
        elif n50 > 10000:
            quality_score += 0.2
            key_metrics["n50_assessment"] = "Good"
        else:
            quality_score += 0.1
            key_metrics["n50_assessment"] = "Poor"
            issues.append("N50 below expected range")
            recommendations.append("Check sample integrity and library preparation")
        
        # Quality score analysis
        if mean_quality > 12:
            quality_score += 0.3
            key_metrics["quality_assessment"] = "High"
        elif mean_quality > 9:
            quality_score += 0.2
            key_metrics["quality_assessment"] = "Moderate"
        else:
            quality_score += 0.1
            key_metrics["quality_assessment"] = "Low"
            issues.append("Mean quality score below Q9")
            recommendations.append("Review basecalling parameters")
        
        # Output analysis
        if total_bases > 10_000_000_000:  # 10 Gb
            quality_score += 0.4
            key_metrics["output_assessment"] = "High yield"
        elif total_bases > 5_000_000_000:  # 5 Gb
            quality_score += 0.3
            key_metrics["output_assessment"] = "Moderate yield"
        else:
            quality_score += 0.1
            key_metrics["output_assessment"] = "Low yield"
            issues.append("Total output below expectations")
            recommendations.append("Check flow cell health and sample loading")
        
        # Historical comparison
        historical_comparison = None
        if historical_data:
            historical_comparison = self._compare_to_historical(qc_data, historical_data)
        
        # Determine overall quality
        if quality_score >= 0.8:
            overall_quality = "Excellent"
        elif quality_score >= 0.6:
            overall_quality = "Good"
        elif quality_score >= 0.4:
            overall_quality = "Fair"
        else:
            overall_quality = "Poor"
        
        return QCInsight(
            overall_quality=overall_quality,
            confidence=min(1.0, quality_score + 0.2),  # Add confidence buffer
            key_metrics=key_metrics,
            issues_detected=issues,
            recommendations=recommendations,
            historical_comparison=historical_comparison
        )
    
    def _compare_to_historical(
        self,
        current: Dict[str, Any],
        historical: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Compare current QC to historical data"""
        
        # Calculate historical averages
        avg_n50 = sum(h.get("n50", 0) for h in historical) / len(historical)
        avg_quality = sum(h.get("mean_quality", 0) for h in historical) / len(historical)
        
        return {
            "n50_percentile": self._calculate_percentile(
                current.get("n50", 0),
                [h.get("n50", 0) for h in historical]
            ),
            "quality_percentile": self._calculate_percentile(
                current.get("mean_quality", 0),
                [h.get("mean_quality", 0) for h in historical]
            ),
            "trend": "improving" if current.get("n50", 0) > avg_n50 else "declining"
        }
    
    def _calculate_percentile(self, value: float, historical: List[float]) -> float:
        """Calculate percentile of value in historical data"""
        sorted_hist = sorted(historical)
        below = sum(1 for h in sorted_hist if h < value)
        return (below / len(sorted_hist)) * 100
    
    def run(self):
        """Start the MCP server"""
        self.server.run()


if __name__ == "__main__":
    server = NanoporeDomainExpertServer()
    server.run() 