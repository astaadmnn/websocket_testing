import { db } from "../script/firebase_conn.js";
import { ref as dbRef, push, set, get, update, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject, ref as refFromURL } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const storage = getStorage();

// ================== LOGOUT FUNCTIONALITY ==================
function initializeLogoutModal() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmationModal');
    const closeLogoutModalBtn = document.getElementById('closeLogoutModalBtn');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (!logoutBtn || !logoutModal) {
        console.log('Logout elements not found in products management');
        return;
    }

    console.log('Initializing logout modal for products management...');

    // Remove any existing event listeners by cloning and replacing the button
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

    // Get fresh reference to the logout button
    const refreshedLogoutBtn = document.getElementById('logoutBtn');

    // Add click event listener to show modal
    refreshedLogoutBtn.addEventListener('click', function(e) {
        console.log('Products management logout button clicked - preventing default');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.log('Showing logout modal for products management');
        logoutModal.classList.remove('hidden');
        logoutModal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
    });

    // Close modal when close button is clicked
    closeLogoutModalBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Close products management logout modal');
        logoutModal.classList.add('hidden');
        logoutModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
    });

    // Close modal when cancel button is clicked
    cancelLogoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Cancel products management logout');
        logoutModal.classList.add('hidden');
        logoutModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
    });

    // Perform logout when confirm button is clicked
    confirmLogoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Confirming products management logout');
        
        // Show processing state
        const originalText = confirmLogoutBtn.innerHTML;
        confirmLogoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        confirmLogoutBtn.disabled = true;

        // Clear local storage
        localStorage.removeItem('cashierUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        sessionStorage.clear();

        console.log('Products management local storage cleared, redirecting...');
        
        // Redirect to login page after a brief delay to show the loading state
        setTimeout(() => {
            window.location.href = '/SMARTBITE-ADMIN/login.html';
        }, 500);
    });

    // Close modal when clicking outside
    logoutModal.addEventListener('click', function(e) {
        if (e.target === logoutModal) {
            console.log('Clicked outside products management modal - closing');
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

    console.log('Products management logout modal initialized successfully');
}

// ================== PAGINATION CONFIG ==================
const PAGINATION_CONFIG = {
    productsPerPage: 10,
    active: {
        currentPage: 1,
        totalPages: 1,
        totalProducts: 0
    },
    archived: {
        currentPage: 1,
        totalPages: 1,
        totalProducts: 0
    }
};

// ================== UTILITY: CREATE LOG ==================
const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));

async function createLog(message, action = "Unknown") {
    const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
    if (!cashierUser) {
        console.error("No cashier user found.");
        return;
    }

    const logRef = push(dbRef(db, 'logs'));
    await set(logRef, {
        action,
        cashier_name: `${cashierUser.first_name} ${cashierUser.last_name}`,
        message,
        timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
    });
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
export { toBase64 };

// ================== UTILITY FUNCTIONS ==================
function stripHtmlTags(str) {
    return str.replace(/<[^>]*>/g, '');
}

// ================== PAGINATION FUNCTIONS ==================
function updatePaginationInfo(totalProducts, isArchived = false) {
    const config = isArchived ? PAGINATION_CONFIG.archived : PAGINATION_CONFIG.active;
    const prefix = isArchived ? 'archived_' : '';
    
    config.totalProducts = totalProducts;
    config.totalPages = Math.ceil(totalProducts / PAGINATION_CONFIG.productsPerPage);
    
    const paginationInfo = document.getElementById(`${prefix}paginationInfo`);
    if (paginationInfo) {
        const startItem = ((config.currentPage - 1) * PAGINATION_CONFIG.productsPerPage) + 1;
        const endItem = Math.min(config.currentPage * PAGINATION_CONFIG.productsPerPage, totalProducts);
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalProducts} products`;
    }
}

function renderPaginationControls(isArchived = false) {
    const config = isArchived ? PAGINATION_CONFIG.archived : PAGINATION_CONFIG.active;
    const prefix = isArchived ? 'archived_' : '';
    const paginationContainer = document.getElementById(`${prefix}paginationControls`);
    
    if (!paginationContainer) {
        console.warn(`Pagination container ${prefix}paginationControls not found`);
        return;
    }

    const { currentPage, totalPages } = config;
    
    let paginationHTML = '';
    
    paginationHTML += `
        <button class="px-3 py-1 rounded border ${currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}" 
                ${currentPage === 1 ? 'disabled' : ''} 
                onclick="changePage(${currentPage - 1}, ${isArchived})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        paginationHTML += `
            <button class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50" onclick="changePage(1, ${isArchived})">1</button>
            ${startPage > 2 ? '<span class="px-2 py-1">...</span>' : ''}
        `;
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="px-3 py-1 rounded border ${currentPage === i ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}" 
                    onclick="changePage(${i}, ${isArchived})">
                ${i}
            </button>
        `;
    }

    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<span class="px-2 py-1">...</span>' : ''}
            <button class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50" onclick="changePage(${totalPages}, ${isArchived})">${totalPages}</button>
        `;
    }

    paginationHTML += `
        <button class="px-3 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}" 
                ${currentPage === totalPages ? 'disabled' : ''} 
                onclick="changePage(${currentPage + 1}, ${isArchived})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    paginationContainer.innerHTML = paginationHTML;
}

window.changePage = function(page, isArchived = false) {
    const config = isArchived ? PAGINATION_CONFIG.archived : PAGINATION_CONFIG.active;
    
    if (page < 1 || page > config.totalPages) return;
    
    config.currentPage = page;
    
    if (isArchived) {
        loadArchivedProducts();
    } else {
        loadProducts();
    }
};

// ================== MODAL MANAGEMENT ==================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            const modalContent = modal.querySelector('.modal-scale');
            if (modalContent) {
                modalContent.classList.add('show');
            }
        }, 10);
    } else {
        console.warn(`Modal with id ${modalId} not found`);
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const modalContent = modal.querySelector('.modal-scale');
        if (modalContent) {
            modalContent.classList.remove('show');
        }
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = '';
        }, 200);
    }
}

// Processing modal functions
function showProcessingModal(action) {
    const modalId = `processing${action.charAt(0).toUpperCase() + action.slice(1)}Modal`;
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function hideProcessingModal(action) {
    const modalId = `processing${action.charAt(0).toUpperCase() + action.slice(1)}Modal`;
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        const modal = e.target.closest('.modal');
        if (modal) {
            hideModal(modal.id);
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal:not(.hidden)');
        openModals.forEach(modal => {
            hideModal(modal.id);
        });
    }
});

// ================== IMAGE PREVIEW FUNCTIONALITY ==================
function initializeImagePreview() {
    console.log('Initializing image preview functionality...');

    // Add Product Form Image Preview
    const addImageInput = document.getElementById('product_image');
    const addPreviewContainer = document.getElementById('addImagePreviewContainer');
    const addImagePreview = document.getElementById('addImagePreview');
    const addUploadPlaceholder = document.getElementById('addUploadPlaceholder');
    const addRemoveBtn = document.getElementById('addRemovePreview');

    if (addPreviewContainer && addImageInput) {
        console.log('Initializing add product image preview');
        
        addPreviewContainer.addEventListener('click', (e) => {
            if (!e.target.closest('.remove-preview-btn')) {
                addImageInput.click();
            }
        });

        addImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!validTypes.includes(file.type)) {
                    addImageInput.value = '';
                    showFileErrorModal('Invalid file type! Only JPG and PNG images are allowed.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    console.log('Add product image loaded');
                    if (addImagePreview) {
                        addImagePreview.src = event.target.result;
                        addImagePreview.classList.remove('hidden');
                    }
                    if (addUploadPlaceholder) {
                        addUploadPlaceholder.classList.add('hidden');
                    }
                    if (addRemoveBtn) {
                        addRemoveBtn.classList.remove('hidden');
                    }
                    if (addPreviewContainer) {
                        addPreviewContainer.classList.add('has-image');
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        if (addRemoveBtn) {
            addRemoveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Removing add product image preview');
                addImageInput.value = '';
                if (addImagePreview) {
                    addImagePreview.src = '';
                    addImagePreview.classList.add('hidden');
                }
                if (addUploadPlaceholder) {
                    addUploadPlaceholder.classList.remove('hidden');
                }
                addRemoveBtn.classList.add('hidden');
                if (addPreviewContainer) {
                    addPreviewContainer.classList.remove('has-image');
                }
            });
        }
    }

    // Edit Product Form Image Preview
    const editImageInput = document.getElementById('edit_product_image');
    const editPreviewContainer = document.getElementById('editImagePreviewContainer');
    const editImagePreview = document.getElementById('edit_product_image_preview');
    const editRemoveBtn = document.getElementById('editRemovePreview');
    const editChangeBtn = document.getElementById('editChangeImageBtn');

    console.log('Edit preview elements:', {
        editImageInput: !!editImageInput,
        editPreviewContainer: !!editPreviewContainer,
        editImagePreview: !!editImagePreview,
        editRemoveBtn: !!editRemoveBtn,
        editChangeBtn: !!editChangeBtn
    });

    // Initialize edit modal preview state
    function initializeEditPreview() {
        console.log('Initializing edit preview state');
        if (editPreviewContainer && editImagePreview) {
            const hasImage = editImagePreview.src && editImagePreview.src !== '' && !editImagePreview.src.includes('undefined');
            console.log('Edit preview has image:', hasImage, editImagePreview.src);
            
            if (hasImage) {
                editPreviewContainer.classList.add('has-image');
                if (editRemoveBtn) {
                    editRemoveBtn.classList.remove('hidden');
                    console.log('Edit remove button shown');
                }
            } else {
                editPreviewContainer.classList.remove('has-image');
                if (editRemoveBtn) {
                    editRemoveBtn.classList.add('hidden');
                    console.log('Edit remove button hidden');
                }
            }
        }
    }

    // Change image button
    if (editChangeBtn && editImageInput) {
        editChangeBtn.addEventListener('click', () => {
            console.log('Change image button clicked');
            editImageInput.click();
        });
    }

    // Handle image selection
    if (editImageInput && editImagePreview) {
        editImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            console.log('Edit image changed:', file);
            if (file) {
                const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
                if (!validTypes.includes(file.type)) {
                    editImageInput.value = '';
                    showFileErrorModal('Invalid file type! Only JPG and PNG images are allowed.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    console.log('Edit product image loaded');
                    editImagePreview.src = event.target.result;
                    editPreviewContainer.classList.add('has-image');
                    if (editRemoveBtn) {
                        editRemoveBtn.classList.remove('hidden');
                        console.log('Edit remove button shown after image change');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Remove image button
    if (editRemoveBtn && editImageInput && editImagePreview) {
        editRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Removing edit product image preview');
            editImageInput.value = '';
            editImagePreview.src = '';
            editPreviewContainer.classList.remove('has-image');
            editRemoveBtn.classList.add('hidden');
        });
    }

    // Initialize when modal opens using event delegation
    document.addEventListener('click', (e) => {
        if (e.target.closest('.edit-btn')) {
            // Wait for modal to open then initialize preview
            setTimeout(initializeEditPreview, 100);
        }
    });

    // Also re-initialize when modal is shown via other means
    const editModal = document.getElementById('editProductModal');
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal || e.target.closest('#closeEditModal') || e.target.closest('#cancelEditModal')) {
                // Reset file input when modal closes
                if (editImageInput) {
                    editImageInput.value = '';
                }
            }
        });
    }

    console.log('Image preview initialization complete');
}

// ================== ADD PRODUCT ==================
document.getElementById('addProductForm').addEventListener('submit', async e => {
    e.preventDefault();

    const name = document.getElementById('product_name').value.trim();
    const price = parseFloat(document.getElementById('product_price').value);
    const category = document.getElementById('product_category').value || 'Uncategorized';
    const quantity = parseInt(document.getElementById('product_quantity').value) || 0;
    const fileInput = document.getElementById('product_image');

    if (!name) {
        alert('Product name is required');
        return;
    }
    if (!price || price <= 0) {
        alert('Valid price is required');
        return;
    }

    // Show processing modal
    showProcessingModal('add');

    let imageUrl = '';
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        try {
            imageUrl = await toBase64(file);
            console.log("Base64 image created:", imageUrl.substring(0,50));
        } catch (err) {
            console.error("Failed to convert image:", err);
            hideProcessingModal('add');
            alert("Failed to read image file.");
            return;
        }
    }

    try {
        const newProductRef = push(dbRef(db, 'products'));
        await set(newProductRef, {
            name,
            price,
            category,
            quantity,
            imageUrl,
            archived: false
        });

        const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));

        await createLog(`${cashierUser.first_name} ${cashierUser.last_name} created product: ${name}, Price: ₱${price}, Qty: ${quantity}`, "Add Product");

        e.target.reset();
        
        // Reset image preview
        const addImagePreview = document.getElementById('addImagePreview');
        const addUploadPlaceholder = document.getElementById('addUploadPlaceholder');
        const addRemoveBtn = document.getElementById('addRemovePreview');
        const addPreviewContainer = document.getElementById('addImagePreviewContainer');
        
        if (addImagePreview) {
            addImagePreview.src = '';
            addImagePreview.classList.add('hidden');
        }
        if (addUploadPlaceholder) {
            addUploadPlaceholder.classList.remove('hidden');
        }
        if (addRemoveBtn) {
            addRemoveBtn.classList.add('hidden');
        }
        if (addPreviewContainer) {
            addPreviewContainer.classList.remove('has-image');
        }

        await loadProducts();
        await loadArchivedProducts();
        
        // Hide processing modal and show success
        hideProcessingModal('add');
        showSuccessModal("Product has been successfully added.");
    } catch (err) {
        console.error("Failed to add product:", err);
        hideProcessingModal('add');
        alert("Failed to add product. Please check your connection or try again.");
    }
});

// ================== LOAD PRODUCTS ==================
async function loadProducts() {
    const snapshot = await get(dbRef(db, 'products'));
    const table = document.getElementById('products_table');
    if (!table) {
        console.warn('Products table not found');
        return;
    }
    
    table.innerHTML = '';
    
    if (snapshot.exists()) {
        const products = [];
        snapshot.forEach(child => {
            const data = child.val();
            const key = child.key;
            if (!data.archived) {
                products.push({ key, ...data });
            }
        });

        updatePaginationInfo(products.length, false);
        
        const startIndex = (PAGINATION_CONFIG.active.currentPage - 1) * PAGINATION_CONFIG.productsPerPage;
        const endIndex = startIndex + PAGINATION_CONFIG.productsPerPage;
        const paginatedProducts = products.slice(startIndex, endIndex);

        if (paginatedProducts.length > 0) {
            paginatedProducts.forEach(product => {
                table.innerHTML += `
                <tr class="border-b hover:bg-gray-100">
                    <td class="p-2">${product.imageUrl ? `<img src="${product.imageUrl}" class="w-16 h-16 object-cover rounded"/>` : 'No image'}</td>
                    <td class="p-2">${product.name}</td>
                    <td class="p-2">${product.category}</td>
                    <td class="p-2">${product.quantity}</td>
                    <td class="p-2">₱${product.price}</td>
                    <td class="p-2 text-center flex gap-2 justify-center">
                        <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded edit-btn" 
                            data-key="${product.key}" 
                            data-name="${product.name}" 
                            data-price="${product.price}" 
                            data-category="${product.category}" 
                            data-quantity="${product.quantity}" 
                            data-image="${product.imageUrl || ''}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded archive-btn" 
                            data-key="${product.key}" 
                            data-name="${product.name}">
                            <i class="fas fa-archive"></i> Archive
                        </button>
                    </td>
                </tr>`;
            });
        } else {
            table.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No products found</td></tr>';
        }

        renderPaginationControls(false);
    } else {
        table.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No products found</td></tr>';
        updatePaginationInfo(0, false);
        renderPaginationControls(false);
    }
}

// ================== LOAD ARCHIVED PRODUCTS ==================
async function loadArchivedProducts() {
    const snapshot = await get(dbRef(db, 'products'));
    const table = document.getElementById('archived_table');
    if (!table) {
        console.warn('Archived table not found');
        return;
    }
    
    table.innerHTML = '';
    
    if (snapshot.exists()) {
        const archivedProducts = [];
        snapshot.forEach(child => {
            const data = child.val();
            const key = child.key;
            if (data.archived) {
                archivedProducts.push({ key, ...data });
            }
        });

        updatePaginationInfo(archivedProducts.length, true);
        
        const startIndex = (PAGINATION_CONFIG.archived.currentPage - 1) * PAGINATION_CONFIG.productsPerPage;
        const endIndex = startIndex + PAGINATION_CONFIG.productsPerPage;
        const paginatedProducts = archivedProducts.slice(startIndex, endIndex);

        if (paginatedProducts.length > 0) {
            paginatedProducts.forEach(product => {
                table.innerHTML += `
                <tr class="border-b hover:bg-gray-100">
                    <td class="p-2">${product.imageUrl ? `<img src="${product.imageUrl}" class="w-16 h-16 object-cover rounded"/>` : 'No image'}</td>
                    <td class="p-2">${product.name}</td>
                    <td class="p-2">${product.category}</td>
                    <td class="p-2">${product.quantity}</td>
                    <td class="p-2">₱${product.price}</td>
                    <td class="p-2 text-center flex gap-2 justify-center">
                        <button class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded restore-btn" data-key="${product.key}" data-name="${product.name}">
                            <i class="fas fa-undo"></i> Restore
                        </button>
                        <button class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded delete-btn"
                            data-key="${product.key}" 
                            data-name="${product.name}" 
                            data-image="${product.imageUrl || ''}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>`;
            });
        } else {
            table.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No archived products found</td></tr>';
        }

        renderPaginationControls(true);
    } else {
        table.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-500">No archived products found</td></tr>';
        updatePaginationInfo(0, true);
        renderPaginationControls(true);
    }
}

// ================== PRODUCT TABLE BUTTONS ==================
document.getElementById('products_table').addEventListener('click', async e => {
    if (e.target.closest('.archive-btn')) {
        const btn = e.target.closest('.archive-btn');
        showArchiveModal(btn.dataset.key, btn.dataset.name);
    }
    if (e.target.closest('.edit-btn')) {
        const btn = e.target.closest('.edit-btn');
        showEditModal(btn);
    }
});

document.getElementById('archived_table').addEventListener('click', async e => {
    if (e.target.closest('.restore-btn')) {
        const btn = e.target.closest('.restore-btn');
        showRestoreModal(btn.dataset.key, btn.dataset.name);
    }
    if (e.target.closest('.delete-btn')) {
        const btn = e.target.closest('.delete-btn');
        showDeleteModal(btn.dataset.key, btn.dataset.name, btn.dataset.image);
    }
});

// ================== EDIT MODAL LOGIC ==================
function showEditModal(btn) {
    const key = btn.dataset.key;
    document.getElementById('edit_product_name').value = btn.dataset.name;
    document.getElementById('edit_product_price').value = btn.dataset.price;
    document.getElementById('edit_product_category').value = btn.dataset.category;
    document.getElementById('edit_product_quantity').value = btn.dataset.quantity;
    document.getElementById('editProductForm').dataset.key = key;

    const previewImg = document.getElementById('edit_product_image_preview');
    const previewContainer = document.getElementById('editImagePreviewContainer');
    const removeBtn = document.getElementById('editRemovePreview');
    const fileInput = document.getElementById('edit_product_image');
    
    // Reset file input
    if (fileInput) fileInput.value = '';
    
    if (btn.dataset.image && btn.dataset.image !== '' && !btn.dataset.image.includes('undefined')) {
        console.log('Setting edit modal image:', btn.dataset.image);
        previewImg.src = btn.dataset.image;
        previewImg.classList.remove('hidden');
        if (previewContainer) {
            previewContainer.classList.add('has-image');
        }
        if (removeBtn) {
            removeBtn.classList.remove('hidden');
        }
    } else {
        console.log('No image found for edit modal');
        previewImg.src = '';
        previewImg.classList.add('hidden');
        if (previewContainer) {
            previewContainer.classList.remove('has-image');
        }
        if (removeBtn) {
            removeBtn.classList.add('hidden');
        }
    }

    showModal('editProductModal');
}

const closeEditModal = document.getElementById('closeEditModal');
const cancelEditModal = document.getElementById('cancelEditModal');

if (closeEditModal) closeEditModal.addEventListener('click', () => hideModal('editProductModal'));
if (cancelEditModal) cancelEditModal.addEventListener('click', () => hideModal('editProductModal'));

// ================== EDIT PRODUCT SAVE WITH IMAGE ==================
const editProductForm = document.getElementById('editProductForm');
if (editProductForm) {
    editProductForm.addEventListener('submit', async e => {
        e.preventDefault();
        const key = e.target.dataset.key;
        const name = document.getElementById('edit_product_name').value.trim();
        const price = parseFloat(document.getElementById('edit_product_price').value);
        const category = document.getElementById('edit_product_category').value || 'Uncategorized';
        const quantity = parseInt(document.getElementById('edit_product_quantity').value) || 0;

        if (!name) {
            alert('Product name is required');
            return;
        }
        if (!price || price <= 0) {
            alert('Valid price is required');
            return;
        }

        // Show processing modal
        showProcessingModal('edit');

        const imageInput = document.getElementById('edit_product_image');
        const currentImagePreview = document.getElementById('edit_product_image_preview');
        let imageBase64 = null;

        // Check if a new image was uploaded
        if (imageInput && imageInput.files && imageInput.files[0]) {
            try {
                imageBase64 = await toBase64(imageInput.files[0]);
                console.log('New image processed for edit');
            } catch (err) {
                console.error("Failed to process image:", err);
                hideProcessingModal('edit');
                alert("Failed to process image. Please try again.");
                return;
            }
        } else if (currentImagePreview && currentImagePreview.src && currentImagePreview.src !== '') {
            // Keep the existing image (either the original or one that was previously set)
            imageBase64 = currentImagePreview.src;
            console.log('Keeping existing image for edit');
        }

        const updateData = { name, price, category, quantity };
        if (imageBase64) {
            updateData.imageUrl = imageBase64;
        }

        try {
            const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));

            await update(dbRef(db, `products/${key}`), updateData);
            await createLog(`${cashierUser.first_name} ${cashierUser.last_name} updated product: ${name}, Price: ₱${price}, Qty: ${quantity}`, "Update Product");

            hideModal('editProductModal');
            await loadProducts();
            await loadArchivedProducts();
            
            // Hide processing modal and show success
            hideProcessingModal('edit');
            showSuccessModal("Product has been successfully updated.");
        } catch (err) {
            console.error("Failed to update product:", err);
            hideProcessingModal('edit');
            alert("Failed to update product. Please try again.");
        }
    });
}

// ================== ARCHIVE MODAL ==================
function showArchiveModal(id, name) {
    const archiveProductName = document.getElementById("archiveProductName");
    if (archiveProductName) archiveProductName.textContent = name;
    document.getElementById('archiveProductModal').dataset.productId = id;
    showModal('archiveProductModal');
}

const confirmArchiveProduct = document.getElementById("confirmArchiveProduct");
if (confirmArchiveProduct) {
    confirmArchiveProduct.addEventListener("click", async () => {
        const modal = document.getElementById('archiveProductModal');
        const id = modal.dataset.productId;
        const name = document.getElementById("archiveProductName").textContent;
        
        if (!id) return;
        
        // Show processing modal
        showProcessingModal('archive');
        const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));

        try {
            await update(dbRef(db, `products/${id}`), { archived: true });
            await createLog(`${cashierUser.first_name} ${cashierUser.last_name} archived product: ${name}`, "Archive Product");
            await loadProducts();
            await loadArchivedProducts();
            hideModal('archiveProductModal');
            
            // Hide processing modal and show success
            hideProcessingModal('archive');
            showSuccessModal("Product has been successfully archived.");
        } catch (err) {
            console.error("Failed to archive product:", err);
            hideProcessingModal('archive');
            alert("Failed to archive product. Please try again.");
        }
    });
}

const closeArchiveModal = document.getElementById("closeArchiveModal");
const cancelArchiveModal = document.getElementById("cancelArchiveModal");

if (closeArchiveModal) closeArchiveModal.addEventListener("click", () => hideModal('archiveProductModal'));
if (cancelArchiveModal) cancelArchiveModal.addEventListener("click", () => hideModal('archiveProductModal'));

// ================== DELETE MODAL ==================
function showDeleteModal(id, name, img) {
    const deleteProductName = document.getElementById("deleteProductName");
    if (deleteProductName) deleteProductName.textContent = name;
    const modal = document.getElementById('deleteProductModal');
    modal.dataset.productId = id;
    modal.dataset.productImage = img || '';
    showModal('deleteProductModal');
}

const confirmDeleteProduct = document.getElementById("confirmDeleteProduct");
if (confirmDeleteProduct) {
    confirmDeleteProduct.addEventListener("click", async () => {
        const modal = document.getElementById('deleteProductModal');
        const id = modal.dataset.productId;
        const imageUrl = modal.dataset.productImage;
        const name = document.getElementById("deleteProductName").textContent;
        
        if (!id) return;
        
        // Show processing modal
        showProcessingModal('delete');
        
        try {
            await remove(dbRef(db, `products/${id}`));
            
            if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
                try { 
                    const imageRef = refFromURL(storage, imageUrl); 
                    await deleteObject(imageRef); 
                } catch (err) {
                    console.error("Failed to delete image:", err);
                }
            }
            
            const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
            await createLog(`${cashierUser.first_name} ${cashierUser.last_name} deleted product: ${name}`, "Delete Product");
            await loadProducts();
            await loadArchivedProducts();
            hideModal('deleteProductModal');
            
            // Hide processing modal and show success
            hideProcessingModal('delete');
            showSuccessModal("Product has been permanently deleted.");
        } catch (err) {
            console.error("Failed to delete product:", err);
            hideProcessingModal('delete');
            alert("Failed to delete product. Please try again.");
        }
    });
}

const closeDeleteModal = document.getElementById("closeDeleteModal");
const cancelDeleteModal = document.getElementById("cancelDeleteModal");

if (closeDeleteModal) closeDeleteModal.addEventListener("click", () => hideModal('deleteProductModal'));
if (cancelDeleteModal) cancelDeleteModal.addEventListener("click", () => hideModal('deleteProductModal'));

// ================== RESTORE MODAL ==================
function showRestoreModal(id, name) {
    const restoreProductName = document.getElementById("restoreProductName");
    if (restoreProductName) restoreProductName.textContent = name;
    document.getElementById('restoreProductModal').dataset.productId = id;
    showModal('restoreProductModal');
}

const confirmRestoreProduct = document.getElementById("confirmRestoreProduct");
if (confirmRestoreProduct) {
    confirmRestoreProduct.addEventListener("click", async () => {
        const modal = document.getElementById('restoreProductModal');
        const id = modal.dataset.productId;
        const name = document.getElementById("restoreProductName").textContent;
        
        if (!id) return;
        
        // Show processing modal
        showProcessingModal('restore');
        
        try {
            await update(dbRef(db, `products/${id}`), { archived: false });
            await createLog(`Restored product: ${name}`);
            await loadProducts();
            await loadArchivedProducts();
            hideModal('restoreProductModal');
            
            // Hide processing modal and show success
            hideProcessingModal('restore');
            showSuccessModal("Product has been successfully restored.");
        } catch (err) {
            console.error("Failed to restore product:", err);
            hideProcessingModal('restore');
            alert("Failed to restore product. Please try again.");
        }
    });
}

const closeRestoreModal = document.getElementById("closeRestoreModal");
const cancelRestoreModal = document.getElementById("cancelRestoreModal");

if (closeRestoreModal) closeRestoreModal.addEventListener("click", () => hideModal('restoreProductModal'));
if (cancelRestoreModal) cancelRestoreModal.addEventListener("click", () => hideModal('restoreProductModal'));

// ================== SUCCESS MODAL ==================
function showSuccessModal(msg) {
    const successModal = document.getElementById("successModal");
    if (!successModal) {
        console.warn('Success modal not found, using alert instead');
        alert(msg);
        return;
    }
    
    const msgElement = successModal.querySelector("p");
    if (msgElement) msgElement.textContent = msg;
    
    showModal('successModal');
    
    setTimeout(() => {
        hideModal('successModal');
    }, 2000);
}

const closeSuccessModal = document.getElementById("closeSuccessModal");
if (closeSuccessModal) {
    closeSuccessModal.addEventListener('click', () => hideModal('successModal'));
}

// ================== FILE ERROR MODAL ==================
function showFileErrorModal(message) {
    const modal = document.getElementById('fileErrorModal');
    const msgEl = document.getElementById('fileErrorMessage');
    if (msgEl) msgEl.textContent = message || 'Only JPG and PNG images are allowed.';
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    const closeBtn = document.getElementById('closeFileErrorModal');
    const okBtn = document.getElementById('fileErrorOkBtn');
    
    if (closeBtn) closeBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
    if (okBtn) okBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
}

// ================== SECTION TOGGLE FUNCTIONALITY ==================
const showAddProductBtn = document.getElementById('showAddProductBtn');
const showManageProductBtn = document.getElementById('showManageProductBtn');
const showArchivedProductBtn = document.getElementById('showArchivedProductBtn');

const addSection = document.getElementById('add_products');
const manageSection = document.getElementById('manage_products');
const archivedSection = document.getElementById('archived_products');

function updateButtonStates(activeBtn) {
    const buttons = [showAddProductBtn, showManageProductBtn, showArchivedProductBtn];
    
    buttons.forEach(btn => {
        if (btn) {
            if (btn === activeBtn) {
                btn.classList.remove('bg-white', 'text-slate-700', 'border', 'border-gray-200');
                btn.classList.add('btn-gradient', 'bg-gradient-to-r', 'from-blue-500', 'to-blue-600', 'text-white', 'shadow-lg');
            } else {
                btn.classList.add('bg-white', 'text-slate-700', 'border', 'border-gray-200');
                btn.classList.remove('btn-gradient', 'bg-gradient-to-r', 'from-blue-500', 'to-blue-600', 'text-white', 'shadow-lg');
            }
        }
    });
}

if (showAddProductBtn) {
    showAddProductBtn.addEventListener('click', () => {
        if (addSection) addSection.classList.remove('hidden');
        if (manageSection) manageSection.classList.add('hidden');
        if (archivedSection) archivedSection.classList.add('hidden');
        updateButtonStates(showAddProductBtn);
    });
}

if (showManageProductBtn) {
    showManageProductBtn.addEventListener('click', () => {
        if (addSection) addSection.classList.add('hidden');
        if (manageSection) manageSection.classList.remove('hidden');
        if (archivedSection) archivedSection.classList.add('hidden');
        updateButtonStates(showManageProductBtn);
    });
}

if (showArchivedProductBtn) {
    showArchivedProductBtn.addEventListener('click', () => {
        if (addSection) addSection.classList.add('hidden');
        if (manageSection) manageSection.classList.add('hidden');
        if (archivedSection) archivedSection.classList.remove('hidden');
        updateButtonStates(showArchivedProductBtn);
    });
}

// ================== SIDEBAR ACTIVE STATE ==================
function highlightSidebar(activeBtnId) {
    const sidebarButtons = [
        { btnId: 'showAddProductBtn', sectionId: 'add_products' },
        { btnId: 'showManageProductBtn', sectionId: 'manage_products' },
        { btnId: 'showArchivedProductBtn', sectionId: 'archived_products' },
    ];

    sidebarButtons.forEach(item => {
        const btn = document.getElementById(item.btnId);
        if (btn) {
            if (item.btnId === activeBtnId) {
                btn.classList.add('bg-blue-500', 'text-white', 'transition-all', 'duration-300');
            } else {
                btn.classList.remove('bg-blue-500', 'text-white');
            }
        }
    });
}

// ================== INITIALIZATION ==================
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing products management');
    
    // Initialize logout modal first
    initializeLogoutModal();

    // Initialize image preview functionality
    initializeImagePreview();

    // Reset pagination to first page for both active and archived
    PAGINATION_CONFIG.active.currentPage = 1;
    PAGINATION_CONFIG.archived.currentPage = 1;
    
    // Load products on startup
    loadProducts();
    loadArchivedProducts();

    // Sidebar highlighting logic
    const url = window.location.href;
    if (url.includes('add_products.html') || url.includes('products.html')) {
        highlightSidebar('showAddProductBtn');
        if (addSection) addSection.classList.remove('hidden');
        updateButtonStates(showAddProductBtn);
    } else if (url.includes('manage_products.html') || url.includes('buy_products.html')) {
        highlightSidebar('showManageProductBtn');
        if (manageSection) manageSection.classList.remove('hidden');
        updateButtonStates(showManageProductBtn);
    } else if (url.includes('archived_products.html')) {
        highlightSidebar('showArchivedProductBtn');
        if (archivedSection) archivedSection.classList.remove('hidden');
        updateButtonStates(showArchivedProductBtn);
    }

    // Sidebar active state
    const sidebarItems = document.querySelectorAll('#sidebar .menu-item');
    const currentPage = window.location.pathname.split("/").pop();
    sidebarItems.forEach(item => {
        const page = item.dataset.page;
        if (page === currentPage) {
            item.classList.remove('text-gray-300');
            item.classList.add('bg-blue-600', 'text-white', 'font-semibold', 'rounded-lg', 'px-3', 'py-2');
        } else {
            item.classList.remove('bg-blue-600', 'text-white', 'font-semibold', 'rounded-lg', 'px-3', 'py-2');
            item.classList.add('text-gray-300');
        }
    });

    console.log('Products management initialization complete');
});

// ================== ADD CSS STYLES ==================
const style = document.createElement('style');
style.textContent = `
    .modal {
        transition: opacity 0.5s ease-in-out;
    }
    .modal-scale {
        transition: all 0.5s ease-in-out;
        transform: scale(0.9);
        opacity: 0;
    }
    .modal-scale.show {
        transform: scale(1);
        opacity: 1;
    }
    
    /* Pagination Styles */
    #paginationControls, #archived_paginationControls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        justify-content: center;
    }

    #paginationControls button, #archived_paginationControls button {
        transition: all 0.2s ease;
        border: 1px solid #d1d5db;
        min-width: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    #paginationControls button:hover:not(:disabled), 
    #archived_paginationControls button:hover:not(:disabled) {
        background-color: #f3f4f6;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    #paginationControls button:disabled, 
    #archived_paginationControls button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    /* Responsive pagination info */
    #paginationInfo, #archived_paginationInfo {
        text-align: center;
        margin-bottom: 1rem;
    }

    @media (min-width: 640px) {
        #paginationInfo, #archived_paginationInfo {
            text-align: left;
            margin-bottom: 0;
        }
    }

    /* Image Preview Styles */
    .image-preview-container {
        position: relative;
        display: inline-block;
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        padding: 12px;
        background: #f8fafc;
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    .image-preview-container:hover {
        border-color: #3b82f6;
        background: #eff6ff;
    }

    .image-preview-container.has-image {
        border-style: solid;
        border-color: #3b82f6;
        background: white;
        cursor: default;
    }

    .preview-image {
        max-width: 200px;
        max-height: 200px;
        object-fit: cover;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .remove-preview-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        z-index: 10;
    }

    .remove-preview-btn:hover {
        background: #dc2626;
        transform: scale(1.1);
    }

    .remove-preview-btn.hidden {
        display: none !important;
    }

    .upload-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px;
        color: #64748b;
        cursor: pointer;
    }

    .upload-placeholder i {
        font-size: 48px;
        margin-bottom: 12px;
        color: #94a3b8;
    }

    /* Enhanced animations */
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideIn {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
    }

    .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
    }

    .animate-slideIn {
        animation: slideIn 0.3s ease-out;
    }

    /* Smooth hover animations for table rows */
    tbody tr {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    tbody tr:hover {
        background-color: #f8fafc;
        transform: translateX(4px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    /* Enhanced button effects */
    .btn-gradient {
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }
    .btn-gradient:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
    }
    .btn-gradient::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s;
    }
    .btn-gradient:hover::before {
        left: 100%;
    }

    /* Enhanced sidebar */
    .menu-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-radius: 8px;
        transition: all 0.2s;
        gap: 12px;
    }
    
    .menu-item:hover {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
        transform: translateX(4px);
    }

    .menu-item.active {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
    }

    /* Card enhancements */
    .card-enhanced {
        background: white;
        border-radius: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        border: 1px solid #e5e7eb;
        transition: all 0.3s ease;
    }

    .card-enhanced:hover {
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        transform: translateY(-2px);
    }

    /* Input focus effects */
    input:focus, select:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    /* Table enhancements */
    table {
        border-collapse: separate;
        border-spacing: 0;
    }

    thead th {
        position: sticky;
        top: 0;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
        color: #475569;
        padding: 16px;
    }

    tbody td {
        padding: 16px;
        border-bottom: 1px solid #f1f5f9;
    }

    /* Action button styles */
    .action-btn {
        padding: 8px 12px;
        border-radius: 6px;
        transition: all 0.2s;
        font-size: 0.875rem;
    }

    .action-btn:hover {
        transform: scale(1.05);
    }
`;
document.head.appendChild(style);