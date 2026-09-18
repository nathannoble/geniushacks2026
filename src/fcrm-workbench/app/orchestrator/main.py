from fastapi import FastAPI

app = FastAPI(title="FCRM Workbench")


@app.get("/health")
def health():
    return {"status": "ok"}