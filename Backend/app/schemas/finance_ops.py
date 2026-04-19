from typing import List, Optional

from pydantic import BaseModel, Field


class BillingChargeCreate(BaseModel):
    patient_id: int = Field(..., ge=1)
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=500)
    signal_ids: Optional[List[int]] = Field(default=None, description="Mark these service signals resolved")


class BillingMarkPaidBody(BaseModel):
    payment_method: str = Field(default="cash", max_length=64)
