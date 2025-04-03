FROM python:3.10-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir -e .

# Copy the rest of the application
COPY . .

# Create a non-root user to run the application
RUN useradd -m appuser
USER appuser

# Create necessary directories with proper permissions
RUN mkdir -p /app/data

# Expose the port the app runs on
EXPOSE 5000

# Run the application
CMD ["python", "main.py"]