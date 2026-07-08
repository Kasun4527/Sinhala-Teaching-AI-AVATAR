FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV OMP_NUM_THREADS=1
ENV KMP_DUPLICATE_LIB_OK=TRUE
# Using Gunicorn with Uvicorn workers for production process management
CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "--timeout", "120", "main:app", "--bind", "0.0.0.0:8000"]
