import { db } from "../script/firebase_conn.js";
import { ref, get, child, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// Configuration
const CONFIG = {
    LOW_STOCK_THRESHOLD: 10,
    VERY_LOW_STOCK_THRESHOLD: 5,
    TOP_PRODUCTS_LIMIT: 5,
    CHART_MONTHS: 6,
    CACHE_DURATION: 30000, // 30 seconds
    ROWS_PER_PAGE: 10
};

// Global state with caching and pagination
let salesData = {
    products: {},
    purchases: [],
    itemData: {},
    favoriteCounts: {},
    totalSales: 0,
    weeklySales: 0,
    monthlySales: 0,
    yearlySales: 0,
    lastUpdated: null,
    cacheTimestamp: null
};

// Pagination state
let currentPage = 1;
let rowsPerPage = CONFIG.ROWS_PER_PAGE;
let allProducts = [];

// ================= LOGOUT FUNCTIONALITY =================
function initializeLogoutModal() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmationModal');
    const closeLogoutModalBtn = document.getElementById('closeLogoutModalBtn');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (!logoutBtn || !logoutModal) {
        console.log('Logout elements not found in sales dashboard');
        return;
    }

    console.log('Initializing logout modal for sales dashboard...');

    // Remove any existing event listeners by cloning and replacing the button
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

    // Get fresh reference to the logout button
    const refreshedLogoutBtn = document.getElementById('logoutBtn');

    // Add click event listener to show modal
    refreshedLogoutBtn.addEventListener('click', function(e) {
        console.log('Sales dashboard logout button clicked - preventing default');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.log('Showing logout modal for sales dashboard');
        logoutModal.classList.remove('hidden');
        logoutModal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
    });

    // Close modal when close button is clicked
    closeLogoutModalBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Close sales dashboard logout modal');
        logoutModal.classList.add('hidden');
        logoutModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
    });

    // Close modal when cancel button is clicked
    cancelLogoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Cancel sales dashboard logout');
        logoutModal.classList.add('hidden');
        logoutModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
    });

    // Perform logout when confirm button is clicked
    confirmLogoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Confirming sales dashboard logout');
        
        // Show processing state
        const originalText = confirmLogoutBtn.innerHTML;
        confirmLogoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        confirmLogoutBtn.disabled = true;

        // Clear local storage
        localStorage.removeItem('cashierUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        sessionStorage.clear();

        console.log('Sales dashboard local storage cleared, redirecting...');
        
        // Redirect to login page after a brief delay to show the loading state
        setTimeout(() => {
            window.location.href = '/SMARTBITE-ADMIN/login.html';
        }, 500);
    });

    // Close modal when clicking outside
    logoutModal.addEventListener('click', function(e) {
        if (e.target === logoutModal) {
            console.log('Clicked outside sales dashboard modal - closing');
            logoutModal.classList.add('hidden');
            logoutModal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
        }
    });

    // Prevent any form submission if the logout button is inside a form
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (e.submitter === refreshedLogoutBtn) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });

    console.log('Sales dashboard logout modal initialized successfully');
}

// Cache management
const cacheManager = {
    isCacheValid() {
        return salesData.cacheTimestamp && 
               (Date.now() - salesData.cacheTimestamp) < CONFIG.CACHE_DURATION;
    },
    
    updateCacheTimestamp() {
        salesData.cacheTimestamp = Date.now();
    },
    
    clearCache() {
        salesData.cacheTimestamp = null;
    }
};

// Pagination management
const paginationManager = {
    initialize() {
        const rowsPerPageSelect = document.getElementById('rowsPerPage');
        if (rowsPerPageSelect) {
            rowsPerPageSelect.addEventListener('change', function() {
                rowsPerPage = parseInt(this.value);
                currentPage = 1;
                uiUpdater.updateProductTable();
            });
        }
    },
    
    updatePaginationControls() {
        const totalPages = Math.ceil(allProducts.length / rowsPerPage);
        const paginationContainer = document.getElementById('paginationControls');
        
        if (!paginationContainer) return;
        
        if (allProducts.length <= rowsPerPage) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        let paginationHTML = `
            <button class="page-btn" onclick="window.paginationManager.changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Show page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="window.paginationManager.changePage(${i})">
                    ${i}
                </button>
            `;
        }
        
        paginationHTML += `
            <button class="page-btn" onclick="window.paginationManager.changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        // Page info
        const startItem = (currentPage - 1) * rowsPerPage + 1;
        const endItem = Math.min(currentPage * rowsPerPage, allProducts.length);
        
        paginationHTML += `
            <div class="pagination-info">
                Showing ${startItem}-${endItem} of ${allProducts.length} products
            </div>
        `;
        
        paginationContainer.innerHTML = paginationHTML;
    },
    
    changePage(page) {
        const totalPages = Math.ceil(allProducts.length / rowsPerPage);
        
        if (page < 1 || page > totalPages) return;
        
        currentPage = page;
        uiUpdater.updateProductTable();
        
        // Scroll to top of table
        const tableElement = document.querySelector('.bg-white.rounded-xl.shadow-md');
        if (tableElement) {
            tableElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }
};

// Error handling utility
const errorHandler = {
    showNotification(message, type = 'error') {
        const notification = document.getElementById('successNotification');
        const messageEl = document.getElementById('successMessage');
        const icon = notification.querySelector('i');
        
        // Update notification content
        messageEl.textContent = message;
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 z-50 flex items-center`;
        
        if (type === 'success') {
            notification.classList.add('bg-green-500', 'text-white');
            icon.className = 'fas fa-check-circle mr-2';
        } else if (type === 'warning') {
            notification.classList.add('bg-yellow-500', 'text-white');
            icon.className = 'fas fa-exclamation-triangle mr-2';
        } else {
            notification.classList.add('bg-red-500', 'text-white');
            icon.className = 'fas fa-exclamation-circle mr-2';
        }
        
        // Show notification
        notification.classList.remove('translate-x-full');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
        }, 5000);
    },
    
    handleFirebaseError(error, context) {
        console.error(`Firebase error in ${context}:`, error);
        this.showNotification(`Failed to load ${context}. Please try again.`, 'error');
    },
    
    handleDataError(error) {
        console.error('Data processing error:', error);
        this.showNotification('Error processing data. Please refresh.', 'error');
    }
};

// Data processing utilities
const dataProcessor = {
    calculateTimeRanges() {
        const now = new Date();
        return {
            oneWeekAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            oneMonthAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            oneYearAgo: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
            now
        };
    },
    
    parseProductData(prod) {
        const productName = prod.name || prod.product_name;
        if (!productName || prod.archived) return null;
        
        return {
            name: productName,
            category: prod.category || "Unknown",
            quantity: Number(prod.quantity) || 0,
            price: Number(prod.price) || 0,
            totalSold: 0,
            revenue: 0
        };
    },
    
    processPurchase(purchase, timeRanges, itemData, favoriteCounts) {
        const timestamp = purchase.timestamp ? Number(purchase.timestamp) : Date.now();
        const purchaseDate = new Date(timestamp);
        let purchaseTotal = 0;

        if (Array.isArray(purchase.products)) {
            purchase.products.forEach(prod => {
                const productName = prod.product_name || prod.name;
                const quantity = Number(prod.quantity) || 0;
                const price = Number(prod.price) || 0;
                const subtotal = Number(prod.subtotal) || (quantity * price);

                purchaseTotal += subtotal;

                if (productName) {
                    // Update favorite counts
                    favoriteCounts[productName] = (favoriteCounts[productName] || 0) + quantity;

                    // Update item data
                    if (itemData[productName]) {
                        itemData[productName].totalSold += quantity;
                        itemData[productName].revenue += subtotal;
                    } else {
                        // Product not in current products list
                        itemData[productName] = {
                            category: prod.category || "Unknown",
                            quantity: 0,
                            price: price,
                            totalSold: quantity,
                            revenue: subtotal
                        };
                    }
                }
            });
        }

        return {
            purchaseTotal,
            purchaseDate,
            timeRanges
        };
    },
    
    getStockStatus(remainingStock) {
        if (remainingStock <= 0) return { class: 'stock-low pulse', text: 'OUT OF STOCK', color: 'red' };
        if (remainingStock <= CONFIG.VERY_LOW_STOCK_THRESHOLD) return { class: 'stock-low pulse', text: 'Very Low Stock', color: 'red' };
        if (remainingStock <= CONFIG.LOW_STOCK_THRESHOLD) return { class: 'stock-medium', text: 'Low Stock', color: 'yellow' };
        return { class: 'stock-high', text: 'In Stock', color: 'green' };
    }
};

// Firebase data service
const firebaseService = {
    async loadProducts() {
        try {
            const productsSnapshot = await get(child(ref(db), "products"));
            const products = {};
            
            if (productsSnapshot.exists()) {
                productsSnapshot.forEach(prodSnap => {
                    const productData = dataProcessor.parseProductData(prodSnap.val());
                    if (productData) {
                        products[productData.name] = productData;
                    }
                });
                console.log('Products loaded:', Object.keys(products).length);
            }
            
            return products;
        } catch (error) {
            errorHandler.handleFirebaseError(error, 'products');
            throw error;
        }
    },
    
    async loadPurchases() {
        try {
            const purchasesSnapshot = await get(child(ref(db), "purchases"));
            const purchases = [];
            
            if (purchasesSnapshot.exists()) {
                purchasesSnapshot.forEach(pSnap => {
                    purchases.push(pSnap.val());
                });
                console.log('Purchases loaded:', purchases.length);
            }
            
            return purchases;
        } catch (error) {
            errorHandler.handleFirebaseError(error, 'purchase history');
            throw error;
        }
    }
};

// Chart management
const chartManager = {
    chart: null,
    
    initialize() {
        const ctx = document.getElementById('salesChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.getLastMonths(CONFIG.CHART_MONTHS),
                datasets: [{
                    label: 'Sales (₱)',
                    data: Array(CONFIG.CHART_MONTHS).fill(0),
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#4f46e5',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `Sales: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            },
                            font: {
                                size: 11
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    },
    
    getLastMonths(months) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const result = [];
        const date = new Date();
        
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
            result.push(monthNames[d.getMonth()] + ' ' + d.getFullYear());
        }
        
        return result;
    },
    
    updateWithRealData(monthlySalesData = []) {
        if (!this.chart) return;
        
        // If we have real monthly data, use it; otherwise use current monthly sales
        const data = monthlySalesData.length > 0 ? 
            monthlySalesData : 
            Array(CONFIG.CHART_MONTHS - 1).fill(0).concat([salesData.monthlySales || 0]);
        
        this.chart.data.datasets[0].data = data;
        this.chart.update('active');
    },
    
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

// UI updaters
const uiUpdater = {
    updateSalesTotals(total, weekly, monthly, yearly) {
        const formatter = new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        });
        
        document.getElementById('totalSales').textContent = formatter.format(total);
        document.getElementById('weeklySales').textContent = formatter.format(weekly);
        document.getElementById('monthlySales').textContent = formatter.format(monthly);
        document.getElementById('yearlySales').textContent = formatter.format(yearly);
        
        // Update last updated timestamp
        const lastUpdatedEl = document.getElementById('lastUpdated');
        const now = new Date();
        lastUpdatedEl.innerHTML = `
            <i class="fas fa-clock mr-1"></i>
            <span>Last updated: ${now.toLocaleTimeString()}</span>
        `;
        
        // Update sales change indicator
        const changeEl = document.getElementById('totalSalesChange');
        if (total > 0) {
            changeEl.innerHTML = `
                <i class="fas fa-arrow-up text-green-500 mr-1"></i>
                <span class="text-green-600">Active sales monitoring</span>
            `;
        } else {
            changeEl.innerHTML = `
                <i class="fas fa-info-circle text-blue-500 mr-1"></i>
                <span class="text-blue-600">No sales data yet</span>
            `;
        }
    },
    
    updateTopProducts(favoriteCounts, itemData) {
        const topProductsContainer = document.getElementById('favoriteItems');
        const topProductsCount = document.getElementById('topProductsCount');
        
        const sortedFavorites = Object.entries(favoriteCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, CONFIG.TOP_PRODUCTS_LIMIT);
        
        topProductsCount.textContent = `${sortedFavorites.length} products`;
        
        if (sortedFavorites.length === 0) {
            topProductsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-chart-bar text-3xl mb-3 opacity-50"></i>
                    <p class="text-sm">No sales data available</p>
                    <p class="text-xs mt-1">Sales will appear here once products are sold</p>
                </div>
            `;
            return;
        }
        
        topProductsContainer.innerHTML = '';
        
        sortedFavorites.forEach(([productName, soldCount], index) => {
            const product = itemData[productName];
            const revenue = product ? product.revenue : (soldCount * (product?.price || 0));
            const progress = Math.min((soldCount / Math.max(sortedFavorites[0][1], 1)) * 100, 100);
            
            const productEl = document.createElement('div');
            productEl.className = 'flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors';
            
            productEl.innerHTML = `
                <div class="flex items-center flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold mr-4 flex-shrink-0">
                        ${index + 1}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-semibold text-gray-800 truncate" title="${productName}">${productName}</h3>
                        <p class="text-sm text-gray-500 truncate">${soldCount.toLocaleString()} units sold</p>
                        <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
                <div class="text-right ml-4 flex-shrink-0">
                    <div class="text-lg font-bold text-gray-800">₱${revenue.toFixed(2)}</div>
                    <div class="text-xs text-gray-500">revenue</div>
                </div>
            `;
            
            topProductsContainer.appendChild(productEl);
        });
    },
    
    updateProductTable() {
        const tableBody = document.getElementById('allSoldItems');
        
        if (allProducts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                        <div class="flex flex-col items-center">
                            <i class="fas fa-inbox text-3xl mb-3 opacity-50"></i>
                            <p class="text-sm">No sales data available yet</p>
                            <p class="text-xs mt-1">Products will appear here once they are sold</p>
                        </div>
                    </td>
                </tr>
            `;
            paginationManager.updatePaginationControls();
            return;
        }
        
        // Calculate pagination
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const currentProducts = allProducts.slice(startIndex, endIndex);
        
        tableBody.innerHTML = '';
        
        currentProducts.forEach(([name, info], index) => {
            const remainingStock = info.quantity - info.totalSold;
            const stockStatus = dataProcessor.getStockStatus(remainingStock);
            
            const tr = document.createElement('tr');
            tr.className = `hover:bg-gray-50 transition ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`;
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                            ${startIndex + index + 1}
                        </div>
                        <div class="text-sm font-medium text-gray-900 truncate max-w-xs" title="${name}">${name}</div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        ${info.category}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₱${info.price.toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${info.quantity.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-gray-900">${info.totalSold.toLocaleString()}</div>
                    <div class="text-xs text-gray-500">units</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="text-sm font-semibold text-${stockStatus.color}-600">
                            ${remainingStock.toLocaleString()}
                            ${remainingStock <= 0 ? '<span class="text-xs ml-1">(OUT OF STOCK)</span>' : ''}
                        </div>
                        ${remainingStock > 0 ? `
                        <div class="ml-2 w-16 bg-gray-200 rounded-full h-2">
                            <div class="bg-${stockStatus.color}-500 h-2 rounded-full" 
                                 style="width: ${Math.max((remainingStock / Math.max(info.quantity, 1)) * 100, 5)}%">
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </td>
            `;
            
            tableBody.appendChild(tr);
        });
        
        paginationManager.updatePaginationControls();
    },
    
    updateLowStockAlert(itemData) {
        const lowStockContainer = document.getElementById('lowStockAlert');
        const lowStockCount = document.getElementById('lowStockCount');
        
        const lowStockItems = Object.entries(itemData)
            .filter(([name, info]) => {
                const remainingStock = info.quantity - info.totalSold;
                return remainingStock <= CONFIG.LOW_STOCK_THRESHOLD;
            })
            .sort((a, b) => {
                const remainingA = a[1].quantity - a[1].totalSold;
                const remainingB = b[1].quantity - b[1].totalSold;
                return remainingA - remainingB;
            });
        
        lowStockCount.textContent = `${lowStockItems.length} items need attention`;
        
        if (lowStockItems.length === 0) {
            lowStockContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-check-circle text-green-500 text-3xl mb-3"></i>
                    <p class="text-sm font-medium text-green-600">All products are sufficiently stocked</p>
                    <p class="text-xs mt-1">Great job managing your inventory!</p>
                </div>
            `;
            return;
        }
        
        lowStockContainer.innerHTML = '';
        
        lowStockItems.forEach(([name, info]) => {
            const remainingStock = info.quantity - info.totalSold;
            const stockStatus = dataProcessor.getStockStatus(remainingStock);
            const stockPercentage = Math.max((remainingStock / Math.max(info.quantity, 1)) * 100, 5);
            
            const alertEl = document.createElement('div');
            alertEl.className = `p-4 rounded-lg ${stockStatus.class} card-hover`;
            
            alertEl.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1">
                        <h3 class="font-semibold text-gray-800 text-lg">${name}</h3>
                        <p class="text-sm text-gray-600 mt-1">
                            ${remainingStock <= 0 ? 'Completely out of stock' : `Only ${remainingStock} item${remainingStock !== 1 ? 's' : ''} remaining`}
                        </p>
                    </div>
                    <div class="text-right ml-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-${stockStatus.color}-100 text-${stockStatus.color}-800">
                            ${stockStatus.text}
                        </span>
                        <div class="text-sm font-semibold text-gray-800 mt-1">${info.totalSold.toLocaleString()}</div>
                        <div class="text-xs text-gray-500">total sold</div>
                    </div>
                </div>
                ${remainingStock > 0 ? `
                <div class="mt-2">
                    <div class="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Stock level</span>
                        <span>${remainingStock} / ${info.quantity}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill bg-${stockStatus.color}-500" style="width: ${stockPercentage}%"></div>
                    </div>
                </div>
                ` : `
                <div class="mt-3 p-2 bg-red-50 rounded border border-red-200">
                    <div class="flex items-center text-red-700">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <span class="text-sm font-medium">This product needs immediate restocking</span>
                    </div>
                </div>
                `}
            `;
            
            lowStockContainer.appendChild(alertEl);
        });
    }
};

// Main data processing function
async function processSalesData() {
    try {
        const timeRanges = dataProcessor.calculateTimeRanges();
        
        // Reset counters
        salesData.itemData = JSON.parse(JSON.stringify(salesData.products));
        salesData.favoriteCounts = {};
        salesData.totalSales = 0;
        salesData.weeklySales = 0;
        salesData.monthlySales = 0;
        salesData.yearlySales = 0;

        // Process purchases
        salesData.purchases.forEach(purchase => {
            const result = dataProcessor.processPurchase(
                purchase, 
                timeRanges, 
                salesData.itemData, 
                salesData.favoriteCounts
            );
            
            // Update sales totals
            salesData.totalSales += result.purchaseTotal;
            if (result.purchaseDate >= timeRanges.oneWeekAgo) salesData.weeklySales += result.purchaseTotal;
            if (result.purchaseDate >= timeRanges.oneMonthAgo) salesData.monthlySales += result.purchaseTotal;
            if (result.purchaseDate >= timeRanges.oneYearAgo) salesData.yearlySales += result.purchaseTotal;
        });

        console.log('Data processed:', {
            totalSales: salesData.totalSales,
            weeklySales: salesData.weeklySales,
            monthlySales: salesData.monthlySales,
            yearlySales: salesData.yearlySales,
            products: Object.keys(salesData.itemData).length
        });

        // Prepare data for pagination
        allProducts = Object.entries(salesData.itemData)
            .filter(([name, info]) => info.totalSold > 0)
            .sort((a, b) => b[1].totalSold - a[1].totalSold);

        // Reset to first page when data changes
        currentPage = 1;

        // Update UI with processed data
        uiUpdater.updateSalesTotals(
            salesData.totalSales, 
            salesData.weeklySales, 
            salesData.monthlySales, 
            salesData.yearlySales
        );
        uiUpdater.updateTopProducts(salesData.favoriteCounts, salesData.itemData);
        uiUpdater.updateProductTable();
        uiUpdater.updateLowStockAlert(salesData.itemData);
        
        // Update chart
        chartManager.updateWithRealData();
        
        // Update cache timestamp
        cacheManager.updateCacheTimestamp();
        
        // Show success notification
        errorHandler.showNotification('Data updated successfully!', 'success');
        
    } catch (error) {
        errorHandler.handleDataError(error);
    }
}

// Load sales data from Firebase
async function loadSalesData(forceRefresh = false) {
    try {
        // Check cache if not forcing refresh
        if (!forceRefresh && cacheManager.isCacheValid()) {
            console.log('Using cached data');
            processSalesData();
            return;
        }
        
        console.log('Loading sales data from Firebase...');
        
        // Show loading states
        document.getElementById('allSoldItems').innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    <div class="flex flex-col items-center">
                        <i class="fas fa-spinner fa-spin text-2xl mb-3"></i>
                        <p>Loading product data...</p>
                    </div>
                </td>
            </tr>
        `;

        document.getElementById('favoriteItems').innerHTML = `
            <div class="flex justify-center items-center h-40">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
                    <p class="text-gray-500">Loading data...</p>
                </div>
            </div>
        `;

        // Load data in parallel for better performance
        const [products, purchases] = await Promise.all([
            firebaseService.loadProducts(),
            firebaseService.loadPurchases()
        ]);

        salesData.products = products;
        salesData.purchases = purchases;

        // Process the data
        await processSalesData();
        
    } catch (err) {
        console.error("Error loading sales data:", err);
        showErrorState();
    }
}

// Export data functionality
function exportData() {
    try {
        if (Object.keys(salesData.itemData).length === 0) {
            errorHandler.showNotification('No data available to export', 'warning');
            return;
        }

        // Create CSV content
        let csvContent = "Product,Category,Price,Current Stock,Total Sold,Remaining Stock,Revenue\n";
        
        Object.entries(salesData.itemData)
            .sort((a, b) => b[1].totalSold - a[1].totalSold)
            .forEach(([name, info]) => {
                const remainingStock = info.quantity - info.totalSold;
                const revenue = info.revenue || 0;
                
                csvContent += `"${name.replace(/"/g, '""')}","${info.category}",${info.price},${info.quantity},${info.totalSold},${remainingStock},${revenue}\n`;
            });
        
        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        
        link.setAttribute('href', url);
        link.setAttribute('download', `smartbite-sales-report-${timestamp}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        errorHandler.showNotification('Report exported successfully!', 'success');
        
    } catch (err) {
        console.error('Error exporting data:', err);
        errorHandler.showNotification('Error exporting data. Please try again.', 'error');
    }
}

// Refresh data with loading state
function refreshData() {
    console.log('Refreshing data...');
    cacheManager.clearCache();
    
    // Show refreshing state
    const refreshBtn = document.getElementById('refreshBtn');
    const originalHTML = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing...';
    refreshBtn.disabled = true;
    
    loadSalesData(true).finally(() => {
        // Restore button state
        setTimeout(() => {
            refreshBtn.innerHTML = originalHTML;
            refreshBtn.disabled = false;
        }, 1000);
    });
}

// Set up real-time listeners
function setupRealtimeListeners() {
    try {
        // Listen for changes in products
        const productsRef = ref(db, 'products');
        onValue(productsRef, (snapshot) => {
            console.log('Products updated - reloading data');
            cacheManager.clearCache();
            loadSalesData();
        });
        
        // Listen for changes in purchases
        const purchasesRef = ref(db, 'purchases');
        onValue(purchasesRef, (snapshot) => {
            console.log('Purchases updated - reloading data');
            cacheManager.clearCache();
            loadSalesData();
        });
        
        console.log('Real-time listeners established');
    } catch (error) {
        console.error('Error setting up real-time listeners:', error);
    }
}

// Show error state
function showErrorState() {
    document.getElementById('totalSales').textContent = '₱0.00';
    document.getElementById('weeklySales').textContent = '₱0.00';
    document.getElementById('monthlySales').textContent = '₱0.00';
    document.getElementById('yearlySales').textContent = '₱0.00';
    
    document.getElementById('favoriteItems').innerHTML = `
        <div class="text-center py-8 text-red-500">
            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
            <p class="font-medium">Failed to load data</p>
            <p class="text-sm mt-1">Please check your connection and try again</p>
        </div>
    `;
    
    document.getElementById('allSoldItems').innerHTML = `
        <tr>
            <td colspan="6" class="px-6 py-8 text-center text-red-500">
                <div class="flex flex-col items-center">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p class="font-medium">Failed to load product data</p>
                    <p class="text-sm mt-1">Please refresh the page</p>
                </div>
            </td>
        </tr>
    `;
    
    document.getElementById('lowStockAlert').innerHTML = `
        <div class="text-center py-8 text-red-500">
            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
            <p class="font-medium">Failed to load stock data</p>
            <p class="text-sm mt-1">Please check your connection</p>
        </div>
    `;
}

// Performance monitoring
const performanceMonitor = {
    startTime: 0,
    
    start() {
        this.startTime = performance.now();
    },
    
    end(operation) {
        const endTime = performance.now();
        const duration = endTime - this.startTime;
        console.log(`${operation} completed in ${duration.toFixed(2)}ms`);
        
        if (duration > 1000) {
            console.warn(`${operation} took longer than expected: ${duration.toFixed(2)}ms`);
        }
    }
};

// Make functions globally available
window.initializeCharts = chartManager.initialize.bind(chartManager);
window.updateSalesTotals = uiUpdater.updateSalesTotals.bind(uiUpdater);
window.updateTopProducts = uiUpdater.updateTopProducts.bind(uiUpdater);
window.updateProductTable = uiUpdater.updateProductTable.bind(uiUpdater);
window.updateLowStockAlert = uiUpdater.updateLowStockAlert.bind(uiUpdater);
window.showErrorState = showErrorState;
window.exportData = exportData;
window.refreshData = refreshData;
window.loadSalesData = loadSalesData;
window.paginationManager = paginationManager;

// Set up event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    performanceMonitor.start();
    
    // Initialize logout modal first
    initializeLogoutModal();
    
    // Initialize charts
    chartManager.initialize();
    
    // Initialize pagination
    paginationManager.initialize();
    
    // Set up event listeners
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    
    // Load initial data
    loadSalesData();
    
    // Set up real-time listeners
    setupRealtimeListeners();
    
    performanceMonitor.end('Sales dashboard initialization');
    console.log('Sales dashboard initialized with enhanced logout functionality');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    chartManager.destroy();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'complete') {
    initializeLogoutModal();
    chartManager.initialize();
    paginationManager.initialize();
    loadSalesData();
}