FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Ubuntu 22.04 (Jammy)'s default python3 is 3.10 — used directly here rather
# than apt-installing python3.11, which is NOT in Jammy's default repos (only
# available via the Deadsnakes PPA, an extra network dependency not worth
# adding for this). Nothing in this codebase needs a 3.11-only feature; 3.10
# runs everything the macOS/Windows (3.11) dev-setup tabs do.
RUN apt-get update && apt-get install -y \
    python3 python3-venv python3-pip \
    build-essential libpq-dev curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# An isolated venv, built against the system's actual python3, avoids ever
# mixing pip/python versions — a real risk on Ubuntu images that carry more
# than one Python (see the note above).
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.orchestrator.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
