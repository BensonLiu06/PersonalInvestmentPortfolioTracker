const state = {
  charts: {},
  rows: [
    { ticker: "MU", allocation: 40 },
    { ticker: "MSFT", allocation: 35 },
    { ticker: "AAPL", allocation: 25 },
  ],
};

const els = {
  holdingInputs: document.getElementById("holdingInputs"),
  allocationStatus: document.getElementById("allocationStatus"),
  initialInvestment: document.getElementById("initialInvestment"),
  output: document.getElementById("output"),
  runButton: document.getElementById("runPortfolio"),
  apiStatus: document.getElementById("apiStatus"),
};

function money(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function pct(value, digits = 2) {
  return `${Number(value).toFixed(digits)}%`;
}

function renderRows() {
  els.holdingInputs.innerHTML = "";

  state.rows.forEach((row, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "holding-row";

    const ticker = document.createElement("input");
    ticker.value = row.ticker;
    ticker.placeholder = "AAPL";
    ticker.setAttribute("aria-label", `Ticker ${index + 1}`);
    ticker.addEventListener("input", (e) => {
      state.rows[index].ticker = e.target.value.toUpperCase();
      e.target.value = state.rows[index].ticker;
    });

    const allocation = document.createElement("input");
    allocation.type = "number";
    allocation.step = "0.1";
    allocation.value = row.allocation;
    allocation.placeholder = "0";
    allocation.setAttribute("aria-label", `Allocation ${index + 1}`);
    allocation.addEventListener("input", (e) => {
      state.rows[index].allocation = Number(e.target.value || 0);
      updateAllocationStatus();
    });

    wrapper.append(ticker, allocation);
    els.holdingInputs.appendChild(wrapper);
  });

  updateAllocationStatus();
}

function updateAllocationStatus() {
  const total = state.rows.reduce((sum, row) => sum + Number(row.allocation || 0), 0);
  if (Math.abs(total - 100) <= 0.2) {
    els.allocationStatus.textContent = `Total allocation: ${pct(total, 1)} — weights are balanced.`;
  } else {
    els.allocationStatus.textContent = `Total allocation: ${pct(total, 1)} — rebalancing to 100% is recommended.`;
  }
}

document.getElementById("addHolding").addEventListener("click", () => {
  state.rows.push({ ticker: "", allocation: 0 });
  renderRows();
});

document.getElementById("removeHolding").addEventListener("click", () => {
  if (state.rows.length) state.rows.pop();
  renderRows();
});

document.getElementById("rebalance").addEventListener("click", () => {
  const total = state.rows.reduce((sum, row) => sum + Number(row.allocation || 0), 0);

  if (!total) {
    els.output.textContent = "Rebalance Error: total allocation cannot be zero.";
    return;
  }

  let running = 0;
  state.rows = state.rows.map((row, index) => {
    let newAllocation;
    if (index < state.rows.length - 1) {
      newAllocation = Math.round((Number(row.allocation || 0) / total) * 1000) / 10;
      running += newAllocation;
    } else {
      newAllocation = Math.round((100 - running) * 10) / 10;
    }
    return { ...row, allocation: newAllocation };
  });

  renderRows();
});

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    delete state.charts[name];
  }
}

function lineDatasets(priceHistory, benchmarkHistory) {
  const palette = ["#2563eb", "#0f766e", "#7c3aed", "#ea580c", "#0891b2", "#65a30d"];
  const datasets = [];

  Object.entries(priceHistory).forEach(([ticker, rows], i) => {
    datasets.push({
      label: ticker,
      data: rows.map((r) => ({ x: r.date, y: r.value })),
      borderColor: palette[i % palette.length],
      backgroundColor: "transparent",
      tension: 0.15,
      pointRadius: 0,
      borderWidth: 2,
    });
  });

  datasets.push({
    label: "SPY",
    data: benchmarkHistory.map((r) => ({ x: r.date, y: r.value })),
    borderColor: "#64748b",
    backgroundColor: "transparent",
    borderDash: [6, 5],
    tension: 0.15,
    pointRadius: 0,
    borderWidth: 2,
  });

  return datasets;
}

function drawCharts(data) {
  destroyChart("price");
  destroyChart("allocation");
  destroyChart("bar");
  destroyChart("scatter");

  state.charts.price = new Chart(document.getElementById("priceChart"), {
    type: "line",
    data: { datasets: lineDatasets(data.charts.price_history, data.charts.benchmark_history) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: { title: { display: true, text: "Recent Price History" } },
      scales: {
        x: { type: "category" },
        y: { beginAtZero: false },
      },
    },
  });

  state.charts.allocation = new Chart(document.getElementById("allocationChart"), {
    type: "doughnut",
    data: {
      labels: data.holdings.map((h) => h.ticker),
      datasets: [{
        data: data.holdings.map((h) => h.weight),
        backgroundColor: ["#2563eb", "#0f766e", "#7c3aed", "#ea580c", "#0891b2", "#65a30d"],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Allocation Mix" } },
    },
  });

  state.charts.bar = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels: data.holdings.map((h) => h.ticker),
      datasets: [
        { label: "Return %", data: data.holdings.map((h) => h.return), backgroundColor: "#2563eb" },
        { label: "Volatility %", data: data.holdings.map((h) => h.volatility), backgroundColor: "#94a3b8" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Return vs Volatility" } },
    },
  });

  state.charts.scatter = new Chart(document.getElementById("scatterChart"), {
    type: "scatter",
    data: {
      datasets: data.holdings.map((h, i) => ({
        label: h.ticker,
        data: [{ x: h.return, y: h.volatility }],
        pointRadius: 7,
        backgroundColor: ["#2563eb", "#0f766e", "#7c3aed", "#ea580c", "#0891b2", "#65a30d"][i % 6],
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { title: { display: true, text: "Risk / Return Map" } },
      scales: {
        x: { title: { display: true, text: "Return %" } },
        y: { title: { display: true, text: "Volatility %" } },
      },
    },
  });
}

function renderTable(holdings) {
  const tbody = document.getElementById("holdingsTable");
  tbody.innerHTML = holdings.map((h) => `
    <tr>
      <td><strong>${h.ticker}</strong></td>
      <td>${pct(h.weight, 1)}</td>
      <td>${money(h.price)}</td>
      <td>${pct(h.return)}</td>
      <td>${pct(h.volatility)}</td>
    </tr>
  `).join("");
}

function renderSummary(containerId, rows) {
  const container = document.getElementById(containerId);
  container.innerHTML = rows.map(([label, value]) => `
    <div class="summary-row"><span>${label}</span><span>${value}</span></div>
  `).join("");
}

function renderDashboard(data) {
  document.getElementById("metricValue").textContent = money(data.metrics.portfolio_value);
  document.getElementById("metricReturn").textContent = pct(data.metrics.expected_return);
  document.getElementById("metricVol").textContent = pct(data.metrics.portfolio_volatility);
  document.getElementById("metricBenchmark").textContent = data.metrics.benchmark;

  renderTable(data.holdings);

  renderSummary("portfolioSummary", [
    ["Initial investment", money(data.summary.initial_investment)],
    ["Latest portfolio value", money(data.summary.latest_portfolio_value)],
    ["Weighted return", pct(data.summary.weighted_return)],
    ["Weighted volatility", pct(data.summary.weighted_volatility)],
  ]);

  renderSummary("riskSummary", [
    ["Top holding", data.risk.top_holding],
    ["Lowest vol holding", data.risk.lowest_vol_holding],
    ["Highest return holding", data.risk.highest_return_holding],
    [`Benchmark (${data.metrics.benchmark})`, `${data.risk.benchmark_days} days`],
    ["Data points", String(data.risk.data_points)],
  ]);

  drawCharts(data);

  els.output.textContent = data.holdings.map((h) => (
    `${h.ticker}\n` +
    `  Latest Price: ${money(h.price)}\n` +
    `  Annual Return: ${pct(h.return)}\n` +
    `  Volatility: ${pct(h.volatility)}`
  )).join("\n\n") + "\n\nDone. Dashboard updated with live data.";
}

els.runButton.addEventListener("click", async () => {
  const holdings = state.rows
    .filter((row) => row.ticker.trim() || Number(row.allocation))
    .map((row) => ({ ticker: row.ticker.trim(), allocation: Number(row.allocation) }));

  els.runButton.disabled = true;
  els.runButton.textContent = "Running...";
  els.apiStatus.textContent = "Fetching market data";
  els.output.textContent = "Fetching live data...\n\nThis can take a while on Alpha Vantage's free tier.";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initial_investment: Number(els.initialInvestment.value),
        holdings,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to analyze the portfolio.");
    }

    renderDashboard(data);
    els.apiStatus.textContent = "Updated";
  } catch (error) {
    els.output.textContent = `Error: ${error.message}`;
    els.apiStatus.textContent = "Error";
  } finally {
    els.runButton.disabled = false;
    els.runButton.textContent = "Run Portfolio";
  }
});

renderRows();
