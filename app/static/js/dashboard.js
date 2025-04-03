/**
 * Dashboard page specific JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // Load popular stocks
    loadPopularStocks();

    // Load market indicators
    loadMarketIndicators();

    // Set up market trends chart
    initializeTrendChart();

    // Set up chart controls
    setupChartControls();

    // Try to connect to WebSocket for real-time updates
    // Connect to the general WebSocket endpoint (no specific symbol)
    connectWebSocket();

    // Set interval for periodic data refresh (every 60 seconds)
    setInterval(() => {
        loadPopularStocks();
        loadMarketIndicators();
    }, 60000);
});

// Load popular stocks data
async function loadPopularStocks() {
    const loader = document.getElementById('popular-stocks-loader');
    const grid = document.getElementById('popular-stocks-grid');

    loader.style.display = 'flex';
    grid.innerHTML = '';

    try {
        const response = await fetch('/api/v1/stocks/popular');
        if (!response.ok) throw new Error('Failed to fetch popular stocks');

        const stocks = await response.json();

        // Get detailed data for each stock
        const detailedDataPromises = stocks.map(stock =>
            fetch(`/api/v1/stocks/${stock.symbol}`).then(res => res.json())
        );

        const detailedResults = await Promise.allSettled(detailedDataPromises);

        // Process results
        detailedResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                const stock = result.value;
                const latestPrice = stock.prices && stock.prices.length > 0 ? stock.prices[0] : null;

                if (latestPrice) {
                    const card = createStockCard(stock, latestPrice);
                    grid.appendChild(card);
                }
            }
        });

        loader.style.display = 'none';

        // If no stocks were loaded, show a message
        if (grid.children.length === 0) {
            grid.innerHTML = '<p class="empty-message">Failed to load popular stocks.</p>';
        }
    } catch (error) {
        console.error('Error loading popular stocks:', error);
        loader.style.display = 'none';
        grid.innerHTML = '<p class="empty-message">Error loading popular stocks.</p>';
    }
}

// Load market indicators with Google Finance styling
async function loadMarketIndicators() {
    const loader = document.getElementById('market-indicators-loader');
    const content = document.getElementById('market-indicators-content');

    loader.style.display = 'flex';
    content.classList.add('hidden');

    try {
        // Here we'd typically fetch market indicators from an API
        // For demo, we'll use some simulated data
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

        const indicators = [
            { name: 'S&P 500', value: 4892.38, change: 12.45, changePercent: 0.25, symbol: 'SPX' },
            { name: 'NASDAQ', value: 15982.21, change: 78.76, changePercent: 0.49, symbol: 'IXIC' },
            { name: 'DOW', value: 38239.44, change: -52.59, changePercent: -0.14, symbol: 'DJI' },
            { name: 'VIX', value: 13.21, change: -0.78, changePercent: -5.58, symbol: 'VIX' }
        ];

        content.innerHTML = '';

        indicators.forEach(indicator => {
            const indicatorEl = document.createElement('div');
            indicatorEl.className = 'market-indicator';

            const isPositive = indicator.change >= 0;
            const changeIcon = isPositive ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>';

            // Create mini-chart placeholder div with Google Finance styling
            const miniChartId = `mini-chart-${indicator.symbol}`;

            indicatorEl.innerHTML = `
                <div class="indicator-header">
                    <div class="name">${indicator.name}</div>
                    <div class="value">${formatCurrency(indicator.value)}</div>
                </div>
                <div class="change ${isPositive ? 'positive' : 'negative'}">
                    ${changeIcon} ${isPositive ? '+' : ''}${indicator.change.toFixed(2)} (${isPositive ? '+' : ''}${indicator.changePercent.toFixed(2)}%)
                </div>
                <div class="mini-chart" id="${miniChartId}"></div>
            `;

            content.appendChild(indicatorEl);

            // Create mini-chart (Google Finance style sparkline)
            createMiniChart(miniChartId, indicator);
        });

        loader.style.display = 'none';
        content.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading market indicators:', error);
        loader.style.display = 'none';
        content.innerHTML = '<p class="empty-message">Error loading market indicators.</p>';
        content.classList.remove('hidden');
    }
}

// Create mini-chart for market indicator (Google Finance style sparkline)
function createMiniChart(containerId, indicator) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Generate random data for demo
    // In a real app, you would fetch actual data for each indicator
    const points = 20;
    const data = [];
    let baseValue = indicator.value - (indicator.value * (indicator.changePercent / 100));

    for (let i = 0; i < points; i++) {
        // Generate a slightly randomized trend that ends at the current value
        const progress = i / (points - 1);
        const randomFactor = Math.random() * 0.5 - 0.25;
        const value = baseValue + (indicator.value - baseValue) * progress + randomFactor;
        data.push(value);
    }

    // Ensure the last point is exactly the current value
    data[points - 1] = indicator.value;

    // Determine color based on change direction
    const isPositive = indicator.change >= 0;
    const chartColor = isPositive ? 'rgb(0, 200, 5)' : 'rgb(255, 80, 0)';

    // Create sparkline
    Plotly.newPlot(container, [{
        y: data,
        type: 'scatter',
        mode: 'lines',
        line: {
            color: chartColor,
            width: 1.5,
            shape: 'spline'
        },
        fill: 'tozeroy',
        fillcolor: isPositive ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)'
    }], {
        autosize: true,
        showlegend: false,
        margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
        xaxis: {
            showgrid: false,
            zeroline: false,
            showticklabels: false,
            fixedrange: true
        },
        yaxis: {
            showgrid: false,
            zeroline: false,
            showticklabels: false,
            fixedrange: true
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    }, {
        displayModeBar: false,
        responsive: true
    });
}

// Initialize trend chart with Google Finance styling
function initializeTrendChart() {
    const chartContainer = document.getElementById('trend-chart');
    const loader = document.getElementById('trend-chart-loader');

    loader.style.display = 'flex';

    // For demo, we'll use Apple stock data
    fetchStockDataForChart('AAPL').then(stockData => {
        if (!stockData || !stockData.prices || stockData.prices.length === 0) {
            loader.style.display = 'none';
            chartContainer.innerHTML = '<p class="empty-message">No chart data available.</p>';
            return;
        }

        // Format data for Plotly
        const prices = stockData.prices;

        // Sort by date (oldest first for proper chart rendering)
        prices.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Get only the last 30 days for the initial view
        const recentPrices = prices.slice(-30);

        // Calculate price change for the period to determine chart color
        const firstPrice = recentPrices[0]?.close || 0;
        const lastPrice = recentPrices[recentPrices.length - 1]?.close || 0;
        const priceChange = lastPrice - firstPrice;
        const isPositive = priceChange >= 0;

        // Set chart colors based on price direction (Google Finance style)
        const chartColor = isPositive ? 'rgb(0, 200, 5)' : 'rgb(255, 80, 0)';
        const chartFillColor = isPositive ? 'rgba(0, 200, 5, 0.1)' : 'rgba(255, 80, 0, 0.1)';

        const dates = recentPrices.map(price => new Date(price.date));
        const closePrices = recentPrices.map(price => price.close);

        // Create a Google Finance style line chart for initial view
        const trace = {
            x: dates,
            y: closePrices,
            type: 'scatter',
            mode: 'lines',
            name: 'Close Price',
            line: {
                color: chartColor,
                width: 2,
                shape: 'spline'
            },
            fill: 'tozeroy',
            fillcolor: chartFillColor
        };

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
                fixedrange: false
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
                t: 20,
                b: 20
            },
            autosize: true,
            showlegend: false,
            hovermode: 'x unified',
        };

        Plotly.newPlot(chartContainer, [trace], layout, {
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
                filename: `${stockData.symbol}_chart`,
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
        chartContainer.dataset.symbol = stockData.symbol;

        loader.style.display = 'none';

        // Add chart statistics below chart (Google Finance style)
        addChartStatistics(recentPrices, stockData.symbol);
    })
        .catch(error => {
            console.error('Error initializing trend chart:', error);
            loader.style.display = 'none';
            chartContainer.innerHTML = '<p class="empty-message">Error loading chart data.</p>';
        });
}

// Add chart statistics below chart
function addChartStatistics(prices, symbol) {
    // Create statistics container if it doesn't exist
    let statsContainer = document.getElementById('trend-chart-statistics');
    if (!statsContainer) {
        statsContainer = document.createElement('div');
        statsContainer.id = 'trend-chart-statistics';
        statsContainer.className = 'chart-statistics';

        // Insert after chart
        const chartContainer = document.getElementById('trend-chart');
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

    // Add symbol to the statistics
    statsContainer.innerHTML = `
        <div class="stat-header">${symbol} - Last ${prices.length} days</div>
        <div class="stat-groups">
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
        </div>
    `;
}

// Fetch stock data for chart
async function fetchStockDataForChart(symbol) {
    try {
        const response = await fetch(`/api/v1/stocks/${symbol}`);
        if (!response.ok) throw new Error(`Failed to fetch data for ${symbol}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${symbol} data:`, error);
        return null;
    }
}

// Set up chart controls
function setupChartControls() {
    const timeframeSelect = document.getElementById('chart-timeframe');
    const chartTypeSelect = document.getElementById('chart-type');

    // Timeframe change handler
    timeframeSelect.addEventListener('change', () => {
        updateChart();
    });

    // Chart type change handler
    chartTypeSelect.addEventListener('change', () => {
        updateChart();
    });
}

// Update chart based on controls with Google Finance styling
function updateChart() {
    const chartContainer = document.getElementById('trend-chart');
    const timeframeSelect = document.getElementById('chart-timeframe');
    const chartTypeSelect = document.getElementById('chart-type');

    // Get stored data
    const pricesString = chartContainer.dataset.fullPrices;
    const symbol = chartContainer.dataset.symbol;

    if (!pricesString || !symbol) return;

    const allPrices = JSON.parse(pricesString);

    // Get selected timeframe
    const timeframe = timeframeSelect.value;
    const chartType = chartTypeSelect.value;

    console.log(`Updating chart with timeframe: ${timeframe}, chart type: ${chartType}`);

    // Filter data based on timeframe
    let filteredPrices;
    const now = new Date();

    console.log("Current date for filtering:", now);

    switch (timeframe) {
        case '1d':
            // Last day's data - using proper date object methods
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
        default:
            // Default to last 30 days if no valid timeframe selected
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);

            filteredPrices = allPrices.filter(price => {
                const priceDate = new Date(price.date);
                return priceDate >= thirtyDaysAgo;
            });
    }

    console.log(`Timeframe ${timeframe}: found ${filteredPrices.length} data points`);

    // If no data for the selected timeframe, use all available data
    if (filteredPrices.length === 0) {
        console.warn(`No data found for timeframe ${timeframe}, using all available data`);
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

    // Create chart based on selected type
    const dates = filteredPrices.map(price => new Date(price.date));

    let traces = [];

    if (chartType === 'line') {
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
                shape: 'spline'
            },
            fill: 'tozeroy',
            fillcolor: chartFillColor
        }];
    } else if (chartType === 'candle') {
        // Candlestick chart with Google Finance colors
        traces = [{
            x: dates,
            open: filteredPrices.map(price => price.open),
            high: filteredPrices.map(price => price.high),
            low: filteredPrices.map(price => price.low),
            close: filteredPrices.map(price => price.close),
            type: 'candlestick',
            name: symbol,
            increasing: { line: { color: 'rgb(0, 200, 5)' }, fillcolor: 'rgba(0, 200, 5, 0.5)' },
            decreasing: { line: { color: 'rgb(255, 80, 0)' }, fillcolor: 'rgba(255, 80, 0, 0.5)' }
        }];
    } else if (chartType === 'ohlc') {
        // OHLC chart with Google Finance colors
        traces = [{
            x: dates,
            open: filteredPrices.map(price => price.open),
            high: filteredPrices.map(price => price.high),
            low: filteredPrices.map(price => price.low),
            close: filteredPrices.map(price => price.close),
            type: 'ohlc',
            name: symbol,
            increasing: { line: { color: 'rgb(0, 200, 5)' } },
            decreasing: { line: { color: 'rgb(255, 80, 0)' } }
        }];
    }

    // Update the chart with Google Finance styling
    const layout = {
        title: '',
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
            }
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
            t: 20,
            b: 20
        },
        autosize: true,
        showlegend: false,
        hovermode: 'x unified'
    };

    Plotly.react(chartContainer, traces, layout);

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

    // Update chart statistics
    addChartStatistics(filteredPrices, symbol);
}