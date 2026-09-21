from __future__ import annotations

from pydantic import BaseModel


class PolicyCitation(BaseModel):
    policy_id: str
    title: str
    excerpt: str
    similarity: float
