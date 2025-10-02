import { db } from "./firebase_conn.js";
import { ref as dbRef, get, set, push, onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js"; // Added onValue

let productsData = [];
let cart = {}; // { key: { key, name, price, qty, imageUrl, category } }

// Pagination state
let currentPage = 1;
let productsPerPage = 8;
let filteredProducts = [];

/* ==========================
   Helpers
========================== */
function formatCurrency(n) {
  return Number(n).toFixed(2);
}

/* ==========================
   Enhanced Pagination Functions
========================== */
function initPagination() {
  filteredProducts = [...productsData];
  updatePaginationControls();
  displayProductsForCurrentPage();
}

function updatePaginationControls() {
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const currentPageEl = document.getElementById('currentPage');
  const totalPagesEl = document.getElementById('totalPages');
  const pageNumbersEl = document.getElementById('pageNumbers');
  const productsPerPageSelect = document.getElementById('productsPerPage');

  // Update page numbers
  if (currentPageEl) currentPageEl.textContent = currentPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages || 1;
  
  // Update button states
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  
  // Update page numbers display
  if (pageNumbersEl) {
    pageNumbersEl.innerHTML = '';
    
    // Show max 5 page numbers around current page
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition ${
        i === currentPage 
          ? 'bg-blue-600 text-white shadow' 
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => goToPage(i));
      pageNumbersEl.appendChild(pageBtn);
    }
  }

  // Update products per page selector
  if (productsPerPageSelect) {
    productsPerPageSelect.value = productsPerPage;
  }
}

function displayProductsForCurrentPage() {
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const productsToShow = filteredProducts.slice(startIndex, endIndex);
  
  const productsList = document.getElementById('products_list');
  if (!productsList) return;
  
  productsList.innerHTML = '';
  
  if (productsToShow.length === 0) {
    productsList.innerHTML = `
      <div class="col-span-full text-center py-8">
        <i class="fas fa-search text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500 text-lg">No products found</p>
        <p class="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
      </div>
    `;
    return;
  }
  
  productsToShow.forEach(product => {
    const card = createProductCard(product);
    productsList.appendChild(card);
  });
  
  updatePaginationControls();
  setupProductAdd(); // Re-bind event listeners for new product cards
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 hover:scale-[1.02] p-5 flex flex-col gap-4 border border-gray-100";
  card.dataset.key = product.key;
  card.dataset.category = product.category || "all";

  // Stock status indicator
  const stockStatus = product.quantity > 0 
    ? `<span class="absolute top-3 left-3 bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-lg">In Stock</span>`
    : `<span class="absolute top-3 left-3 bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-lg">Out of Stock</span>`;

  const imgHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${product.name}" class="w-full h-44 object-cover rounded-xl shadow-sm">`
    : `<div class="w-full h-44 bg-gray-100 flex items-center justify-center rounded-xl text-gray-400 text-3xl">
         <i class="fas fa-utensils"></i>
       </div>`;

  card.innerHTML = `
    <div class="flex-1 relative">
      ${imgHtml}
      ${stockStatus}
      <span class="absolute top-3 right-3 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-lg shadow-md">
        ₱${formatCurrency(product.price)}
      </span>
    </div>
    <div class="flex flex-col gap-1">
      <h3 class="text-lg font-semibold text-gray-800 leading-tight">${product.name}</h3>
      <p class="text-sm text-gray-500">${product.category || "Uncategorized"}</p>
      <p class="text-xs text-gray-400">Stock: ${product.quantity || 0}</p>
    </div>
    <div class="flex items-center justify-between mt-3">
      <button
        class="add-btn w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        data-key="${product.key}"
        ${product.quantity <= 0 ? 'disabled' : ''}
      >
        <i class="fas fa-cart-plus"></i> 
        ${product.quantity <= 0 ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  `;
  
  return card;
}

function goToPage(page) {
  currentPage = page;
  displayProductsForCurrentPage();
  
  // Scroll to top of products section
  const productsSection = document.getElementById('products_list');
  if (productsSection) {
    productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function resetToFirstPage() {
  currentPage = 1;
  displayProductsForCurrentPage();
}

/* ==========================
   Enhanced Modal Helpers
========================== */
function showConfirmModal(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const yes = document.getElementById('confirmYes');
    const no = document.getElementById('confirmNo');
    const close = document.getElementById('confirmClose');

    function cleanup() {
      // Remove event listeners
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      close.removeEventListener('click', onNo);
      modal.removeEventListener('click', onBackdropClick);
      document.removeEventListener('keydown', onEscapeKey);
      
      modal.classList.add('hidden');
    }

    function onYes() { cleanup(); resolve(true); }
    function onNo() { cleanup(); resolve(false); }
    function onBackdropClick(e) { if (e.target === modal) onNo(); }
    function onEscapeKey(e) { if (e.key === 'Escape') onNo(); }

    // Enhanced message formatting with better spacing and icon
    msgEl.innerHTML = `
      <div class="space-y-4 text-center">
        <div class="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <div class="text-gray-800 leading-relaxed space-y-3">${message}</div>
      </div>
    `;

    // Set up modal
    modal.classList.remove('hidden');

    // Add enhanced event listeners
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    close.addEventListener('click', onNo);
    modal.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onEscapeKey);

    // Focus management for better UX
    setTimeout(() => no.focus(), 100);
  });
}

function showInfoModal(message, type = 'info') {
  return new Promise(resolve => {
    const modal = document.getElementById('infoModal');
    const msgEl = document.getElementById('infoMessage');
    const ok = document.getElementById('infoOk');

    function cleanup() {
      ok.removeEventListener('click', onOk);
      modal.removeEventListener('click', onBackdropClick);
      document.removeEventListener('keydown', onEscapeKey);
      
      modal.classList.add('hidden');
    }

    function onOk() { cleanup(); resolve(); }
    function onBackdropClick(e) { if (e.target === modal) onOk(); }
    function onEscapeKey(e) { if (e.key === 'Escape') onOk(); }

    // Enhanced styling based on type with icons
    const typeConfig = {
      success: {
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>`,
        textColor: 'text-green-600',
        buttonColor: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus:ring-green-400'
      },
      warning: {
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
        textColor: 'text-red-600',
        buttonColor: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 focus:ring-red-400'
      },
      info: {
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
        icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
        textColor: 'text-yellow-600',
        buttonColor: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:ring-blue-400'
      }
    };

    const config = typeConfig[type] || typeConfig.info;

    // Enhanced message with icon and better spacing
    msgEl.innerHTML = `
      <div class="text-center space-y-4">
        <div class="mx-auto w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mb-6">
          <svg class="w-8 h-8 ${config.iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${config.icon}
          </svg>
        </div>
        <div class="space-y-4">${message}</div>
      </div>
    `;

    // Set up modal
    modal.classList.remove('hidden');

    // Add enhanced event listeners
    ok.addEventListener('click', onOk);
    modal.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onEscapeKey);

    // Focus management for better UX
    setTimeout(() => ok.focus(), 100);
  });
}

/* ==========================
   Search Functionality
========================== */
function setupSearchBar() {
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
}

function performSearch() {
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
}

function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    filteredProducts = [...productsData];
    resetToFirstPage();
  }
}

function getActiveCategory() {
  const activeBtn = document.querySelector('.category-btn.bg-blue-600');
  return activeBtn ? activeBtn.dataset.category : 'all';
}

/* ==========================
   Load Products
========================== */
async function loadProductsForSale() {
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
}

/* ==========================
   Cart / Invoice rendering
========================== */
function updateInvoiceItems() {
  const container = document.getElementById('invoice_items');
  const purchaseBtn = document.getElementById('purchaseBtn');
  const rfidInput = document.getElementById('card_number_buy');
  
  container.innerHTML = '';
  let total = 0;

  if (Object.keys(cart).length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center py-4">Menu is empty.</p>`;
    document.getElementById('total_price').textContent = formatCurrency(0);
    
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

    const row = document.createElement('div');
    row.className = "grid grid-cols-[40px_1fr_60px_60px_40px] gap-2 items-center p-2 bg-gray-50 rounded mb-2";

    row.innerHTML = `
      ${item.imageUrl ? `<img src="${item.imageUrl}" class="w-10 h-10 object-cover rounded">` : '<div class="w-10 h-10 bg-gray-200 rounded"></div>'}
      <div class="font-medium text-sm truncate">${item.name}</div>
      <input class="order-qty w-full text-center border rounded px-1 py-0.5" data-key="${item.key}" value="${item.qty}" type="number" min="0">
      <div class="font-semibold text-right">₱${formatCurrency(itemTotal)}</div>
      <button class="order-remove text-red-500 ml-2" data-key="${item.key}" title="Remove">🗑️</button>
    `;

    container.appendChild(row);
  });

  document.getElementById('total_price').textContent = formatCurrency(total);
  
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

  // Send cart to WebSocket
if (typeof sendLiveOrder === "function") {
  sendLiveOrder(cart);
}


}

/* ==========================
   Cart Controls
========================== */
function bindInvoiceControls() {
  document.querySelectorAll('.order-qty').forEach(input => {
    input.oninput = () => {
      const key = input.dataset.key;
      let val = parseInt(input.value) || 0;
      if (val <= 0) delete cart[key];
      else cart[key].qty = val;
      updateInvoiceItems();
    };
  });

  document.querySelectorAll('.order-remove').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      delete cart[key];
      updateInvoiceItems();
    };
  });
}

/* ==========================
   Product Add button
========================== */
function setupProductAdd() {
  const productsList = document.getElementById('products_list');
  if (!productsList) return;
  
  // Remove existing event listeners and add new ones
  productsList.removeEventListener('click', handleProductAdd);
  productsList.addEventListener('click', handleProductAdd);
}

function handleProductAdd(e) {
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
}

/* ==========================
   Category Filter
========================== */
function setupCategoryFilter() {
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      
      // Update button styles
      document.querySelectorAll('.category-btn').forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'shadow', 'ring-2', 'ring-blue-400');
        b.classList.add('bg-gray-200', 'text-gray-800');
      });
      btn.classList.remove('bg-gray-200', 'text-gray-800');
      btn.classList.add('bg-blue-600', 'text-white', 'shadow', 'ring-2', 'ring-blue-400');

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
}

function applyDefaultCategory() {
  const allBtn = document.querySelector('.category-btn[data-category="all"]');
  if (allBtn) {
    document.querySelectorAll('.category-btn').forEach(b => { 
      b.classList.remove('bg-blue-600', 'text-white', 'shadow', 'ring-2', 'ring-blue-400'); 
      b.classList.add('bg-gray-200', 'text-gray-800'); 
    });
    allBtn.classList.remove('bg-gray-200', 'text-gray-800');
    allBtn.classList.add('bg-blue-600', 'text-white', 'shadow', 'ring-2', 'ring-blue-400');
  }
}

/* ==========================
   Purchase handling
========================== */
let isPurchaseProcessing = false;
let isRFIDValid = false;

function setupPurchaseForm() {
    const purchaseBtn = document.getElementById('purchaseBtn');
    const rfidInput = document.getElementById('card_number_buy');

    if (!purchaseBtn || !rfidInput) return;

    purchaseBtn.addEventListener('click', async () => {
             console.log("Clicked")

        if (isPurchaseProcessing || !isRFIDValid) return;

        const selectedProducts = Object.values(cart).map(i => ({
            product_name: i.name,
            quantity: i.qty,
            price: Number(i.price),
            subtotal: Number(i.price) * i.qty,
            imageUrl: i.imageUrl || null,
            product_key: i.key // Add product key for updating inventory
        }));
        const cardNumber = rfidInput.value.trim();
        const totalPrice = parseFloat(document.getElementById('total_price').textContent) || 0;

        if (selectedProducts.length === 0) {
            await showInfoModal('No items in cart. Add products before purchasing.', 'warning');
            return;
        }

        if (!cardNumber) {
            await showInfoModal('Please enter a valid RFID card number.', 'warning');
            focusRFIDInput();
            return;
        }

        isPurchaseProcessing = true;
        purchaseBtn.disabled = true;
        rfidInput.disabled = true;
        purchaseBtn.textContent = 'Processing...';

        try {
            // Fetch user by card
            const usersSnap = await get(dbRef(db, 'student_users'));
            let userKey = null, userData = null;
            usersSnap.forEach(child => {
                const d = child.val();
                if (String(d.id_number) === cardNumber || String(d.lrn_number) === cardNumber) {
                    userKey = child.key;
                    userData = d;
                }
            });

            if (!userKey || userData.disabled) {
                isRFIDValid = false;
                rfidInput.classList.add('border-red-500');
                await showInfoModal(!userKey ? 'Card not found.' : 'This account is disabled.', 'warning');
                focusRFIDInput();
                return;
            }

            if ((userData.balance || 0) < totalPrice) {
                await showInfoModal(`Insufficient balance. Current balance: ₱${formatCurrency(userData.balance || 0)}.`, 'warning');
                focusRFIDInput();
                return;
            }

            // Check product availability and prepare quantity updates
            const quantityUpdates = {};
            const unavailableProducts = [];

            for (const item of selectedProducts) {
                const productRef = dbRef(db, `products/${item.product_key}`);
                const productSnap = await get(productRef);
                
                if (!productSnap.exists()) {
                    unavailableProducts.push(`${item.product_name} (Product not found)`);
                    continue;
                }

                const productData = productSnap.val();
                const currentQuantity = productData.quantity || 0;
                
                if (currentQuantity < item.quantity) {
                    unavailableProducts.push(`${item.product_name} (Available: ${currentQuantity}, Requested: ${item.quantity})`);
                } else {
                    // Prepare quantity update
                    quantityUpdates[item.product_key] = currentQuantity - item.quantity;
                }
            }

            // If any products are unavailable, show error
            if (unavailableProducts.length > 0) {
                await showInfoModal(
                    `Insufficient stock for:<br><br>${unavailableProducts.map(p => `• ${p}`).join('<br>')}`,
                    'warning'
                );
                isPurchaseProcessing = false;
                purchaseBtn.disabled = false;
                rfidInput.disabled = false;
                purchaseBtn.textContent = 'Complete Purchase';
                focusRFIDInput();
                return;
            }

            // Confirm purchase
            const confirmSummary = `
                <div class="text-left space-y-3 font-mono text-sm border-b border-gray-300 pb-2">
                    <p class="font-bold text-gray-800 text-lg mb-1">You are about to buy:</p>
                    <ul class="space-y-2">
                        ${selectedProducts.map(p => `
                            <li class="flex items-center gap-2">
                                ${p.imageUrl ? `<img src="${p.imageUrl}" class="w-12 h-12 object-cover rounded">` : ''}
                                <span>${p.quantity} × ${p.product_name} — ₱${formatCurrency(p.subtotal)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <p class="mt-3 font-semibold text-gray-900 text-lg">Total: ₱${formatCurrency(totalPrice)}</p>
            `;
            const confirmed = await showConfirmModal(confirmSummary);
            if (!confirmed) {
                isPurchaseProcessing = false;
                purchaseBtn.disabled = false;
                rfidInput.disabled = false;
                purchaseBtn.textContent = 'Complete Purchase';
                focusRFIDInput();
                return;
            }

            // Process the purchase - update quantities and create purchase record
            const updatePromises = [];

            // Update product quantities in Firebase
            for (const [productKey, newQuantity] of Object.entries(quantityUpdates)) {
                const productRef = dbRef(db, `products/${productKey}/quantity`);
                updatePromises.push(set(productRef, newQuantity));
            }

            // Deduct balance from user
            const newBalance = (userData.balance || 0) - totalPrice;
            updatePromises.push(set(dbRef(db, `student_users/${userKey}/balance`), newBalance));

            // Create purchase record
            const purchaseRef = push(dbRef(db, 'purchases'));
            updatePromises.push(set(purchaseRef, {
                id_number: userData.id_number,
                lrn_number: userData.lrn_number || "",
                student_name: `${userData.student_fname || ""} ${userData.student_mname || ""} ${userData.student_lname || ""}`.replace(/\s+/g, " ").trim(),
                products: selectedProducts,
                totalPrice,
                timestamp: Date.now(),
                purchase_id: purchaseRef.key
            }));

            // Execute all updates
            await Promise.all(updatePromises);

            // Update local products data
            await updateLocalProductsData();

            // Show success modal
            const orderSummary = `
                <div class="text-left space-y-3 font-mono text-sm border-b border-gray-300 pb-2">
                    <p class="font-bold text-green-600 text-lg mb-1">Purchase successful!</p>
                    <ul class="space-y-2">
                        ${selectedProducts.map(p => `
                            <li class="flex items-center gap-2">
                                ${p.imageUrl ? `<img src="${p.imageUrl}" class="w-12 h-12 object-cover rounded">` : ''}
                                <span>${p.quantity} × ${p.product_name} — ₱${formatCurrency(p.subtotal)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <p class="mt-3 font-semibold text-gray-900 text-lg">Total: ₱${formatCurrency(totalPrice)}</p>
                <p class="text-blue-600 font-bold text-lg">New Balance: ₱${formatCurrency(newBalance)}</p>
            `;
            await showInfoModal(orderSummary, 'success');

            // Reset cart & form
            cart = {};
            updateInvoiceItems(); // will show empty cart
            clearLiveOrder(); // tell display to reset
            rfidInput.value = '';
            isRFIDValid = false;

        } catch (error) {
            console.error('Purchase error:', error);
            await showInfoModal('Error processing purchase. Please try again.', 'warning');
            focusRFIDInput();
        } finally {
            isPurchaseProcessing = false;
            rfidInput.disabled = false;
            purchaseBtn.disabled = Object.keys(cart).length === 0;
            purchaseBtn.textContent = 'Complete Purchase';
        }
    });
}

/* ==========================
   Update Local Products Data
========================== */
async function updateLocalProductsData() {
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
}

/* ==========================
   RFID Input Validation & Auto-focus
========================== */
function setupRFIDValidation() {
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
}

/* ==========================
   Real-time Product Updates
========================== */
function setupRealTimeProductUpdates() {
    // Listen for real-time updates to products
    const productsRef = dbRef(db, 'products');
    
    // This will update the local productsData whenever Firebase changes
    onValue(productsRef, (snapshot) => {
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
    });
}

/* ==========================
   Pagination Event Listeners
========================== */
function setupPaginationControls() {
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
}

/* ==========================
   Init
========================== */
window.addEventListener('DOMContentLoaded', async () => {
    await loadProductsForSale();
    setupProductAdd();
    setupCategoryFilter();
    setupPurchaseForm();
    setupRFIDValidation();
    setupPaginationControls();
    setupSearchBar();
    setupRealTimeProductUpdates(); 
});

function clearLiveOrder() {
  if (ws.readyState === WebSocket.OPEN) {
    console.log("Clearing order (checkout complete)");
    ws.send(JSON.stringify({ type: "clear" }));
  }
}
