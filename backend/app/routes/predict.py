from fastapi import APIRouter, HTTPException

from app.schemas.schemas import PotabilityResponse, WaterSamplePayload
from app.services.potability import get_potability_predictor


router = APIRouter()


@router.post("/potability", response_model=PotabilityResponse)
def run_potability_checks(payload: WaterSamplePayload) -> PotabilityResponse:
	predictor = get_potability_predictor()
	try:
		result = predictor.score_sample(payload.feature_dict(), payload.meta_dict())
	except ValueError as exc:
		raise HTTPException(status_code=400, detail=str(exc)) from exc
	return PotabilityResponse.parse_obj(result)
