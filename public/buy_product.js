import { db } from "firebase_conn.js";
import { ref as dbRef, get, set, push, onValue, update } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let productsData = [];
let cart = {}; // { key: { key, name, price, qty, imageUrl, category } }

// Pagination state
let currentPage = 1;
let productsPerPage = 8;
let filteredProducts = [];

// Modal state tracking
let activeModal = null;
let isPurchaseProcessing = false;
let isRFIDValid = false;

/* ==========================
   Enhanced Error Handling with Auto-Reset
========================== */
class POSError extends Error {
    constructor(message, type = 'error', details = null, recoverable = true) {
        super(message);
        this.name = 'POSError';
        this.type = type;
        this.details = details;
        this.recoverable = recoverable;
        this.timestamp = new Date().toISOString();
    }
}

function handleError(error, context = 'Unknown operation') {
    console.error(`POS Error in ${context}:`, error);
    
    // Don't show duplicate error notifications
    if (error._handled) return;
    error._handled = true;
    
    let userMessage = 'An unexpected error occurred. Please try again.';
    let type = 'error';
    
    if (error instanceof POSError) {
        userMessage = error.message;
        type = error.type;
    } else if (error.name === 'FirebaseError') {
        userMessage = getFirebaseErrorMessage(error);
        type = 'error';
    } else if (error.message && error.message.includes('network') || error.message.includes('offline')) {
        userMessage = 'Network connection lost. Please check your internet connection.';
        type = 'warning';
    } else if (error.message && error.message.includes('permission')) {
        userMessage = 'You do not have permission to perform this action.';
        type = 'warning';
    } else if (error.message) {
        userMessage = error.message;
    }
    
    showNotification(userMessage, type);
    return { success: false, error: userMessage, type };
}

function getFirebaseErrorMessage(firebaseError) {
    const errorCode = firebaseError.code;
    const errorMessages = {
        'permission-denied': 'Access denied. You do not have permission to perform this action.',
        'unavailable': 'Service temporarily unavailable. Please try again later.',
        'network-request-failed': 'Network error. Please check your internet connection.',
        'storage/object-not-found': 'Requested data not found.',
        'storage/quota-exceeded': 'Storage quota exceeded. Please contact administrator.',
        'storage/unauthorized': 'You are not authorized to access this data.',
        'storage/retry-limit-exceeded': 'Operation failed after multiple attempts.',
        'database/disconnected': 'Disconnected from database. Please refresh the page.',
        'database/operation-failed': 'Database operation failed. Please try again.'
    };
    
    return errorMessages[errorCode] || `Database error: ${firebaseError.message}`;
}

function formatCurrency(n) {
    try {
        if (isNaN(n) || n === null || n === undefined) {
            throw new POSError('Invalid currency value', 'warning');
        }
        return Number(n).toFixed(2);
    } catch (error) {
        handleError(error, 'formatCurrency');
        return '0.00';
    }
}

function showNotification(message, type = 'info') {
    try {
        // Remove existing notifications of the same type to prevent duplicates
        const existingNotifications = document.querySelectorAll('.pos-notification');
        existingNotifications.forEach(notification => {
            if (notification.textContent.includes(message)) {
                notification.remove();
            }
        });

        const notification = document.createElement('div');
        notification.className = `pos-notification fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300 translate-x-full ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation' : 'info'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

/* ==========================
   Enhanced Pagination Functions
========================== */
function initPagination() {
    try {
        filteredProducts = [...productsData];
        updatePaginationControls();
        displayProductsForCurrentPage();
    } catch (error) {
        handleError(error, 'initPagination');
    }
}

function updatePaginationControls() {
    try {
        const totalPages = Math.ceil(filteredProducts.length / productsPerPage) || 1;
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const currentPageEl = document.getElementById('currentPage');
        const totalPagesEl = document.getElementById('totalPages');
        const pageNumbersEl = document.getElementById('pageNumbers');
        const productsPerPageSelect = document.getElementById('productsPerPage');

        if (!prevBtn || !nextBtn || !currentPageEl || !totalPagesEl || !pageNumbersEl) {
            throw new POSError('Pagination controls not found', 'error');
        }

        // Update page numbers
        currentPageEl.textContent = currentPage;
        totalPagesEl.textContent = totalPages;
        
        // Update button states
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
        
        // Update page numbers display
        pageNumbersEl.innerHTML = '';
        
        // Show max 5 page numbers around current page
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition ${
                i === currentPage 
                    ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow' 
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => goToPage(i));
            pageNumbersEl.appendChild(pageBtn);
        }

        // Update products per page selector
        if (productsPerPageSelect) {
            productsPerPageSelect.value = productsPerPage;
        }
    } catch (error) {
        handleError(error, 'updatePaginationControls');
    }
}

function displayProductsForCurrentPage() {
    try {
        const startIndex = (currentPage - 1) * productsPerPage;
        const endIndex = startIndex + productsPerPage;
        const productsToShow = filteredProducts.slice(startIndex, endIndex);
        
        const productsList = document.getElementById('products_list');
        if (!productsList) {
            throw new POSError('Products list container not found', 'error');
        }
        
        productsList.innerHTML = '';
        
        if (productsToShow.length === 0) {
            productsList.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-search text-4xl text-gray-300 mb-3"></i>
                    <p class="text-gray-500 text-lg">No products found</p>
                    <p class="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }
        
        productsToShow.forEach(product => {
            try {
                const card = createProductCard(product);
                productsList.appendChild(card);
            } catch (error) {
                handleError(error, `createProductCard for ${product.key}`);
            }
        });
        
        updatePaginationControls();
        setupProductAdd(); // Re-bind event listeners for new product cards
    } catch (error) {
        handleError(error, 'displayProductsForCurrentPage');
    }
}

function createProductCard(product) {
    try {
        if (!product || !product.key) {
            throw new POSError('Invalid product data', 'error');
        }

        const card = document.createElement("div");
        card.className = "product-card bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-3 border border-gray-200";
        card.dataset.key = product.key;
        card.dataset.category = product.category || "all";

        // Validate product data
        const productName = product.name || 'Unnamed Product';
        const productPrice = product.price || 0;
        const productQuantity = product.quantity || 0;
        const productCategory = product.category || "Uncategorized";

        // Stock status indicator
        const stockStatus = productQuantity > 0 
            ? `<span class="absolute top-2 left-2 bg-white text-green-600 text-xs font-semibold px-2 py-1 rounded-md shadow-sm border border-green-200">In Stock</span>`
            : `<span class="absolute top-2 left-2 bg-white text-red-600 text-xs font-semibold px-2 py-1 rounded-md shadow-sm border border-red-200">Out of Stock</span>`;

        const imgHtml = product.imageUrl
            ? `<img src="${product.imageUrl}" alt="${productName}" class="w-full h-40 object-cover rounded-lg" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200?text=No+Image'">`
            : `<div class="w-full h-40 bg-gray-100 flex items-center justify-center rounded-lg text-gray-400 text-3xl">
                 <i class="fas fa-utensils"></i>
               </div>`;

        card.innerHTML = `
            <div class="flex-1 relative">
                ${imgHtml}
                ${stockStatus}
                <span class="absolute top-2 right-2 bg-blue-500 text-white text-sm font-bold px-3 py-1 rounded-md shadow-sm">
                    ₱${formatCurrency(productPrice)}
                </span>
            </div>
            <div class="flex flex-col gap-1">
                <h3 class="text-base font-bold text-gray-900 leading-tight">${productName}</h3>
                <p class="text-sm text-gray-500">${productCategory}</p>
                <p class="text-xs ${productQuantity <= 5 ? 'text-red-500 font-semibold' : 'text-gray-400'}">
                    Stock: ${productQuantity}
                </p>
            </div>
            <div class="flex items-center justify-between mt-2">
                <button
                    class="add-btn w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold shadow-sm hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
                    data-key="${product.key}"
                    ${productQuantity <= 0 ? 'disabled' : ''}
                >
                    <i class="fas fa-cart-plus"></i> 
                    ${productQuantity <= 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        `;
        
        return card;
    } catch (error) {
        handleError(error, 'createProductCard');
        // Return a basic error card
        const errorCard = document.createElement("div");
        errorCard.className = "product-card bg-red-50 rounded-xl p-5 flex flex-col gap-4 border border-red-200";
        errorCard.innerHTML = `
            <div class="text-center text-red-500">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p class="text-sm">Error loading product</p>
            </div>
        `;
        return errorCard;
    }
}

function goToPage(page) {
    try {
        if (page < 1 || page > Math.ceil(filteredProducts.length / productsPerPage)) {
            throw new POSError('Invalid page number', 'warning');
        }
        
        currentPage = page;
        displayProductsForCurrentPage();
        
        // Scroll to top of products section
        const productsSection = document.getElementById('products_list');
        if (productsSection) {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        handleError(error, 'goToPage');
    }
}

function resetToFirstPage() {
    try {
        currentPage = 1;
        displayProductsForCurrentPage();
    } catch (error) {
        handleError(error, 'resetToFirstPage');
    }
}

/* ==========================
   ENHANCED MODAL SYSTEM - Fixed State Management
========================== */
let modalResolve = null;
let modalReject = null;

function showPurchaseModal(selectedProducts, totalPrice, userData = null, type = 'confirm') {
    return new Promise((resolve, reject) => {
        try {
            if (activeModal === 'purchase') {
                // If modal is already showing, close it first
                cleanupModal();
            }
            
            modalResolve = resolve;
            modalReject = reject;
            activeModal = 'purchase';

            const modal = document.getElementById('purchaseModal');
            const header = document.getElementById('purchaseModalHeader');
            const title = document.getElementById('purchaseModalTitle');
            const icon = document.getElementById('purchaseModalIcon');
            const message = document.getElementById('purchaseMessage');
            const primaryBtn = document.getElementById('purchasePrimaryBtn');
            const secondaryBtn = document.getElementById('purchaseSecondaryBtn');
            const closeBtn = document.getElementById('purchaseClose');

            if (!modal || !header || !title || !icon || !message || !primaryBtn || !secondaryBtn || !closeBtn) {
                throw new POSError('Purchase modal elements not found', 'error');
            }

            // Configure modal based on type
            const modalConfigs = {
                confirm: {
                    headerClass: 'from-blue-500 to-cyan-600',
                    icon: 'fa-shopping-cart',
                    title: 'Confirm Purchase',
                    primaryText: 'Confirm Purchase',
                    primaryClass: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
                    secondaryText: 'Cancel',
                    message: generateConfirmMessage(selectedProducts, totalPrice)
                },
                processing: {
                    headerClass: 'from-blue-500 to-cyan-600',
                    icon: 'fa-cog fa-spin',
                    title: 'Processing Purchase',
                    primaryText: 'Processing...',
                    primaryClass: 'from-blue-500 to-blue-600 opacity-75 cursor-not-allowed',
                    secondaryText: 'Cancel',
                    message: generateProcessingMessage(),
                    disablePrimary: true
                },
                success: {
                    headerClass: 'from-green-500 to-emerald-600',
                    icon: 'fa-check-circle',
                    title: 'Purchase Successful',
                    primaryText: 'Done',
                    primaryClass: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
                    secondaryText: '',
                    message: generateSuccessMessage(selectedProducts, totalPrice, userData)
                },
                error: {
                    headerClass: 'from-red-500 to-orange-600',
                    icon: 'fa-exclamation-triangle',
                    title: 'Purchase Failed',
                    primaryText: 'OK',
                    primaryClass: 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
                    secondaryText: '',
                    message: generateErrorMessage(selectedProducts, totalPrice)
                }
            };

            const config = modalConfigs[type] || modalConfigs.confirm;

            // Update modal appearance with enhanced visibility
            header.className = `modal-header bg-gradient-to-r ${config.headerClass} text-white font-bold`;
            title.innerHTML = `<i class="fas ${config.icon} mr-3"></i><span class="text-white font-bold drop-shadow-sm">${config.title}</span>`;
            
            icon.className = `modal-icon bg-white bg-opacity-20 rounded-full p-4 mb-4 flex items-center justify-center`;
            if (type === 'processing') {
                icon.innerHTML = `<div class="spinner-large"></div>`;
            } else {
                icon.innerHTML = `<i class="fas ${config.icon} text-white text-3xl drop-shadow-sm"></i>`;
            }

            // Update message content
            message.innerHTML = config.message;

            // Update buttons
            primaryBtn.textContent = config.primaryText;
            primaryBtn.className = `px-6 py-3 bg-gradient-to-r ${config.primaryClass} text-white font-bold rounded-lg shadow-md transition-all duration-200 min-w-32 flex items-center justify-center`;
            
            if (config.disablePrimary) {
                primaryBtn.disabled = true;
                primaryBtn.innerHTML = '<div class="spinner-small mr-2"></div> Processing...';
            } else {
                primaryBtn.disabled = false;
                primaryBtn.innerHTML = config.primaryText;
            }

            if (config.secondaryText) {
                secondaryBtn.textContent = config.secondaryText;
                secondaryBtn.classList.remove('hidden');
            } else {
                secondaryBtn.classList.add('hidden');
            }

            // Clear existing event listeners
            primaryBtn.replaceWith(primaryBtn.cloneNode(true));
            secondaryBtn.replaceWith(secondaryBtn.cloneNode(true));
            closeBtn.replaceWith(closeBtn.cloneNode(true));

            // Get fresh references
            const freshPrimaryBtn = document.getElementById('purchasePrimaryBtn');
            const freshSecondaryBtn = document.getElementById('purchaseSecondaryBtn');
            const freshCloseBtn = document.getElementById('purchaseClose');

            // Set up modal
            modal.classList.remove('hidden');

            // Add new event listeners
            freshPrimaryBtn.addEventListener('click', () => handleModalPrimary(type));
            if (config.secondaryText) {
                freshSecondaryBtn.addEventListener('click', handleModalSecondary);
                freshCloseBtn.addEventListener('click', handleModalSecondary);
            }
            
            modal.addEventListener('click', handleModalBackdropClick);
            document.addEventListener('keydown', handleModalEscapeKey);

            // Focus management
            setTimeout(() => {
                if (config.secondaryText && !config.disablePrimary) {
                    freshSecondaryBtn.focus();
                } else if (!config.disablePrimary) {
                    freshPrimaryBtn.focus();
                }
            }, 100);

        } catch (error) {
            reject(error);
        }
    });
}

function generateConfirmMessage(selectedProducts, totalPrice) {
    return `
        <div class="text-left space-y-4">
            <p class="font-bold text-gray-800 text-lg mb-2 text-center">Confirm Your Order</p>
            
            <div class="max-h-60 overflow-y-auto space-y-3 border-b border-gray-200 pb-4">
                ${selectedProducts.map(p => `
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div class="flex-shrink-0">
                            ${p.imageUrl 
                                ? `<img src="${p.imageUrl}" alt="${p.product_name}" class="w-12 h-12 object-cover rounded-lg shadow-sm">`
                                : `<div class="w-12 h-12 bg-gray-200 flex items-center justify-center rounded-lg text-gray-500">
                                     <i class="fas fa-utensils"></i>
                                   </div>`
                            }
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-gray-800 text-sm truncate">${p.product_name}</p>
                            <p class="text-xs text-gray-600">${p.quantity} × ₱${formatCurrency(p.price)}</p>
                        </div>
                        <div class="flex-shrink-0">
                            <p class="font-bold text-gray-800 text-sm">₱${formatCurrency(p.subtotal)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="space-y-2 pt-2">
                <div class="flex justify-between items-center text-lg font-bold text-gray-900">
                    <span>Total Amount:</span>
                    <span class="text-blue-600">₱${formatCurrency(totalPrice)}</span>
                </div>
            </div>
            
            <div class="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mt-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-shopping-cart text-white text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <p class="font-bold text-blue-900 text-base">Ready to Complete Purchase?</p>
                        <p class="text-sm text-blue-700 mt-1">Please confirm to proceed with your order</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateProcessingMessage() {
    return `
        <div class="text-center space-y-4">
            <div class="space-y-3 text-gray-800 font-medium">
                <p class="text-lg font-bold text-blue-600">Processing Your Purchase</p>
                <p class="text-sm text-gray-600">Please wait while we complete your transaction</p>
                <div class="pt-4">
                    <div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                        <div class="spinner-small-blue"></div>
                        <span class="text-blue-700 text-sm font-medium">Processing payment...</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateErrorMessage(selectedProducts, totalPrice) {
    return `
        <div class="text-left space-y-4">
            <p class="font-bold text-red-600 text-xl mb-3 text-center">❌ Purchase Failed</p>
            <div class="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-exclamation-triangle text-white text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <p class="font-bold text-red-900 text-base">Transaction Failed</p>
                        <p class="text-sm text-red-700 mt-1">Please check your balance and try again</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateSuccessMessage(selectedProducts, totalPrice, userData) {
    const newBalance = userData ? (parseFloat(userData.balance) || 0) - totalPrice : 0;
    const studentName = userData ? `${userData.first_name || userData.student_fname || ""} ${userData.last_name || userData.student_lname || ""}`.trim() : '';
    
    return `
        <div class="text-left space-y-4">
            <p class="font-bold text-green-600 text-xl mb-3 text-center">🎉 Purchase Successful!</p>
            
            ${studentName ? `<p class="text-center text-gray-700 font-medium mb-2">Thank you, <span class="font-bold">${studentName}</span>!</p>` : ''}
            
            <div class="max-h-60 overflow-y-auto space-y-3 border-b border-gray-200 pb-4">
                ${selectedProducts.map(p => `
                    <div class="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                        <div class="flex-shrink-0">
                            ${p.imageUrl 
                                ? `<img src="${p.imageUrl}" alt="${p.product_name}" class="w-12 h-12 object-cover rounded-lg shadow-sm">`
                                : `<div class="w-12 h-12 bg-green-100 flex items-center justify-center rounded-lg text-green-500">
                                     <i class="fas fa-utensils"></i>
                                   </div>`
                            }
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-gray-800 text-sm truncate">${p.product_name}</p>
                            <p class="text-xs text-gray-600">${p.quantity} × ₱${formatCurrency(p.price)}</p>
                        </div>
                        <div class="flex-shrink-0">
                            <p class="font-bold text-green-600 text-sm">₱${formatCurrency(p.subtotal)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="space-y-3 pt-3">
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-semibold text-gray-700">Amount Paid:</span>
                        <span class="font-bold text-green-600 text-lg">₱${formatCurrency(totalPrice)}</span>
                    </div>
                    ${userData ? `
                        <div class="flex justify-between items-center text-sm text-gray-600 mb-2">
                            <span>Previous Balance:</span>
                            <span class="font-medium">₱${formatCurrency(userData.balance)}</span>
                        </div>
                        <div class="border-t border-green-200 pt-2 mt-2">
                            <div class="flex justify-between items-center">
                                <span class="font-bold text-gray-800 text-base">New Balance:</span>
                                <span class="font-bold text-blue-600 text-xl">₱${formatCurrency(newBalance)}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <p class="text-sm text-green-600 text-center font-medium mt-4">
                    <i class="fas fa-check-circle mr-1"></i>
                    Transaction completed successfully!
                </p>
            </div>
        </div>
    `;
}

/* ==========================
   Search Functionality
========================== */
function setupSearchBar() {
    try {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const productsPerPageSelect = document.getElementById('productsPerPage');

        // Search when button is clicked
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }
        
        // Search when Enter key is pressed
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
            
            // Real-time search with debounce
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(performSearch, 300);
            });
        }

        // Clear search functionality
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', clearSearch);
        }
        
        // Products per page selector
        if (productsPerPageSelect) {
            productsPerPageSelect.addEventListener('change', (e) => {
                productsPerPage = parseInt(e.target.value);
                resetToFirstPage();
            });
        }
    } catch (error) {
        handleError(error, 'setupSearchBar');
    }
}

function performSearch() {
    try {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.trim().toLowerCase();
        const activeCategory = getActiveCategory();
        
        // Filter products based on search term and category
        filteredProducts = productsData.filter(product => {
            const matchesSearch = !searchTerm || 
                             product.name.toLowerCase().includes(searchTerm) || 
                             (product.category || '').toLowerCase().includes(searchTerm) ||
                             product.price.toString().includes(searchTerm) ||
                             (product.description || '').toLowerCase().includes(searchTerm);
            
            const matchesCategory = activeCategory === 'all' || (product.category || '') === activeCategory;
            
            return matchesSearch && matchesCategory;
        });
        
        resetToFirstPage();
    } catch (error) {
        handleError(error, 'performSearch');
    }
}

function clearSearch() {
    try {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            filteredProducts = [...productsData];
            resetToFirstPage();
        }
    } catch (error) {
        handleError(error, 'clearSearch');
    }
}

function getActiveCategory() {
    try {
        const activeBtn = document.querySelector('.category-btn.active');
        return activeBtn ? activeBtn.dataset.category : 'all';
    } catch (error) {
        handleError(error, 'getActiveCategory');
        return 'all';
    }
}

/* ==========================
   Load Products
========================== */
async function loadProductsForSale() {
    try {
        const productsRef = dbRef(db, 'products');
        const snapshot = await get(productsRef);
        productsData = [];

        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                const key = child.key;
                const isArchived = (data.archived === true) || (data.status && data.status.toLowerCase() === 'archived');
                if (isArchived) return;

                productsData.push({ key, ...data });
            });
        }

        // Initialize pagination with all products
        initPagination();
        applyDefaultCategory();
    } catch (error) {
        handleError(error, 'loadProductsForSale');
    }
}

/* ==========================
   Cart / Invoice rendering
========================== */
function updateInvoiceItems() {
    try {
        const container = document.getElementById('invoice_items');
        const purchaseBtn = document.getElementById('purchaseBtn');
        const rfidInput = document.getElementById('card_number_buy');
        const cartCount = document.getElementById('cartCount');
        
        if (!container) {
            throw new POSError('Invoice container not found', 'error');
        }

        container.innerHTML = '';
        let total = 0;
        let totalItems = 0;

        if (Object.keys(cart).length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <i class="fas fa-shopping-cart text-3xl mb-2"></i>
                    <p class="text-sm">Your cart is empty</p>
                </div>
            `;
            document.getElementById('total_price').textContent = formatCurrency(0);
            
            // Update cart count display
            if (cartCount) {
                cartCount.textContent = '0';
            }
            
            // Disable purchase button and RFID input when cart is empty
            if (purchaseBtn) purchaseBtn.disabled = true;
            if (rfidInput) {
                rfidInput.disabled = true;
                rfidInput.value = '';
                rfidInput.classList.remove('border-green-500', 'border-red-500');
            }
            return;
        }

        Object.values(cart).forEach(item => {
            const itemTotal = item.qty * Number(item.price);
            total += itemTotal;
            totalItems += item.qty;

            const row = document.createElement('div');
            row.className = "invoice-item bg-white rounded-lg p-3 mb-3 border border-gray-200";

            // Create image HTML for the order summary
            const imgHtml = item.imageUrl
                ? `<img src="${item.imageUrl}" alt="${item.name}" class="w-12 h-12 object-cover rounded-lg shadow-sm" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200?text=No+Image'">`
                : `<div class="w-12 h-12 bg-gray-100 flex items-center justify-center rounded-lg text-gray-400">
                     <i class="fas fa-utensils text-lg"></i>
                   </div>`;

            row.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        ${imgHtml}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between mb-2">
                            <h4 class="font-semibold text-gray-800 text-sm truncate flex-1">${item.name}</h4>
                            <button class="remove-item text-red-500 hover:text-red-600 ml-2 flex-shrink-0" data-key="${item.key}" title="Remove">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <button class="quantity-btn w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs" data-key="${item.key}" data-change="-1">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <span class="text-sm font-semibold w-8 text-center">${item.qty}</span>
                                <button class="quantity-btn w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs" data-key="${item.key}" data-change="1">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                            <span class="font-bold text-gray-800">₱${formatCurrency(itemTotal)}</span>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(row);
        });

        document.getElementById('total_price').textContent = formatCurrency(total);
        
        // Update cart count display
        if (cartCount) {
            cartCount.textContent = totalItems.toString();
        }
        
        // Enable purchase button and RFID input when there are items in cart
        if (purchaseBtn) purchaseBtn.disabled = false;
        if (rfidInput) {
            rfidInput.disabled = false;
            // Auto-focus RFID input when items are added to cart
            if (Object.keys(cart).length > 0) {
                setTimeout(() => {
                    rfidInput.focus();
                    rfidInput.select();
                }, 100);
            }
        }
        
        bindInvoiceControls();
    } catch (error) {
        handleError(error, 'updateInvoiceItems');
    }
}

/* ==========================
   Cart Controls
========================== */
function bindInvoiceControls() {
    try {
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.dataset.key;
                const change = parseInt(this.dataset.change);
                updateCartItemQuantity(key, change);
            });
        });

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const key = this.dataset.key;
                delete cart[key];
                updateInvoiceItems();
                showNotification('Item removed from cart', 'success');
            });
        });
    } catch (error) {
        handleError(error, 'bindInvoiceControls');
    }
}

function updateCartItemQuantity(key, change) {
    try {
        if (!cart[key]) return;
        
        const newQuantity = cart[key].qty + change;
        
        if (newQuantity <= 0) {
            delete cart[key];
            showNotification('Item removed from cart', 'success');
        } else {
            cart[key].qty = newQuantity;
        }
        
        updateInvoiceItems();
    } catch (error) {
        handleError(error, 'updateCartItemQuantity');
    }
}

/* ==========================
   Product Add button
========================== */
function setupProductAdd() {
    try {
        const productsList = document.getElementById('products_list');
        if (!productsList) return;
        
        // Remove existing event listeners and add new ones
        productsList.removeEventListener('click', handleProductAdd);
        productsList.addEventListener('click', handleProductAdd);
    } catch (error) {
        handleError(error, 'setupProductAdd');
    }
}

function handleProductAdd(e) {
    try {
        const btn = e.target.closest('.add-btn');
        if (!btn) return;
        const key = btn.dataset.key;
        const product = productsData.find(p => p.key === key);
        if (!product) return;

        if (!cart[key]) {
            cart[key] = { 
                key, 
                name: product.name, 
                price: Number(product.price), 
                qty: 1, 
                imageUrl: product.imageUrl || '', 
                category: product.category || '' 
            };
        } else {
            cart[key].qty += 1;
        }
        
        updateInvoiceItems();
        showNotification(`Added ${product.name} to cart`, 'success');
    } catch (error) {
        handleError(error, 'handleProductAdd');
    }
}

/* ==========================
   Category Filter
========================== */
function setupCategoryFilter() {
    try {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                
                // Update button styles
                document.querySelectorAll('.category-btn').forEach(b => {
                    b.classList.remove('active', 'bg-gradient-to-r', 'from-green-500', 'to-blue-500', 'text-white', 'shadow', 'ring-2', 'ring-blue-400');
                    b.classList.add('bg-white', 'text-gray-800', 'border', 'border-gray-200');
                });
                btn.classList.remove('bg-white', 'text-gray-800', 'border', 'border-gray-200');
                btn.classList.add('active', 'bg-gradient-to-r', 'from-green-500', 'to-blue-500', 'text-white', 'shadow', 'ring-2', 'ring-blue-400');

                // Apply category filter
                const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
                
                filteredProducts = productsData.filter(product => {
                    const matchesSearch = !searchTerm || 
                                     product.name.toLowerCase().includes(searchTerm) || 
                                     (product.category || '').toLowerCase().includes(searchTerm) ||
                                     product.price.toString().includes(searchTerm) ||
                                     (product.description || '').toLowerCase().includes(searchTerm);
                    
                    const matchesCategory = category === 'all' || (product.category || '') === category;
                    
                    return matchesSearch && matchesCategory;
                });
                
                resetToFirstPage();
            });
        });

        applyDefaultCategory();
    } catch (error) {
        handleError(error, 'setupCategoryFilter');
    }
}

function applyDefaultCategory() {
    try {
        const allBtn = document.querySelector('.category-btn[data-category="all"]');
        if (allBtn) {
            document.querySelectorAll('.category-btn').forEach(b => { 
                b.classList.remove('active', 'bg-gradient-to-r', 'from-green-500', 'to-blue-500', 'text-white', 'shadow', 'ring-2', 'ring-blue-400'); 
                b.classList.add('bg-white', 'text-gray-800', 'border', 'border-gray-200'); 
            });
            allBtn.classList.remove('bg-white', 'text-gray-800', 'border', 'border-gray-200');
            allBtn.classList.add('active', 'bg-gradient-to-r', 'from-green-500', 'to-blue-500', 'text-white', 'shadow', 'ring-2', 'ring-blue-400');
        }
    } catch (error) {
        handleError(error, 'applyDefaultCategory');
    }
}

/* ==========================
   Enhanced Modal Event Handlers with Retry Support
========================== */
function handleModalPrimary(type) {
    try {
        if (type === 'confirm') {
            // User confirmed purchase
            if (modalResolve) {
                modalResolve(true);
            }
        } else if (type === 'success') {
            // User clicked "Done" on success modal - trigger reset and close
            cleanupModal();
            resetAfterPurchase();
            if (modalResolve) {
                modalResolve(true);
            }
        } else if (type === 'error') {
            // User clicked "OK" on error modal - just close and allow retry
            cleanupModal();
            resetAfterError(); // New function to reset only necessary states
            if (modalResolve) {
                modalResolve(false); // Resolve with false to indicate error was acknowledged
            }
        } else {
            // For other states - just close
            cleanupModal();
            if (modalResolve) {
                modalResolve(true);
            }
        }
    } catch (error) {
        handleError(error, 'handleModalPrimary');
    }
}

function handleModalSecondary() {
    try {
        cleanupModal();
        resetAfterError(); // Reset states on cancellation
        if (modalReject) {
            modalReject(new POSError('User cancelled', 'info'));
        }
    } catch (error) {
        handleError(error, 'handleModalSecondary');
    }
}

function handleModalBackdropClick(e) {
    try {
        if (e.target.id === 'purchaseModal') {
            handleModalSecondary();
        }
    } catch (error) {
        handleError(error, 'handleModalBackdropClick');
    }
}

function handleModalEscapeKey(e) {
    try {
        if (e.key === 'Escape' && activeModal === 'purchase') {
            handleModalSecondary();
        }
    } catch (error) {
        handleError(error, 'handleModalEscapeKey');
    }
}

function cleanupModal() {
    try {
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.removeEventListener('click', handleModalBackdropClick);
        }
        document.removeEventListener('keydown', handleModalEscapeKey);
        
        activeModal = null;
        modalResolve = null;
        modalReject = null;
    } catch (error) {
        console.error('Error cleaning up modal:', error);
    }
}

/* ==========================
   Export Functions for Global Access
========================== */
window.clearCart = function() {
    cart = {};
    updateInvoiceItems();
};

window.getCartTotal = function() {
    return Object.values(cart).reduce((total, item) => total + (item.qty * Number(item.price)), 0);
};

window.getCartItemCount = function() {
    return Object.values(cart).reduce((total, item) => total + item.qty, 0);
};

/* ==========================
   SIMPLIFIED PURCHASE HANDLING - Single Modal Flow
========================== */
function setupPurchaseForm() {
    try {
        const purchaseBtn = document.getElementById('purchaseBtn');
        const rfidInput = document.getElementById('card_number_buy');

        if (!purchaseBtn || !rfidInput) return;

        purchaseBtn.addEventListener('click', handlePurchase);

        // Also allow Enter key in RFID input to trigger purchase
        rfidInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !purchaseBtn.disabled) {
                handlePurchase();
            }
        });
    } catch (error) {
        handleError(error, 'setupPurchaseForm');
    }
}

async function handlePurchase() {
    if (isPurchaseProcessing) {
        showNotification('Purchase already in progress. Please wait...', 'warning');
        return;
    }

    const purchaseBtn = document.getElementById('purchaseBtn');
    const rfidInput = document.getElementById('card_number_buy');
    
    if (!purchaseBtn || !rfidInput) {
        showNotification('System error: Purchase elements not found', 'error');
        return;
    }

    try {
        isPurchaseProcessing = true;
        purchaseBtn.disabled = true;
        rfidInput.disabled = true;
        purchaseBtn.innerHTML = '<div class="spinner-small mr-2"></div> Processing...';

        // Validate cart
        if (Object.keys(cart).length === 0) {
            throw new POSError('Your cart is empty. Please add products before purchasing.', 'warning');
        }

        // Validate RFID
        const cardNumber = rfidInput.value.trim();
        if (!cardNumber) {
            throw new POSError('Please enter your RFID card number.', 'warning');
        }
        if (cardNumber.length !== 10) {
            throw new POSError('RFID card number must be exactly 10 digits.', 'warning');
        }

        const totalPrice = parseFloat(document.getElementById('total_price').textContent) || 0;
        if (totalPrice <= 0) {
            throw new POSError('Invalid total price. Please refresh the page and try again.', 'error');
        }

        // Prepare selected products
        const selectedProducts = Object.values(cart).map(item => ({
            product_name: item.name,
            quantity: item.qty,
            price: Number(item.price),
            subtotal: Number(item.price) * item.qty,
            imageUrl: item.imageUrl || null,
            product_key: item.key
        }));

        // Step 1: Show confirmation modal
        const confirmed = await showPurchaseModal(selectedProducts, totalPrice, null, 'confirm');
        if (!confirmed) {
            throw new POSError('Purchase cancelled by user.', 'info');
        }

        // Step 2: Validate user and balance
        const { userKey, userData, userError } = await validateUserAndBalance(cardNumber, totalPrice);
        if (userError) {
            throw new POSError(userError, 'warning');
        }

        // Step 3: Validate product availability
        const { quantityUpdates, availabilityError } = await validateProductAvailability(selectedProducts);
        if (availabilityError) {
            throw new POSError(availabilityError, 'warning');
        }

        // Step 4: Show processing modal (non-blocking)
        showPurchaseModal(selectedProducts, totalPrice, null, 'processing');
        
        // Small delay to ensure processing modal is visible
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 5: Process purchase
        await processPurchase(userKey, userData, selectedProducts, totalPrice, quantityUpdates);

        // Step 6: Close processing modal and show success
        cleanupModal(); // Close processing modal first
        await new Promise(resolve => setTimeout(resolve, 300)); // Smooth transition
        
        await showPurchaseModal(selectedProducts, totalPrice, userData, 'success');

        // Step 7: Reset and cleanup (full reset on success)
        resetAfterPurchase();

    } catch (error) {
        // Close any open modals first
        cleanupModal();
        
        if (error.message && !error.message.includes('cancelled')) {
            // Show error modal for actual errors - this will now allow retry
            await showPurchaseModal([], 0, null, 'error');
            
            // Don't show duplicate notification for user-friendly errors
            if (!error.message.includes('empty') && 
                !error.message.includes('RFID') && 
                !error.message.includes('balance') &&
                !error.message.includes('stock')) {
                handleError(error, 'handlePurchase');
            }
        }
        
        // Use resetAfterError to preserve cart for retry
        resetAfterError();
        
    } finally {
        isPurchaseProcessing = false;
        // Note: Button states are now handled in resetAfterError and resetAfterPurchase
    }
}

async function validateUserAndBalance(cardNumber, totalPrice) {
    try {
        const usersSnap = await get(dbRef(db, 'student_users'));
        
        if (!usersSnap.exists()) {
            return { userError: 'User database not available. Please contact administrator.' };
        }

        let userKey = null, userData = null;
        
        usersSnap.forEach(child => {
            const user = child.val();
            if (String(user.id_number) === cardNumber) {
                userKey = child.key;
                userData = user;
            }
        });

        if (!userKey) {
            return { userError: 'RFID card not found. Please check the card number or contact administrator.' };
        }

        // Validate user data structure
        if (!userData || typeof userData !== 'object') {
            return { userError: 'Invalid user data. Please contact administrator.' };
        }

        if (userData.disabled === true) {
            return { userError: 'This account is temporarily disabled. Please contact administrator.' };
        }

        const currentBalance = parseFloat(userData.balance) || 0;
        if (isNaN(currentBalance)) {
            return { userError: 'Invalid account balance. Please contact administrator.' };
        }

        if (currentBalance < totalPrice) {
            return { 
                userError: `Insufficient balance. Current: ₱${formatCurrency(currentBalance)}, Required: ₱${formatCurrency(totalPrice)}` 
            };
        }

        return { userKey, userData };
    } catch (error) {
        handleError(error, 'validateUserAndBalance');
        return { userError: 'Error validating user account. Please try again.' };
    }
}

async function validateProductAvailability(selectedProducts) {
    try {
        const quantityUpdates = {};
        const unavailableProducts = [];

        for (const item of selectedProducts) {
            if (!item.product_key) {
                unavailableProducts.push(`${item.product_name} (Invalid product ID)`);
                continue;
            }

            const productRef = dbRef(db, `products/${item.product_key}`);
            const productSnap = await get(productRef);
            
            if (!productSnap.exists()) {
                unavailableProducts.push(`${item.product_name} (Product not found)`);
                continue;
            }

            const productData = productSnap.val();
            const currentQuantity = parseInt(productData.quantity) || 0;
            
            if (isNaN(currentQuantity)) {
                unavailableProducts.push(`${item.product_name} (Invalid stock data)`);
                continue;
            }

            if (currentQuantity < item.quantity) {
                unavailableProducts.push(`${item.product_name} (Available: ${currentQuantity}, Requested: ${item.quantity})`);
            } else {
                quantityUpdates[item.product_key] = currentQuantity - item.quantity;
            }
        }

        if (unavailableProducts.length > 0) {
            return { 
                availabilityError: `Insufficient stock for:<br><br>${unavailableProducts.map(p => `• ${p}`).join('<br>')}` 
            };
        }

        return { quantityUpdates };
    } catch (error) {
        handleError(error, 'validateProductAvailability');
        return { availabilityError: 'Error checking product availability. Please try again.' };
    }
}

async function processPurchase(userKey, userData, selectedProducts, totalPrice, quantityUpdates) {
    try {
        const updatePromises = [];
        const batchErrors = [];

        // Update product quantities
        for (const [productKey, newQuantity] of Object.entries(quantityUpdates)) {
            try {
                const productRef = dbRef(db, `products/${productKey}`);
                updatePromises.push(update(productRef, { quantity: newQuantity }));
            } catch (error) {
                batchErrors.push(`Failed to update product ${productKey}: ${error.message}`);
            }
        }

        // Update user balance - FIXED SYNTAX ERROR
        const newBalance = (parseFloat(userData.balance) || 0) - totalPrice;
        if (isNaN(newBalance)) {
            throw new POSError('Invalid balance calculation', 'error');
        }

        try {
            const userRef = dbRef(db, `student_users/${userKey}`);
            updatePromises.push(update(userRef, { balance: newBalance }));
        } catch (error) {
            batchErrors.push(`Failed to update user balance: ${error.message}`);
        }

        // Create purchase record
        try {
            const purchaseRef = push(dbRef(db, 'purchases'));
            const purchaseData = {
                id_number: userData.id_number,
                lrn_number: userData.lrn_number || "",
                student_name: `${userData.first_name || userData.student_fname || ""} ${userData.last_name || userData.student_lname || ""}`.replace(/\s+/g, " ").trim(),
                products: selectedProducts,
                total_amount: totalPrice,
                timestamp: Date.now(),
                date: new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }),
                time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' })
            };
            updatePromises.push(set(purchaseRef, purchaseData));
        } catch (error) {
            batchErrors.push(`Failed to create purchase record: ${error.message}`);
        }

        // Create log entry
        try {
            const logRef = push(dbRef(db, 'logs'));
            updatePromises.push(set(logRef, {
                message: `Purchase: ${userData.first_name || userData.student_fname || ""} ${userData.last_name || userData.student_lname || ""} (${userData.id_number}) bought ${selectedProducts.length} items totaling ₱${formatCurrency(totalPrice)}`,
                timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
            }));
        } catch (error) {
            batchErrors.push(`Failed to create log entry: ${error.message}`);
        }

        // Execute all updates
        if (batchErrors.length > 0) {
            throw new POSError(`Partial failure: ${batchErrors.join('; ')}`, 'warning');
        }

        await Promise.all(updatePromises);
        await updateLocalProductsData();

    } catch (error) {
        handleError(error, 'processPurchase');
        throw error; // Re-throw to be handled by caller
    }
}

/* ==========================
   Reset After Error (Preserves Cart)
========================== */
function resetAfterError() {
    try {
        console.log('🔄 resetAfterError() called - preserving cart for retry');
        
        const rfidInput = document.getElementById('card_number_buy');
        const purchaseBtn = document.getElementById('purchaseBtn');
        
        // 1. Reset RFID input but keep cart intact
        if (rfidInput) {
            rfidInput.value = '';
            rfidInput.disabled = false; // Keep enabled for retry
            rfidInput.classList.remove('border-green-500', 'border-red-500');
            console.log('✅ RFID reset for retry');
        }
        
        // 2. Reset purchase button
        if (purchaseBtn) {
            purchaseBtn.disabled = false;
            purchaseBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Complete Purchase';
            console.log('✅ Purchase button reset for retry');
        }
        
        // 3. Reset processing states but keep cart
        isRFIDValid = false;
        isPurchaseProcessing = false;
        console.log('✅ States reset for retry');
        
        // 4. Focus on RFID input for immediate retry
        setTimeout(() => {
            if (rfidInput && Object.keys(cart).length > 0) {
                rfidInput.focus();
                rfidInput.select();
            }
        }, 300);
        
        console.log('🎉 resetAfterError() completed - cart preserved for retry');
        
    } catch (error) {
        console.error('❌ Error in resetAfterError:', error);
        handleError(error, 'resetAfterError');
    }
}

function resetAfterPurchase() {
    try {
        console.log('🔄 resetAfterPurchase() called');
        console.log('📦 Cart before reset:', Object.keys(cart).length, 'items');
        
        const rfidInput = document.getElementById('card_number_buy');
        const purchaseBtn = document.getElementById('purchaseBtn');
        
        // 1. Clear cart
        cart = {};
        console.log('✅ Cart cleared');
        
        // 2. Update UI
        updateInvoiceItems();
        console.log('✅ Invoice updated');
        
        // 3. Reset RFID
        if (rfidInput) {
            rfidInput.value = '';
            rfidInput.disabled = true;
            console.log('✅ RFID reset');
        }
        
        // 4. Reset button
        if (purchaseBtn) {
            purchaseBtn.disabled = true;
            purchaseBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Complete Purchase';
            console.log('✅ Purchase button reset');
        }
        
        // 5. Reset states
        isRFIDValid = false;
        isPurchaseProcessing = false;
        console.log('✅ States reset');
        
        // 6. Refresh products
        updateLocalProductsData();
        console.log('✅ Products refreshed');
        
        console.log('🎉 resetAfterPurchase() completed successfully');
        
    } catch (error) {
        console.error('❌ Error in resetAfterPurchase:', error);
        handleError(error, 'resetAfterPurchase');
    }
}

/* ==========================
   Update Local Products Data
========================== */
async function updateLocalProductsData() {
    try {
        const productsRef = dbRef(db, 'products');
        const snapshot = await get(productsRef);
        productsData = [];

        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                const key = child.key;
                const isArchived = (data.archived === true) || (data.status && data.status.toLowerCase() === 'archived');
                if (isArchived) return;

                productsData.push({ key, ...data });
            });
        }

        // Update the displayed products with new quantities
        displayProductsForCurrentPage();
    } catch (error) {
        handleError(error, 'updateLocalProductsData');
    }
}

/* ==========================
   RFID Input Validation & Auto-focus
========================== */
function setupRFIDValidation() {
    try {
        const rfidInput = document.getElementById('card_number_buy');
        const purchaseBtn = document.getElementById('purchaseBtn');
        
        if (!rfidInput || !purchaseBtn) return;

        // Initial state - disabled when no items in cart
        rfidInput.disabled = true;
        purchaseBtn.disabled = true;

        function focusRFIDInput() {
            if (!rfidInput.disabled) {
                rfidInput.focus();
                rfidInput.select();
            }
        }
        window.focusRFIDInput = focusRFIDInput;

        rfidInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
            isRFIDValid = this.value.length === 10;
            this.classList.toggle('border-green-500', isRFIDValid);
            this.classList.toggle('border-red-500', !isRFIDValid && this.value.length > 0);
            purchaseBtn.disabled = !isRFIDValid || Object.keys(cart).length === 0;
        });

        rfidInput.addEventListener('keydown', function(e) {
            if ([46, 8, 9, 27, 13, 110].includes(e.keyCode) || (e.keyCode >= 35 && e.keyCode <= 39)) return;
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) e.preventDefault();
        });

        // Auto-focus when cart has items (handled in updateInvoiceItems)
    } catch (error) {
        handleError(error, 'setupRFIDValidation');
    }
}

/* ==========================
   Real-time Product Updates
========================== */
function setupRealTimeProductUpdates() {
    try {
        // Listen for real-time updates to products
        const productsRef = dbRef(db, 'products');
        
        // This will update the local productsData whenever Firebase changes
        onValue(productsRef, (snapshot) => {
            try {
                productsData = [];
                
                if (snapshot.exists()) {
                    snapshot.forEach(child => {
                        const data = child.val();
                        const key = child.key;
                        const isArchived = (data.archived === true) || (data.status && data.status.toLowerCase() === 'archived');
                        if (isArchived) return;

                        productsData.push({ key, ...data });
                    });
                }

                // Update the displayed products
                displayProductsForCurrentPage();
                
                // Update filtered products as well
                const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
                const activeCategory = getActiveCategory();
                
                filteredProducts = productsData.filter(product => {
                    const matchesSearch = !searchTerm || 
                                     product.name.toLowerCase().includes(searchTerm) || 
                                     (product.category || '').toLowerCase().includes(searchTerm) ||
                                     product.price.toString().includes(searchTerm) ||
                                     (product.description || '').toLowerCase().includes(searchTerm);
                    
                    const matchesCategory = activeCategory === 'all' || (product.category || '') === activeCategory;
                    
                    return matchesSearch && matchesCategory;
                });
                
                updatePaginationControls();
            } catch (error) {
                handleError(error, 'realTimeProductUpdate');
            }
        });
    } catch (error) {
        handleError(error, 'setupRealTimeProductUpdates');
    }
}

/* ==========================
   Pagination Event Listeners
========================== */
function setupPaginationControls() {
    try {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const productsPerPageSelect = document.getElementById('productsPerPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    displayProductsForCurrentPage();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    displayProductsForCurrentPage();
                }
            });
        }

        // Products per page selector
        if (productsPerPageSelect) {
            productsPerPageSelect.addEventListener('change', (e) => {
                productsPerPage = parseInt(e.target.value);
                resetToFirstPage();
            });
        }
    } catch (error) {
        handleError(error, 'setupPaginationControls');
    }
}

/* ==========================
   Clear Cart Functionality
========================== */
function setupClearCart() {
    try {
        const clearCartBtn = document.getElementById('clearCartBtn');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', async () => {
                if (Object.keys(cart).length === 0) {
                    showNotification('Your cart is already empty.', 'info');
                    return;
                }

                const confirmed = await showPurchaseModal(
                    'Are you sure you want to clear all items from your cart?', 
                    0, 
                    null, 
                    'confirm'
                );
                if (confirmed) {
                    cart = {};
                    updateInvoiceItems();
                    showNotification('Cart cleared successfully', 'success');
                }
            });
        }
    } catch (error) {
        handleError(error, 'setupClearCart');
    }
}

/* ==========================
   Keyboard Shortcuts
========================== */
function setupKeyboardShortcuts() {
    try {
        document.addEventListener('keydown', (e) => {
            // Ctrl + / to focus search
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
            
            // Escape to clear search or close modals
            if (e.key === 'Escape') {
                const searchInput = document.getElementById('searchInput');
                if (searchInput && searchInput.value) {
                    clearSearch();
                }
            }
        });
    } catch (error) {
        handleError(error, 'setupKeyboardShortcuts');
    }
}

/* ==========================
   Responsive Helpers
========================== */
function setupResponsiveHandlers() {
    try {
        // Handle window resize for better mobile experience
        window.addEventListener('resize', () => {
            try {
                // Adjust products per page based on screen size
                if (window.innerWidth < 768) {
                    productsPerPage = 4;
                } else if (window.innerWidth < 1024) {
                    productsPerPage = 6;
                } else {
                    productsPerPage = 8;
                }
                
                // Update products per page selector if it exists
                const productsPerPageSelect = document.getElementById('productsPerPage');
                if (productsPerPageSelect) {
                    productsPerPageSelect.value = productsPerPage;
                }
                
                resetToFirstPage();
            } catch (error) {
                handleError(error, 'responsiveResize');
            }
        });

        // Initial responsive setup
        window.dispatchEvent(new Event('resize'));
    } catch (error) {
        handleError(error, 'setupResponsiveHandlers');
    }
}

/* ==========================
   Initialize Single Purchase Modal on Load
========================== */
function ensureModalStructure() {
    try {
        // Single Purchase Modal Structure
        if (!document.getElementById('purchaseModal')) {
            const purchaseModal = document.createElement('div');
            purchaseModal.id = 'purchaseModal';
            purchaseModal.className = 'modal-overlay fixed inset-0 hidden flex items-center justify-center z-50';
            purchaseModal.innerHTML = `
                <div class="modal-content modal-container">
                    <div class="modal-header" id="purchaseModalHeader">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xl font-bold flex items-center gap-2 text-white" id="purchaseModalTitle">
                                <i class="fas fa-shopping-cart"></i>
                                Purchase
                            </h3>
                            <button id="purchaseClose" class="text-white hover:text-gray-200 text-2xl leading-none transition-colors">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div id="purchaseModalIcon" class="modal-icon"></div>
                        <div id="purchaseMessage" class="text-gray-700 text-base leading-relaxed"></div>
                    </div>
                    <div class="modal-footer">
                        <button id="purchaseSecondaryBtn" class="px-5 py-2.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold shadow-sm transition-colors">
                            Cancel
                        </button>
                        <button id="purchasePrimaryBtn" class="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
                            Confirm
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(purchaseModal);
        }
    } catch (error) {
        handleError(error, 'ensureModalStructure');
    }
}

/* ==========================
   Init
========================== */
window.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Point of Sale System...');
    
    try {
        // Ensure modal structure exists
        ensureModalStructure();
        
        // Test Firebase connection first
        const testRef = dbRef(db, '.info/connected');
        onValue(testRef, (snap) => {
            if (snap.val() === true) {
                console.log('Firebase connected successfully');
            } else {
                showNotification('Disconnected from server. Some features may not work.', 'warning');
            }
        });

        await loadProductsForSale();
        setupProductAdd();
        setupCategoryFilter();
        setupPurchaseForm();
        setupRFIDValidation();
        setupPaginationControls();
        setupSearchBar();
        setupClearCart();
        setupKeyboardShortcuts();
        setupResponsiveHandlers();
        setupRealTimeProductUpdates();
        
        // Initialize cart count display
        updateInvoiceItems();
        
        console.log('Point of Sale System initialized successfully');
        showNotification('System ready! Start adding products to cart.', 'success');
    } catch (error) {
        console.error('Failed to initialize Point of Sale System:', error);
        const errorMessage = error instanceof POSError ? error.message : 'Failed to initialize system. Please refresh the page.';
        showNotification(errorMessage, 'error');
        
        // Show detailed error in console for debugging
        if (error.details) {
            console.error('Error details:', error.details);
        }
    }
});

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
    handleError(event.error, 'global');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, 'unhandled promise rejection');
});

// Add CSS for spinner and animations
const style = document.createElement('style');
style.textContent = `
    .spinner {
        width: 20px;
        height: 20px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Notification animations */
    .pos-notification {
        transform: translateX(100%);
    }
    .pos-notification:not(.translate-x-full) {
        transform: translateX(0);
    }

    /* Clean card styling */
    .glass {
        background: white;
        border: 1px solid #e5e7eb;
    }

    /* Smooth transitions for all interactive elements */
    .product-card, .invoice-item, button, input, select {
        transition: all 0.3s ease;
    }

    /* Custom scrollbar for order summary */
    #invoice_items::-webkit-scrollbar {
        width: 6px;
    }
    
    #invoice_items::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    #invoice_items::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    #invoice_items::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }

    /* Loading states */
    .loading {
        opacity: 0.6;
        pointer-events: none;
    }

    /* Pulse animation for low stock */
    @keyframes pulse-low-stock {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    .low-stock {
        animation: pulse-low-stock 2s infinite;
    }

    /* Modal backdrop styles */
    .modal-overlay {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
    }

    .modal-container {
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 500px;
        width: 90%;
        max-height: 85vh;
        overflow: hidden;
    }

    /* Enhanced Modal Header Visibility */
.modal-header {
    background: linear-gradient(135deg, #10b981, #3b82f6);
    padding: 24px;
    color: white !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

.modal-header h3 {
    color: white !important;
    font-weight: 800 !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    font-size: 1.5rem !important;
}

.modal-header i {
    color: white !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Enhanced Spinner Styles */
.spinner-large {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
}

.spinner-small-blue {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(59, 130, 246, 0.3);
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Enhanced Text Visibility in Modals */
.modal-body {
    color: #1f2937 !important;
    font-weight: 500 !important;
}

.modal-body p {
    color: #374151 !important;
    font-weight: 500 !important;
}

.modal-body strong {
    color: #111827 !important;
    font-weight: 700 !important;
}

/* Better button visibility */
.modal-footer button {
    font-weight: 600 !important;
}

/* Enhanced processing state */
.processing-overlay {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
}

/* Ensure modal text is always visible */
#purchaseModal * {
    color: inherit !important;
}

/* Specific header text enhancement */
#purchaseModalHeader,
#purchaseModalTitle,
#purchaseModalTitle i,
#purchaseModalTitle span {
    color: white !important;
    font-weight: 800 !important;
}
`;
document.head.appendChild(style);
