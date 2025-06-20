# Storage Performance Visualizer

This project is a web application designed to visualize storage performance metrics. It uses a FastAPI backend to serve data and a Vite-powered frontend for the user interface.

## Features

- Visualize storage performance metrics such as IOPS, latency, and throughput.
- Supports multiple drive types and test configurations.
- Interactive charts for detailed analysis.

## Prerequisites

- Node.js and npm
- Python 3.x
- SQLite

## Setup

### Frontend

1. **Install Dependencies**: Run the following command to install the necessary Node.js packages:

   ```bash
   npm install
   ```

2. **Start the Development Server**: Use the following command to start the Vite development server:

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`.

### Backend

1. **Install Python Dependencies**: Ensure you have FastAPI and Uvicorn installed. You can install them using pip:

   ```bash
   pip install fastapi uvicorn
   ```

2. **Run the Backend Server**: Start the FastAPI server with:

   ```bash
   python3 backend/main.py
   ```

   The API will be available at `http://localhost:8000`.

### Database Setup

The application uses SQLite for data storage. The database is initialized automatically when the backend server starts. It creates two tables: `test_runs` and `performance_metrics`, and populates them with sample data if they are empty.

## Usage

- Access the frontend at `http://localhost:5173` to interact with the visualizer.
- Use the API endpoints to fetch test run data and performance metrics.

## API Endpoints

- **GET /api/test-runs**: Retrieve a list of test runs.
- **GET /api/performance-data**: Retrieve performance data for specific test runs.
- **GET /api/filters**: Retrieve available filters for test runs.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes. 