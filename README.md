# Stock Dashboard

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)

A modern, real-time stock dashboard application with Google Finance-style charts and data visualization, built with Python and Flask.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Stock+Dashboard+Preview)

## Features

- 📈 **Real-time Stock Data**: Live updates through WebSocket connections
- 📊 **Interactive Charts**: Professional-grade charts with multiple timeframes (1d, 1w, 1m, 3m, 1y)
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🌓 **Dark/Light Mode**: Toggle between dark and light themes
- 📋 **Stock Details**: View comprehensive stock information and historical data
- 📋 **Watchlist**: Save your favorite stocks for quick access
- 🔍 **Search**: Find stocks by ticker symbol or company name
- 📉 **Market Indicators**: View major market indices at a glance

## Tech Stack

- **Backend**: Python 3.10+, Flask, SQLite
- **Frontend**: HTML5, CSS3, JavaScript, Plotly.js
- **Real-time Updates**: WebSockets
- **Data Processing**: Pandas
- **Deployment**: Supports Docker deployment

## Installation

### Prerequisites

- Python 3.10 or higher
- pip (Python package installer)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/stock-dashboard.git
   cd stock-dashboard
   ```

2. Set up a virtual environment:
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On Unix or MacOS
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -e .
   ```

4. Initialize the database:
   ```bash
   python scripts/db_util.py
   ```

## Usage

1. Start the Flask application:
   ```bash
   python main.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## Development

### Project Structure

```
stock_dashboard/
├── app/                  # Application package
│   ├── api/              # API endpoints
│   ├── core/             # Core functionality
│   ├── models/           # Database models
│   ├── services/         # Business logic
│   ├── static/           # Static assets (CSS, JS)
│   └── templates/        # HTML templates
├── data/                 # Database storage
├── scripts/              # Utility scripts
└── tests/                # Test suite
```

### Configuration

Configuration settings can be modified in `app/core/config.py`.

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Plotly.js](https://plotly.com/javascript/) for interactive charts
- [Font Awesome](https://fontawesome.com/) for icons
- [Google Finance](https://www.google.com/finance) for design inspiration