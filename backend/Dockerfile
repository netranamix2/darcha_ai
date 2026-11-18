FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml .
# CPU-only torch first (the default PyPI wheel pulls several GB of CUDA libraries this image never uses)
RUN pip install --no-cache-dir uv \
 && uv pip install --system --no-cache torch --index-url https://download.pytorch.org/whl/cpu \
 && uv pip install --system --no-cache -r pyproject.toml
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
