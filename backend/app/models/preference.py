from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class FontSize(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    EXTRA_LARGE = "extra-large"


class InputMethod(str, Enum):
    KEYBOARD = "keyboard"
    VOICE = "voice"


class StudentPreferenceModel(BaseModel):
    """Internal MongoDB student accessibility preference representation."""
    id: Optional[str] = None
    student_id: str
    font_size: FontSize = FontSize.MEDIUM
    high_contrast: bool = False
    speech_enabled: bool = True
    speech_rate: float = Field(default=1.0, ge=0.5, le=2.0)
    speech_volume: float = Field(default=1.0, ge=0.0, le=1.0)
    preferred_voice: Optional[str] = ""
    auto_read_questions: bool = False
    preferred_input_method: InputMethod = InputMethod.KEYBOARD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> Optional["StudentPreferenceModel"]:
        if not data:
            return None
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        if "student_id" in doc and not isinstance(doc["student_id"], str):
            doc["student_id"] = str(doc["student_id"])
        return cls(**doc)
