FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# Run migrations then start the server. Shell form required for &&.
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 120
