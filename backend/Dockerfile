FROM python:3.12-slim

WORKDIR /app

# Install system dependencies including OWASP ZAP
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    git \
    wget \
    curl \
    openjdk-21-jre-headless \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install OWASP ZAP - Note: ZAP can be installed separately and run as daemon
# For Docker deployments, run ZAP in a separate container or on host machine
# This keeps the app container lightweight
RUN mkdir -p /opt/zaproxy

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
