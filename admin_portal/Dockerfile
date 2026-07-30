FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*


# Copy the rest of the application
COPY . /app/

# Install the main package and its dependencies
RUN pip install --progress-bar off --no-cache-dir .

# Expose port 8000
EXPOSE 8000

# Start FastAPI using uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
