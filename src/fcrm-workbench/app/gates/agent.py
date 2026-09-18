# app/gates/agent.py 
from .schema import Input, Output


def run(payload: Input) -> Output:
    """TODO: replace with the real M1 (Intake & Validation) logic."""
    return Output(case_id=payload.case_id)