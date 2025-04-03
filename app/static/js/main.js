/**
 * Main JavaScript file for the Stock Dashboard
 */

// Handle theme toggle
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    const storedTheme = localStorage.getItem('theme') || 'light';
    if (storedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle-btn').innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Add fade-in animation to main content
    const mainContent = document.querySelector('main');
    if (mainContent) {
        setTimeout(() => {
            mainContent.classList.add('fade-in');
        }, 100);
    }

    // Theme toggle functionality with animations
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');

        // Update button icon with animation
        themeToggleBtn.classList.add('rotate-animation');
        setTimeout(() => {
            themeToggleBtn.innerHTML = isDark
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';
            themeToggleBtn.classList.remove('rotate-animation');
        }, 150);

        // Save preference to localStorage
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Handle search input with enhanced UX
    const searchInput = document.getElementById('stock-search');
    const searchBtn = document.getElementById('search-btn');
    const searchBox = document.querySelector('.search-box');

    // Add focus effect to search box
    if (searchInput && searchBox) {
        searchInput.addEventListener('focus', () => {
            searchBox.classList.add('focused');
        });

        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                searchBox.classList.remove('focused');
            }, 200);
        });
    }

    // Function to process search
    const handleSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            // Add loading animation to search button
            searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // First check if it's a direct symbol (uppercase 1-5 chars)
            if (/^[A-Z]{1,5}$/.test(query)) {
                window.location.href = `/stock/${query}`;
            } else {
                // Otherwise search for matches
                fetchStockSearch(query);
            }
        }
    };

    // Search button click
    searchBtn.addEventListener('click', handleSearch);

    // Search on enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Search results dropdown with enhanced styling
    let searchResults = [];
    let selectedIndex = -1;

    // Create search results container
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.className = 'search-results';
    searchResultsContainer.style.display = 'none';
    if (document.querySelector('.search-box')) {
        document.querySelector('.search-box').appendChild(searchResultsContainer);
    }

    // Function to search for stocks
    async function fetchStockSearch(query) {
        try {
            const response = await fetch(`/api/v1/stocks/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');

            searchResults = await response.json();
            displaySearchResults();
            // Restore search button icon
            searchBtn.innerHTML = '<i class="fas fa-search"></i>';
        } catch (error) {
            console.error('Error searching for stocks:', error);
            // Restore search button icon
            searchBtn.innerHTML = '<i class="fas fa-search"></i>';
        }
    }

    // Display search results with animation
    function displaySearchResults() {
        if (searchResults.length === 0) {
            searchResultsContainer.style.display = 'none';
            return;
        }

        searchResultsContainer.innerHTML = '';
        searchResults.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.style.animationDelay = `${index * 0.05}s`;
            resultItem.innerHTML = `
                <div class="result-symbol">${result.symbol}</div>
                <div class="result-name">${result.name}</div>
            `;
            resultItem.addEventListener('click', () => {
                window.location.href = `/stock/${result.symbol}`;
            });

            // Add hover effect
            resultItem.addEventListener('mouseenter', () => {
                resultItem.classList.add('highlighted');
            });

            resultItem.addEventListener('mouseleave', () => {
                resultItem.classList.remove('highlighted');
            });

            searchResultsContainer.appendChild(resultItem);
        });

        searchResultsContainer.style.display = 'block';
    }

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            searchResultsContainer.style.display = 'none';
        }
    });

    // Handle watchlist functionality
    initializeWatchlist();

    // Initialize animations for stock cards if we're on the dashboard
    if (document.querySelector('.stocks-grid')) {
        animateStockCards();
    }

    // Initialize WebSocket for real-time updates
    if (window.location.pathname === '/' || window.location.pathname.startsWith('/stock/')) {
        // If we're on a stock detail page, pass the symbol
        const symbol = window.STOCK_SYMBOL || null;
        connectWebSocket(symbol);
    }
});

// Function to animate stock cards with staggered animation
function animateStockCards() {
    const cards = document.querySelectorAll('.stock-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 + (index * 50));
    });
}

// Watchlist functionality
function initializeWatchlist() {
    // Get watchlist from localStorage
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');

    // Initialize watchlist UI if on homepage
    const watchlistContainer = document.getElementById('watchlist-container');
    const watchlistEmpty = document.getElementById('watchlist-empty');

    if (watchlistContainer && watchlistEmpty) {
        if (watchlist.length === 0) {
            watchlistEmpty.style.display = 'block';
            watchlistContainer.style.display = 'none';
        } else {
            watchlistEmpty.style.display = 'none';
            loadWatchlistData(watchlist, watchlistContainer);
        }
    }
}

// Function to load watchlist data with loading animation
async function loadWatchlistData(symbols, container) {
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const promises = symbols.map(symbol =>
            fetch(`/api/v1/stocks/${symbol}`).then(res => res.json())
        );

        const results = await Promise.allSettled(promises);
        container.innerHTML = '';

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                const stock = result.value;
                const latestPrice = stock.prices && stock.prices.length > 0 ? stock.prices[0] : null;

                if (latestPrice) {
                    const card = createStockCard(stock, latestPrice);
                    container.appendChild(card);

                    // Add staggered fade-in animation
                    setTimeout(() => {
                        card.classList.add('fade-in');
                    }, index * 100);
                }
            }
        });

        if (container.children.length === 0) {
            container.innerHTML = '<div class="empty-message"><i class="fas fa-exclamation-circle fa-2x" style="margin-bottom: 1rem; color: var(--primary-color);"></i><p>Failed to load watchlist data.</p></div>';
        }
    } catch (error) {
        console.error('Error loading watchlist:', error);
        container.innerHTML = '<div class="empty-message"><i class="fas fa-exclamation-circle fa-2x" style="margin-bottom: 1rem; color: var(--danger-color);"></i><p>Error loading watchlist data.</p></div>';
    }
}

// Function to create a stock card with enhanced design
function createStockCard(stock, priceData) {
    const card = document.createElement('div');
    card.className = 'stock-card';
    card.setAttribute('data-symbol', stock.symbol);

    // Calculate price change
    const close = priceData.close;
    const open = priceData.open;
    const change = close - open;
    const changePercent = (change / open) * 100;
    const isPositive = change >= 0;

    // Add change indicator icon
    const changeIcon = isPositive ?
        '<i class="fas fa-caret-up"></i>' :
        '<i class="fas fa-caret-down"></i>';

    card.innerHTML = `
        <div class="symbol">
            ${stock.symbol}
            <button class="watchlist-btn tooltip" data-tooltip="Remove from Watchlist">
                <i class="fas fa-star"></i>
            </button>
        </div>
        <div class="name">${stock.name}</div>
        <div class="price-info">
            <div class="price">$${close.toFixed(2)}</div>
            <div class="change ${isPositive ? 'positive' : 'negative'}">
                ${changeIcon} ${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)
            </div>
        </div>
        <div class="timestamp">Last updated: ${new Date(priceData.date).toLocaleDateString()}</div>
    `;

    // Add ripple effect on click
    card.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.watchlist-btn')) {
            const ripple = document.createElement('div');
            ripple.className = 'ripple';
            card.appendChild(ripple);

            const rect = card.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);

            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

            setTimeout(() => {
                ripple.remove();
            }, 600);
        }
    });

    // Navigate to stock detail page when clicked
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.watchlist-btn')) {
            window.location.href = `/stock/${stock.symbol}`;
        }
    });

    // Watchlist button handler with animation
    const watchlistBtn = card.querySelector('.watchlist-btn');
    watchlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Add removal animation
        card.classList.add('slide-out');

        setTimeout(() => {
            removeFromWatchlist(stock.symbol);
            card.remove();

            // Show empty message if watchlist is empty
            const container = document.getElementById('watchlist-container');
            if (container && container.children.length === 0) {
                const watchlistEmpty = document.getElementById('watchlist-empty');
                if (watchlistEmpty) {
                    watchlistEmpty.style.display = 'block';
                    watchlistEmpty.classList.add('fade-in');
                }
            }
        }, 300);
    });

    return card;
}

// Function to add a stock to watchlist with animation
function addToWatchlist(symbol) {
    let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if (!watchlist.includes(symbol)) {
        watchlist.push(symbol);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));

        // Show toast notification
        showToast(`${symbol} added to watchlist`);
        return true;
    }
    return false;
}

// Function to remove a stock from watchlist
function removeFromWatchlist(symbol) {
    let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const index = watchlist.indexOf(symbol);
    if (index !== -1) {
        watchlist.splice(index, 1);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));

        // Show toast notification
        showToast(`${symbol} removed from watchlist`);
        return true;
    }
    return false;
}

// Function to show toast notification
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;

    // Add to container
    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Function to check if a stock is in watchlist
function isInWatchlist(symbol) {
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    return watchlist.includes(symbol);
}

// Format currency
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '--';

    // Check if it's a large number
    if (Math.abs(amount) >= 1000000000) {
        return `$${(amount / 1000000000).toFixed(2)}B`;
    } else if (Math.abs(amount) >= 1000000) {
        return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (Math.abs(amount) >= 1000) {
        return `$${(amount / 1000).toFixed(2)}K`;
    }

    return `$${amount.toFixed(2)}`;
}

// Format number with commas
function formatNumber(num) {
    if (num === null || num === undefined) return '--';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

// WebSocket connection for real-time updates
let socket;

function connectWebSocket(symbol = null) {
    // Check if WebSocket is supported
    if ('WebSocket' in window) {
        // Close existing connection if any
        if (socket) {
            socket.close();
        }

        // Determine the WebSocket URL based on whether we're watching a specific symbol
        const wsUrl = symbol
            ? `ws://${window.location.host}/ws/${symbol}`
            : `ws://${window.location.host}/ws`;

        console.log(`Connecting to WebSocket: ${wsUrl}`);

        // Connect to WebSocket server
        socket = new WebSocket(wsUrl);

        // Connection opened
        socket.addEventListener('open', (event) => {
            console.log('Connected to WebSocket server');
            showToast('Connected to real-time data', 'success');
        });

        // Listen for messages
        socket.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                updateStockData(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        // Connection closed
        socket.addEventListener('close', (event) => {
            console.log('Disconnected from WebSocket server');
            // Try to reconnect after 5 seconds
            setTimeout(() => connectWebSocket(symbol), 5000);
        });

        // Connection error
        socket.addEventListener('error', (error) => {
            console.error('WebSocket error:', error);
            showToast('Connection error. Retrying...', 'error');
        });

        return socket;
    } else {
        console.warn('WebSocket is not supported by your browser');
        return null;
    }
}

// Update stock data with real-time information and animations
function updateStockData(data) {
    // If we're on a stock detail page and the symbol matches
    if (window.location.pathname.startsWith('/stock/') &&
        data.symbol === window.STOCK_SYMBOL) {
        // Update price and related elements with animation
        const priceElement = document.getElementById('stock-price');
        if (priceElement) {
            // Add pulse animation
            priceElement.classList.add('price-update-animation');
            setTimeout(() => {
                priceElement.textContent = `$${data.price.toFixed(2)}`;
                setTimeout(() => {
                    priceElement.classList.remove('price-update-animation');
                }, 500);
            }, 150);
        }

        // Update change
        const changeElement = document.getElementById('stock-change');
        if (changeElement) {
            const change = data.change;
            const changePercent = data.changePercent;
            const isPositive = change >= 0;

            // Add change indicator icon
            const changeIcon = isPositive ?
                '<i class="fas fa-caret-up"></i> ' :
                '<i class="fas fa-caret-down"></i> ';

            // Add pulse animation
            changeElement.classList.add('price-update-animation');
            setTimeout(() => {
                changeElement.innerHTML = `${changeIcon}${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
                changeElement.className = `change ${isPositive ? 'positive' : 'negative'}`;
                setTimeout(() => {
                    changeElement.classList.remove('price-update-animation');
                }, 500);
            }, 150);
        }
    }

    // Update any stock cards with this symbol
    const cards = document.querySelectorAll(`.stock-card[data-symbol="${data.symbol}"]`);
    cards.forEach(card => {
        const priceElement = card.querySelector('.price');
        if (priceElement) {
            // Add pulse animation
            priceElement.classList.add('price-update-animation');
            setTimeout(() => {
                priceElement.textContent = `$${data.price.toFixed(2)}`;
                setTimeout(() => {
                    priceElement.classList.remove('price-update-animation');
                }, 500);
            }, 150);
        }

        const changeElement = card.querySelector('.change');
        if (changeElement) {
            const change = data.change;
            const changePercent = data.changePercent;
            const isPositive = change >= 0;

            // Add change indicator icon
            const changeIcon = isPositive ?
                '<i class="fas fa-caret-up"></i> ' :
                '<i class="fas fa-caret-down"></i> ';

            // Add pulse animation
            changeElement.classList.add('price-update-animation');
            setTimeout(() => {
                changeElement.innerHTML = `${changeIcon}${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
                changeElement.className = `change ${isPositive ? 'positive' : 'negative'}`;
                setTimeout(() => {
                    changeElement.classList.remove('price-update-animation');
                }, 500);
            }, 150);
        }
    });
}