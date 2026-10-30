from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.preference import FontSize, InputMethod


class StudentPreferenceUpdateRequest(BaseModel):
    """Schema for updating student accessibility preferences."""
    font_size: Optional[FontSize] = None
    high_contrast: Optional[bool] = None
    speech_enabled: Optional[bool] = None
    speech_rate: Optional[float] = Field(None, ge=0.5, le=2.0, description="Speech rate from 0.5x to 2.0x")
    speech_volume: Optional[float] = Field(None, ge=0.0, le=1.0, description="Speech volume from 0.0 to 1.0")
    preferred_voice: Optional[str] = None
    auto_read_questions: Optional[bool] = None
    preferred_input_method: Optional[InputMethod] = None


class StudentPreferenceResponse(BaseModel):
    """Public representation of student accessibility preferences."""
    student_id: str
    font_size: FontSize = FontSize.MEDIUM
    high_contrast: bool = False
    speech_enabled: bool = True
    speech_rate: float = 1.0
    speech_volume: float = 1.0
    preferred_voice: Optional[str] = ""
    auto_read_questions: bool = False
    preferred_input_method: InputMethod = InputMethod.KEYBOARD
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
