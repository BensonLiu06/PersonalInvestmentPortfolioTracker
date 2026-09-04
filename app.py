import math
import os
import time
from dataclasses import dataclass
from typing import List

import numpy as np
import pandas as pd
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")
BASE_URL = "https://www.alphavantage.co/query"
TRADING_DAYS = 252
BENCHMARK = "SPY"


@dataclass
class Holding:
    ticker: str
    allocation: float
    price: float = 0.0
    ret: float = 0.0
    vol: float = 0.0


def fetch_daily_data(symbol: str):
    if not API_KEY:
        raise ValueError(
            "Missing Alpha Vantage API key. Set ALPHA_VANTAGE_API_KEY before running the app."
        )

    params = {
        "function": "TIME_SERIES_DAILY",
        "symbol": symbol,
        "apikey": API_KEY,
        "outputsize": "compact",
    }

    try:
        response = requests.get(BASE_URL, params=params, timeout=20)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        raise ValueError(f'Could not fetch "{symbol}".') from exc

    if "Error Message" in data:
        raise ValueError(f'Could not fetch "{symbol}".')
    if "Note" in data:
        raise ValueError(
            f'Could not fetch "{symbol}". Alpha Vantage rate limit reached. '
            "Wait about one minute and try again."
        )
    if "Information" in data:
        raise ValueError(f'Could not fetch "{symbol}". API response: {data["Information"]}')
    if "Time Series (Daily)" not in data:
        raise ValueError(f'Could not fetch "{symbol}". Unexpected API response.')

    df = pd.DataFrame.from_dict(data["Time Series (Daily)"], orient="index").astype(float)
    df.index = pd.to_datetime(df.index)
    df.sort_index(inplace=True)

    prices = df["4. close"]
    returns = prices.pct_change().dropna()

    if prices.empty or returns.empty:
        raise ValueError(f'Could not fetch "{symbol}". No usable price history returned.')

    return prices, returns


def compute_metrics(returns: pd.Series):
    annual_return = returns.mean() * TRADING_DAYS * 100
    volatility = returns.std() * np.sqrt(TRADING_DAYS) * 100
    return annual_return, volatility


def serialize_series(series: pd.Series, limit=None):
    if limit:
        series = series.tail(limit)
    return [
        {"date": idx.strftime("%Y-%m-%d"), "value": float(value)}
        for idx, value in series.items()
    ]


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/analyze")
def analyze():
    try:
        payload = request.get_json(force=True)
        initial_investment = float(payload.get("initial_investment", 0))
        raw_holdings = payload.get("holdings", [])

        if initial_investment <= 0:
            raise ValueError("Initial investment must be positive.")
        if not raw_holdings:
            raise ValueError("Add at least one holding.")

        holdings: List[Holding] = []
        for row in raw_holdings:
            ticker = str(row.get("ticker", "")).strip().upper()
            if not ticker:
                raise ValueError("One of the ticker fields is empty.")

            try:
                allocation = float(row.get("allocation", 0))
            except (TypeError, ValueError):
                raise ValueError(f"Allocation for {ticker} must be numeric.")

            holdings.append(Holding(ticker=ticker, allocation=allocation))

        total_alloc = sum(h.allocation for h in holdings)
        if total_alloc == 0:
            raise ValueError("Allocation cannot be zero.")

        benchmark_prices, benchmark_returns = fetch_daily_data(BENCHMARK)

        normalized = []
        portfolio_returns = None
        price_history = {}

        for index, holding in enumerate(holdings):
            # Alpha Vantage's free tier is rate-limited. This mirrors the pacing
            # used in the original desktop application.
            if index > 0:
                time.sleep(12)

            prices, returns = fetch_daily_data(holding.ticker)
            holding.price = float(prices.iloc[-1])
            holding.ret, holding.vol = compute_metrics(returns)

            weight = holding.allocation / total_alloc
            normalized.append((holding, weight))

            aligned_returns = returns.reindex(benchmark_returns.index).dropna()
            price_history[holding.ticker] = serialize_series(prices, 60)

            weighted_series = aligned_returns * weight
            if portfolio_returns is None:
                portfolio_returns = weighted_series
            else:
                portfolio_returns = portfolio_returns.add(weighted_series, fill_value=0)

        portfolio_returns = portfolio_returns.dropna()
        if portfolio_returns.empty:
            raise ValueError("No overlapping return history was available for the selected holdings.")

        portfolio_value = initial_investment * (1 + portfolio_returns).cumprod()
        weighted_return = sum(h.ret * w for h, w in normalized)
        weighted_vol = math.sqrt(sum((h.vol * w) ** 2 for h, w in normalized))

        top_holding = max(normalized, key=lambda x: x[1])[0].ticker
        lowest_vol = min(holdings, key=lambda x: x.vol).ticker
        highest_return = max(holdings, key=lambda x: x.ret).ticker

        result = {
            "metrics": {
                "portfolio_value": float(portfolio_value.iloc[-1]),
                "expected_return": weighted_return,
                "portfolio_volatility": weighted_vol,
                "benchmark": BENCHMARK,
            },
            "summary": {
                "initial_investment": initial_investment,
                "latest_portfolio_value": float(portfolio_value.iloc[-1]),
                "weighted_return": weighted_return,
                "weighted_volatility": weighted_vol,
            },
            "risk": {
                "top_holding": top_holding,
                "lowest_vol_holding": lowest_vol,
                "highest_return_holding": highest_return,
                "benchmark_days": len(benchmark_returns),
                "data_points": len(portfolio_returns),
            },
            "holdings": [
                {
                    "ticker": h.ticker,
                    "weight": weight * 100,
                    "price": h.price,
                    "return": h.ret,
                    "volatility": h.vol,
                }
                for h, weight in normalized
            ],
            "charts": {
                "price_history": price_history,
                "benchmark_history": serialize_series(benchmark_prices, 60),
                "portfolio_value": serialize_series(portfolio_value),
            },
        }

        return jsonify(result)

    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


if __name__ == "__main__":
    app.run(debug=True)
