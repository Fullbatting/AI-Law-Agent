FROM python:3.10-slim

RUN apt-get update && apt-get install -y build-essential git curl gcc

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
ENV PYTHONUNBUFFERED=1