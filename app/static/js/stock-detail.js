/**
 * Stock detail page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize watchlist button state
    initializeWatchlistButton();

    // Load stock data
    loadStockData();

    // Set up chart controls
    setupChartControls();

    // Try to connect to WebSocket for real-time updates for this specific stock
    connectWebSocket(STOCK_SYMBOL);

    // Set interval for periodic data refresh (every 60 seconds)
    setInterval(() => {
        loadStockData(true); // Refresh data but don't reload chart
    }, 60000);
});

// Initialize watchlist button
function initializeWatchlistButton() {
    const watchlistBtn = document.getElementById('add-to-watchlist');
    const watchlistText = document.getElementById('watchlist-text');

    if (isInWatchlist(STOCK_SYMBOL)) {
        watchlistText.textContent = 'Remove from Watchlist';
        watchlistBtn.classList.add('in-watchlist');
    } else {
        watchlistText.textContent = 'Add to Watchlist';
        watchlistBtn.classList.remove('in-watchlist');
    }

    watchlistBtn.addEventListener('click', () => {
        if (isInWatchlist(STOCK_SYMBOL)) {
            removeFromWatchlist(STOCK_SYMBOL);
            watchlistText.textContent = 'Add to Watchlist';
            watchlistBtn.classList.remove('in-watchlist');
        } else {
            addToWatchlist(STOCK_SYMBOL);
            watchlistText.textContent = 'Remove from Watchlist';
            watchlistBtn.classList.add('in-watchlist');
        }
    });
}

// Load stock data
async function loadStockData(refreshOnly = false) {
    const loader = document.getElementById('stock-detail-loader');
    const content = document.getElementById('stock-content');

    if (!refreshOnly) {
        loader.style.display = 'flex';
        content.classList.add('hidden');
    }

    try {
        // Fetch stock data
        const response = await fetch(`/api/v1/stocks/${STOCK_SYMBOL}`);
        if (!response.ok) throw new Error(`Failed to fetch data for ${STOCK_SYMBOL}`);

        const stockData = await response.json();

        // Update stock name and price
        document.getElementById('stock-name').textContent = stockData.name || STOCK_SYMBOL;

        // Get latest price
        if (stockData.prices && stockData.prices.length > 0) {
            const latestPrice = stockData.prices[0];
            const previousPrice = stockData.prices[1] || latestPrice;

            // Calculate change
            const priceChange = latestPrice.close - previousPrice.close;
            const priceChangePercent = (priceChange / previousPrice.close) * 100;
            const isPositive = priceChange >= 0;

            // Find 52-week high/low
            const oneYearPrices = stockData.prices.filter(price => {
                const priceDate = new Date(price.date);
                const now = new Date();
                return (now - priceDate) / (1000 * 60 * 60 * 24) <= 365;
            });

            let fiftyTwoWeekHigh = 0;
            let fiftyTwoWeekLow = Number.MAX_VALUE;

            if (oneYearPrices.length > 0) {
                oneYearPrices.forEach(price => {
                    if (price.high > fiftyTwoWeekHigh) fiftyTwoWeekHigh = price.high;
                    if (price.low < fiftyTwoWeekLow) fiftyTwoWeekLow = price.low;
                });
            } else {
                fiftyTwoWeekHigh = Math.max(...stockData.prices.map(p => p.high));
                fiftyTwoWeekLow = Math.min(...stockData.prices.map(p => p.low));
            }

            // Update stock price and change
            document.getElementById('stock-price').textContent = `$${latestPrice.close.toFixed(2)}`;

            const changeElement = document.getElementById('stock-change');
            const changeIcon = isPositive ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>';
            changeElement.innerHTML = `${changeIcon} ${isPositive ? '+' : ''}${priceChange.toFixed(2)} (${isPositive ? '+' : ''}${priceChangePercent.toFixed(2)}%)`;
            changeElement.className = `change ${isPositive ? 'positive' : 'negative'}`;

            // Update summary information
            document.getElementById('open-price').textContent = `$${latestPrice.open.toFixed(2)}`;
            document.getElementById('high-price').textContent = `$${latestPrice.high.toFixed(2)}`;
            document.getElementById('low-price').textContent = `$${latestPrice.low.toFixed(2)}`;
            document.getElementById('close-price').textContent = `$${latestPrice.close.toFixed(2)}`;
            document.getElementById('volume').textContent = formatNumber(latestPrice.volume);

            // Update 52-week high/low if elements exist
            const weekHighElement = document.getElementById('52-week-high');
            const weekLowElement = document.getElementById('52-week-low');

            if (weekHighElement) weekHighElement.textContent = `$${fiftyTwoWeekHigh.toFixed(2)}`;
            if (weekLowElement) weekLowElement.textContent = `$${fiftyTwoWeekLow.toFixed(2)}`;

            // Calculate average volume (last 5 days)
            const avgVolume = stockData.prices
                .slice(0, Math.min(5, stockData.prices.length))
                .reduce((sum, price) => sum + price.volume, 0) /
                Math.min(5, stockData.prices.length);

            document.getElementById('avg-volume').textContent = formatNumber(Math.round(avgVolume));

            // If this isn't just a refresh, initialize the chart
            if (!refreshOnly) {
                initializeStockChart(stockData);
                populateHistoricalTable(stockData.prices);
            }
        }

        // Load company overview
        loadCompanyOverview();

        if (!refreshOnly) {
            loader.style.display = 'none';
            content.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading stock data:', error);
        if (!refreshOnly) {
            loader.style.display = 'none';
            content.innerHTML = `<p class="empty-message">Error loading data for ${STOCK_SYMBOL}.</p>`;
            content.classList.remove('hidden');
        }
    }
}

// Load company overview
async function loadCompanyOverview() {
    const loader = document.getElementById('overview-loader');
    const content = document.getElementById('overview-content');

    loader.style.display = 'flex';
    content.classList.add('hidden');

    try {
        const response = await fetch(`/api/v1/stocks/${STOCK_SYMBOL}/overview`);

        // If we get a 404, it means no overview data is available
        if (response.status === 404) {
            loader.style.display = 'none';
            content.innerHTML = '<p class="empty-message">No company overview available.</p>';
            content.classList.remove('hidden');
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch company overview');

        const overview = await response.json();

        // Update overview data
        document.getElementById('sector').textContent = overview.sector || '--';
        document.getElementById('industry').textContent = overview.industry || '--';
        document.getElementById('market-cap').textContent = overview.market_cap ? formatCurrency(overview.market_cap) : '--';
        document.getElementById('pe-ratio').textContent = overview.pe_ratio ? overview.pe_ratio.toFixed(2) : '--';
        document.getElementById('dividend-yield').textContent = overview.dividend_yield ? `${(overview.dividend_yield * 100).toFixed(2)}%` : '--';

        loader.style.display = 'none';
        content.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading company overview:', error);
        loader.style.display = 'none';
        content.innerHTML = '<p class="empty-message">Error loading company overview.</p>';
        content.classList.remove('hidden');
    }
}

// Initialize stock chart with Google Finance styling
function initializeStockChart(stockData) {
    const chartContainer = document.getElementById('stock-chart');

    if (!stockData.prices || stockData.prices.length === 0) {
        chartContainer.innerHTML = '<p class="empty-message">No chart data available.</p>';
        return;
    }

    // Format data for Plotly
    const prices = [...stockData.prices]; // Clone the array

    // Sort by date (oldest first for proper chart rendering)
    prices.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Get initial timeframe for chart (default to 1 month)
    const recentPrices = prices.slice(-30);

    // Calculate price change for the period to determine chart color
    const firstPrice = recentPrices[0]?.close || 0;
    const lastPrice = recentPrices[recentPrices.length - 1]?.close || 0;
    const priceChange = lastPrice - firstPrice;
    const isPositive = priceChange >= 0;

    // Set chart colors based on price direction (Google Finance style)
    const chartColor = isPositive ? 'rgb(0, 200, 5)' : 'rgb(255, 80, 0)';
    const chartFillColor = isPositive ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)';

    // Create trace for initial chart
    const createTraces = (prices, chartType = 'line') => {
        const dates = prices.map(price => new Date(price.date));

        // Calculate if period is positive or negative
        const firstPrice = prices[0]?.close || 0;
        const lastPrice = prices[prices.length - 1]?.close || 0;
        const periodIsPositive = lastPrice >= firstPrice;

        // Set chart colors based on price direction
        const lineColor = periodIsPositive ? 'rgb(0, 200, 5)' : 'rgb(255, 80, 0)';
        const fillColor = periodIsPositive ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)';

        if (chartType === 'line') {
            // Google Finance style line chart with area fill
            return [{
                x: dates,
                y: prices.map(price => price.close),
                type: 'scatter',
                mode: 'lines',
                name: 'Close Price',
                line: {
                    color: lineColor,
                    width: 2,
                    shape: 'spline', // Smoother line
                },
                fill: 'tozeroy',
                fillcolor: fillColor
            }];
        } else if (chartType === 'candle') {
            return [{
                x: dates,
                open: prices.map(price => price.open),
                high: prices.map(price => price.high),
                low: prices.map(price => price.low),
                close: prices.map(price => price.close),
                type: 'candlestick',
                name: STOCK_SYMBOL,
                increasing: { line: { color: 'rgb(0, 200, 5)' }, fillcolor: 'rgba(0, 200, 5, 0.5)' },
                decreasing: { line: { color: 'rgb(255, 80, 0)' }, fillcolor: 'rgba(255, 80, 0, 0.5)' }
            }];
        } else if (chartType === 'volume') {
            // Volume with coloring based on price direction
            const volumeBars = [];

            prices.forEach((price, i) => {
                const isUp = i > 0 ? price.close >= prices[i - 1].close : true;
                volumeBars.push({
                    x: dates[i],
                    y: price.volume,
                    marker: {
                        color: isUp ? 'rgba(0, 200, 5, 0.5)' : 'rgba(255, 80, 0, 0.5)'
                    }
                });
            });

            return [{
                x: dates,
                y: prices.map(price => price.volume),
                type: 'bar',
                name: 'Volume',
                marker: {
                    color: prices.map((price, i) => {
                        return i > 0 ?
                            (price.close >= prices[i - 1].close ? 'rgba(0, 200, 5, 0.5)' : 'rgba(255, 80, 0, 0.5)') :
                            'rgba(0, 200, 5, 0.5)';
                    })
                }
            }];
        }

        return [];
    };

    // Create chart layout with Google Finance styling
    const layout = {
        title: '',  // Google Finance doesn't use a title in the chart
        xaxis: {
            title: '',
            showgrid: false,
            zeroline: false,
            showline: false,
            showticklabels: true,
            tickfont: {
                family: 'Poppins, sans-serif',
                size: 10,
                color: 'var(--text-secondary)'
            }
        },
        yaxis: {
            title: '',
            showgrid: true,
            gridcolor: 'rgba(220, 220, 220, 0.3)',
            zeroline: false,
            showline: false,
            showticklabels: true,
            tickfont: {
                family: 'Poppins, sans-serif',
                size: 10,
                color: 'var(--text-secondary)'
            },
            fixedrange: false  // Allow y-axis zooming
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
            family: 'Poppins, sans-serif',
            color: 'var(--text-color)'
        },
        margin: {
            l: 40,
            r: 10,
            t: 10,
            b: 20
        },
        autosize: true,
        showlegend: false,  // Google Finance doesn't show a legend
        hovermode: 'x unified',  // Google Finance style hover
    };

    // Create initial chart
    Plotly.newPlot(chartContainer, createTraces(recentPrices), layout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: [
            'select2d', 'lasso2d', 'autoScale2d',
            'hoverClosestCartesian', 'hoverCompareCartesian',
            'toggleSpikelines'
        ],
        toImageButtonOptions: {
            format: 'png',
            filename: `${STOCK_SYMBOL}_chart`,
        }
    });

    // Add price comparison line (Google Finance feature)
    if (recentPrices.length > 0) {
        const firstPrice = recentPrices[0].close;
        Plotly.relayout(chartContainer, {
            shapes: [{
                type: 'line',
                x0: recentPrices[0].date,
                y0: firstPrice,
                x1: recentPrices[recentPrices.length - 1].date,
                y1: firstPrice,
                line: {
                    color: 'rgba(150, 150, 150, 0.5)',
                    width: 1,
                    dash: 'dot'
                }
            }]
        });
    }

    // Store the full dataset for later use with chart controls
    chartContainer.dataset.fullPrices = JSON.stringify(prices);

    // Set active tab
    document.querySelector('.tab-btn[data-timeframe="1m"]').classList.add('active');
    document.querySelector('.chart-type-btn[data-chart-type="line"]').classList.add('active');

    // Add chart statistics block below chart (Google Finance style)
    addChartStatistics(recentPrices);
}

// Add chart statistics block below chart (Google Finance style)
function addChartStatistics(prices) {
    // Create statistics container if it doesn't exist
    let statsContainer = document.getElementById('chart-statistics');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'chart-statistics';
        statsContainer.className = 'chart-statistics';

        // Insert after chart
        const chartContainer = document.getElementById('stock-chart');
        chartContainer.parentNode.insertBefore(statsContainer, chartContainer.nextSibling);
    }

    // Calculate statistics
    const firstPrice = prices[0]?.close || 0;
    const lastPrice = prices[prices.length - 1]?.close || 0;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;
    const isPositive = priceChange >= 0;

    // Format statistics
    const formattedChange = `${isPositive ? '+' : ''}${priceChange.toFixed(2)} (${isPositive ? '+' : ''}${priceChangePercent.toFixed(2)}%)`;

    // Calculate min/max for period
    const minPrice = Math.min(...prices.map(price => price.low));
    const maxPrice = Math.max(...prices.map(price => price.high));

    // Calculate average volume
    const avgVolume = prices.reduce((sum, price) => sum + price.volume, 0) / prices.length;

    // Update statistics container
    statsContainer.innerHTML = `
        <div class="stat-group">
            <div class="stat">
                <div class="stat-label">Open</div>
                <div class="stat-value">$${firstPrice.toFixed(2)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Close</div>
                <div class="stat-value">$${lastPrice.toFixed(2)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Change</div>
                <div class="stat-value ${isPositive ? 'positive' : 'negative'}">${formattedChange}</div>
            </div>
        </div>
        <div class="stat-group">
            <div class="stat">
                <div class="stat-label">Low</div>
                <div class="stat-value">$${minPrice.toFixed(2)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">High</div>
                <div class="stat-value">$${maxPrice.toFixed(2)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Avg Volume</div>
                <div class="stat-value">${formatNumber(Math.round(avgVolume))}</div>
            </div>
        </div>
    `;
}

// Populate historical data table
function populateHistoricalTable(prices) {
    const tableBody = document.getElementById('historical-tbody');
    const loader = document.getElementById('historical-loader');

    loader.style.display = 'flex';
    tableBody.innerHTML = '';

    if (!prices || prices.length === 0) {
        loader.style.display = 'none';
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-message">No historical data available.</td></tr>';
        return;
    }

    // Clone and sort prices by date (newest first)
    const sortedPrices = [...prices].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Create table rows
    sortedPrices.forEach((price, index) => {
        const row = document.createElement('tr');

        // Calculate daily change
        let change = 0;
        let changePercent = 0;
        let changeClass = '';

        if (index < sortedPrices.length - 1) {
            const prevPrice = sortedPrices[index + 1];
            change = price.close - prevPrice.close;
            changePercent = (change / prevPrice.close) * 100;
            changeClass = change >= 0 ? 'positive' : 'negative';
        }

        const changeSign = change >= 0 ? '+' : '';

        row.innerHTML = `
            <td>${formatDate(price.date)}</td>
            <td>$${price.open.toFixed(2)}</td>
            <td>$${price.high.toFixed(2)}</td>
            <td>$${price.low.toFixed(2)}</td>
            <td>$${price.close.toFixed(2)}</td>
            <td>${formatNumber(price.volume)}</td>
            <td class="${changeClass}">${changeSign}${change.toFixed(2)} (${changeSign}${changePercent.toFixed(2)}%)</td>
        `;

        tableBody.appendChild(row);
    });

    loader.style.display = 'none';
}

// Set up chart controls
function setupChartControls() {
    // Timeframe tabs
    const timeframeTabs = document.querySelectorAll('.tab-btn');
    timeframeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            timeframeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update chart
            updateChart();
        });
    });

    // Chart type buttons
    const chartTypeButtons = document.querySelectorAll('.chart-type-btn');
    chartTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            chartTypeButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            // Update chart
            updateChart();
        });
    });
}

// Update chart based on selected controls
function updateChart() {
    const chartContainer = document.getElementById('stock-chart');
    const activeTimeframe = document.querySelector('.tab-btn.active').dataset.timeframe;
    const activeChartType = document.querySelector('.chart-type-btn.active').dataset.chartType;

    // Get stored price data
    const pricesString = chartContainer.dataset.fullPrices;
    if (!pricesString) return;

    const allPrices = JSON.parse(pricesString);

    // Filter based on timeframe
    let filteredPrices;
    const now = new Date();

    // Debug the current date being used
    console.log("Current date for filtering:", now);

    switch (activeTimeframe) {
        case '1d':
            // Last day's data - ensure we get at least some data points
            const oneDayAgo = new Date(now);
            oneDayAgo.setDate(now.getDate() - 1);
            console.log("1d filter - date threshold:", oneDayAgo);

            filteredPrices = allPrices.filter(price => {
                const priceDate = new Date(price.date);
                return priceDate >= oneDayAgo;
            });
            break;
        case '1w':
            // Last week's data
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(now.getDate() - 7);
            console.log("1w filter - date threshold:", oneWeekAgo);

            filteredPrices = allPrices.filter(price => {
                const priceDate = new Date(price.date);
                return priceDate >= oneWeekAgo;
            });
            break;
        case '1m':
            // Last month's data
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(now.getMonth() - 1);
            console.log("1m filter - date threshold:", oneMonthAgo);

            filteredPrices = allPrices.filter(price => {
                const priceDate = new Date(price.date);
                return priceDate >= oneMonthAgo;
            });
            break;
        case '3m':
            // Last 3 months' data
            const threeMonthsAgo = new Date(now);
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            console.log("3m filter - date threshold:", threeMonthsAgo);

            filteredPrices = allPrices.filter(price => {
                const priceDate = new Date(price.date);
                return priceDate >= threeMonthsAgo;
            });
            break;
        case '1y':
            // Last year's data
            const oneYearAgo = new Date(now);
            oneYearAgo.setFullYear(now.getFullYear() - 1);
            console.log("1y filter - date threshold:", oneYearAgo);

            filteredPrices = allPrices.filter(price => {
                const priceDate = new Date(price.date);
                return priceDate >= oneYearAgo;
            });
            break;
        case '5y':
            // All available data (up to 5 years)
            filteredPrices = allPrices;
            break;
        default:
            // Default to last 30 days
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);

            filteredPrices = allPrices.filter(price => {
                const priceDate = new Date(price.date);
                return priceDate >= thirtyDaysAgo;
            });
    }

    console.log(`Timeframe ${activeTimeframe}: found ${filteredPrices.length} data points`);

    // If no data for the selected timeframe, use all available data
    if (filteredPrices.length === 0) {
        console.warn(`No data found for timeframe ${activeTimeframe}, using all available data`);
        filteredPrices = allPrices;
    }

    // Sort by date (oldest first for proper chart rendering)
    filteredPrices.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate price change for the period to determine chart color
    const firstPrice = filteredPrices[0]?.close || 0;
    const lastPrice = filteredPrices[filteredPrices.length - 1]?.close || 0;
    const priceChange = lastPrice - firstPrice;
    const isPositive = priceChange >= 0;

    // Set chart colors based on price direction (Google Finance style)
    const chartColor = isPositive ? 'rgb(0, 200, 5)' : 'rgb(255, 80, 0)';
    const chartFillColor = isPositive ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)';

    // Create chart traces based on chart type
    const dates = filteredPrices.map(price => new Date(price.date));

    let traces = [];

    if (activeChartType === 'line') {
        // Google Finance style line chart with area fill
        traces = [{
            x: dates,
            y: filteredPrices.map(price => price.close),
            type: 'scatter',
            mode: 'lines',
            name: 'Close Price',
            line: {
                color: chartColor,
                width: 2,
                shape: 'spline', // Smoother line
            },
            fill: 'tozeroy',
            fillcolor: chartFillColor
        }];
    } else if (activeChartType === 'candle') {
        // Candlestick chart with Google Finance colors
        traces = [{
            x: dates,
            open: filteredPrices.map(price => price.open),
            high: filteredPrices.map(price => price.high),
            low: filteredPrices.map(price => price.low),
            close: filteredPrices.map(price => price.close),
            type: 'candlestick',
            name: STOCK_SYMBOL,
            increasing: { line: { color: 'rgb(0, 200, 5)' }, fillcolor: 'rgba(0, 200, 5, 0.5)' },
            decreasing: { line: { color: 'rgb(255, 80, 0)' }, fillcolor: 'rgba(255, 80, 0, 0.5)' }
        }];
    } else if (activeChartType === 'volume') {
        // Volume chart with colored bars based on price movement
        traces = [{
            x: dates,
            y: filteredPrices.map(price => price.volume),
            type: 'bar',
            name: 'Volume',
            marker: {
                color: filteredPrices.map((price, i) => {
                    return i > 0 ?
                        (price.close >= filteredPrices[i - 1].close ? 'rgba(0, 200, 5, 0.5)' : 'rgba(255, 80, 0, 0.5)') :
                        'rgba(0, 200, 5, 0.5)';
                })
            }
        }];

        // Update y-axis title
        Plotly.relayout(chartContainer, {
            'yaxis.title': ''
        });
    }

    // Update the chart
    Plotly.react(chartContainer, traces);

    // Add price comparison line (Google Finance feature)
    if (filteredPrices.length > 0) {
        const firstPrice = filteredPrices[0].close;
        Plotly.relayout(chartContainer, {
            shapes: [{
                type: 'line',
                x0: filteredPrices[0].date,
                y0: firstPrice,
                x1: filteredPrices[filteredPrices.length - 1].date,
                y1: firstPrice,
                line: {
                    color: 'rgba(150, 150, 150, 0.5)',
                    width: 1,
                    dash: 'dot'
                }
            }]
        });
    }

    // Reset y-axis title if not volume chart
    if (activeChartType !== 'volume') {
        Plotly.relayout(chartContainer, {
            'yaxis.title': ''
        });
    }

    // Update chart statistics
    addChartStatistics(filteredPrices);
}