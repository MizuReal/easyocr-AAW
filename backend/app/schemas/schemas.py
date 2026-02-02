from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, validator


class WaterSamplePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, validate_by_name=True)
    ph: Optional[float] = Field(None, alias="pH")
    hardness: Optional[float] = None
    solids: Optional[float] = None
    chloramines: Optional[float] = None
    sulfate: Optional[float] = None
    conductivity: Optional[float] = None
    organic_carbon: Optional[float] = Field(None, alias="organicCarbon")
    trihalomethanes: Optional[float] = None
    turbidity: Optional[float] = None
    free_chlorine_residual: Optional[float] = Field(None, alias="freeChlorineResidual")

    color: Optional[str] = None
    source: Optional[str] = None
    sample_label: Optional[str] = Field(None, alias="sampleLabel")
    user_id: Optional[str] = Field(None, alias="userId")
    notes: Optional[str] = None

    @validator(
        "color",
        "source",
        "sample_label",
        "user_id",
        "notes",
        pre=True,
        always=True,
    )
    def _empty_to_none(cls, value: Optional[str]) -> Optional[str]:  # noqa: N805
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    def feature_dict(self) -> Dict[str, Optional[float]]:
        return {
            "ph": self.ph,
            "hardness": self.hardness,
            "solids": self.solids,
            "chloramines": self.chloramines,
            "sulfate": self.sulfate,
            "conductivity": self.conductivity,
            "organic_carbon": self.organic_carbon,
            "trihalomethanes": self.trihalomethanes,
            "turbidity": self.turbidity,
            "free_chlorine_residual": self.free_chlorine_residual,
        }

    def meta_dict(self) -> Dict[str, Optional[str]]:
        return {
            "color": self.color,
            "source": self.source,
            "sample_label": self.sample_label,
            "user_id": self.user_id,
            "notes": self.notes,
        }


class ParameterCheck(BaseModel):
    model_config = ConfigDict(populate_by_name=True, validate_by_name=True)
    field: str
    label: str
    value: Optional[float]
    status: str
    detail: str
    z_score: Optional[float] = Field(None, alias="zScore")
    recommended_range: Optional[List[float]] = Field(None, alias="recommendedRange")


class PotabilityResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, validate_by_name=True)
    is_potable: bool = Field(..., alias="isPotable")
    probability: float
    risk_level: str = Field(..., alias="riskLevel")
    model_version: str = Field(..., alias="modelVersion")
    timestamp: datetime
    checks: List[ParameterCheck]
    missing_features: List[str] = Field(..., alias="missingFeatures")
    meta: Dict[str, Optional[str]]
    saved: bool
    sample_id: Optional[str] = Field(None, alias="sampleId")
    message: str

