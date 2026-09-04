# Portfolio Investment Tracker — Web Version

This project converts the original Tkinter desktop portfolio tracker into a browser-based Flask application.

## Features

- Add/remove portfolio holdings
- Enter allocation percentages
- Rebalance weights to 100%
- Pull daily market data from Alpha Vantage
- Calculate annualized return and volatility
- Compare against SPY
- Display portfolio metrics and holding summaries
- Interactive charts for:
  - recent price history
  - allocation mix
  - return vs. volatility
  - risk/return scatter plot
- Responsive browser layout

## Project structure

```text
portfolio_tracker_web/
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── styles.css
    └── app.js
```

## Setup

1. Create and activate a virtual environment.

```bash
python -m venv .venv
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Windows:

```bash
.venv\Scripts\activate
```

2. Install dependencies.

```bash
pip install -r requirements.txt
```

3. Get an Alpha Vantage API key and set it as an environment variable.

macOS / Linux:

```bash
export ALPHA_VANTAGE_API_KEY="your_key_here"
```

Windows PowerShell:

```powershell
$env:ALPHA_VANTAGE_API_KEY="your_key_here"
```

4. Start the app.

```bash
python app.py
```

5. Open the local address shown in your terminal, usually:

```text
http://127.0.0.1:5000
```

## Important

The original code included the API key directly in the Python file. This web version intentionally removes the key from source code and reads it from an environment variable instead. Do not commit real API keys to GitHub.

Alpha Vantage free-tier rate limits can make analysis take several seconds when several holdings are entered.

## Deployment

This Flask app can be deployed to platforms such as Render, Railway, or PythonAnywhere. Add `ALPHA_VANTAGE_API_KEY` as a secret/environment variable in the deployment platform rather than putting the key into the repository.
