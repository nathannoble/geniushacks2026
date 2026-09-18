# app/extraction/schema.py  (e.g. app/intake/schema.py)
from pydantic import BaseModel


class Input(BaseModel):
    case_id: str


class Output(BaseModel):
    case_id: str
    status: str = "not_implemented"