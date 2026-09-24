FROM --platform=linux/amd64 ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System packages every module needs: Python, build tools, Postgres client libs
RUN apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    build-essential libpq-dev curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.orchestrator.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]