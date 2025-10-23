import { db } from "firebase_conn.js";
import { ref, get, update, push, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let isProcessing = false;
let isCardValid = false;

// Elements
const cardInput = document.getElementById('card_number_return');
const addBalanceInput = document.getElementById('add_balance_input');
const submitBtn = document.querySelector('#loadCardForm button[type="submit"]');
const feedbackEl = document.getElementById('cardFeedback');

const successModal = document.getElementById('successModal');
const processingModal = document.getElementById('processingModal');
const modalMessage = document.getElementById('modalMessage');
const closeModalBtn = document.getElementById('closeModalBtn');

// ================= Logout Functionality =================
function initializeLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModal = document.createElement('div');
  
  // Create logout confirmation modal
  logoutModal.innerHTML = `
    <div id="logoutConfirmationModal" class="fixed inset-0 bg-black bg-opacity-60 hidden items-center justify-center z-50 px-4 backdrop-blur-sm">
      <div class="p-8 bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slideUp">
        <div class="flex items-start justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800">Confirm Logout</h2>
          <button id="closeLogoutModalBtn" class="text-gray-400 hover:text-gray-600 transition">
            <i class="fas fa-times fa-lg"></i>
          </button>
        </div>
        
        <div class="space-y-6">
          <div class="flex items-center justify-center">
            <div class="bg-red-50 p-4 rounded-full">
              <i class="fas fa-sign-out-alt text-red-500 text-4xl"></i>
            </div>
          </div>
          
          <div class="text-center">
            <p class="text-lg text-gray-700 font-medium">Are you sure you want to logout?</p>
            <p class="text-sm text-gray-500 mt-2">You will need to log in again to access the system.</p>
          </div>
          
          <div class="flex justify-center gap-4 pt-2">
            <button id="cancelLogoutBtn" class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2">
              <i class="fas fa-times"></i> Cancel
            </button>
            <button id="confirmLogoutBtn" class="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2 shadow-lg">
              <i class="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(logoutModal);

  const refreshedLogoutModal = document.getElementById('logoutConfirmationModal');
  const refreshedCloseBtn = document.getElementById('closeLogoutModalBtn');
  const refreshedCancelBtn = document.getElementById('cancelLogoutBtn');
  const refreshedConfirmBtn = document.getElementById('confirmLogoutBtn');

  // Remove any existing event listeners to prevent conflicts
  const newLogoutBtn = logoutBtn.cloneNode(true);
  logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

  // Get fresh reference to logout button
  const refreshedLogoutBtn = document.getElementById('logoutBtn');

  // Show logout modal when logout button is clicked
  refreshedLogoutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Logout button clicked - showing modal');
    refreshedLogoutModal.classList.remove('hidden');
    refreshedLogoutModal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
  });

  // Close modal when close button is clicked
  refreshedCloseBtn.addEventListener('click', function() {
    console.log('Close logout modal');
    refreshedLogoutModal.classList.add('hidden');
    refreshedLogoutModal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
  });

  // Close modal when cancel button is clicked
  refreshedCancelBtn.addEventListener('click', function() {
    console.log('Cancel logout');
    refreshedLogoutModal.classList.add('hidden');
    refreshedLogoutModal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
  });

  // Perform logout when confirm button is clicked
  refreshedConfirmBtn.addEventListener('click', function() {
    console.log('Confirming logout');
    
    // Show processing state
    refreshedConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
    refreshedConfirmBtn.disabled = true;

    // Clear local storage
    localStorage.removeItem('cashierUser');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    sessionStorage.clear();

    // Sign out from Firebase
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        console.log('Firebase signout successful');
        // Redirect to login page - UPDATED PATH
        window.location.href = '/SMARTBITE-ADMIN/login.html';
      })
      .catch((error) => {
        console.error('Firebase logout failed:', error);
        // Still redirect even if Firebase signout fails - UPDATED PATH
        window.location.href = '/SMARTBITE-ADMIN/login.html';
      });
  });

  // Close modal when clicking outside
  refreshedLogoutModal.addEventListener('click', function(e) {
    if (e.target === refreshedLogoutModal) {
      console.log('Clicked outside modal - closing');
      refreshedLogoutModal.classList.add('hidden');
      refreshedLogoutModal.classList.remove('flex');
      document.body.classList.remove('overflow-hidden');
    }
  });

  // Prevent any form submission if logout button is inside a form
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      if (e.submitter === refreshedLogoutBtn) {
        e.preventDefault();
      }
    });
  });
}

// ================= Modal control functions =================
function showProcessingModal() {
    const modal = document.getElementById('processingModal');
    const modalContent = modal.querySelector('.modal-content');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.style.transform = 'scale(1)';
        modalContent.style.opacity = '1';
    }, 10);
}

function hideProcessingModal() {
    const modal = document.getElementById('processingModal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.style.transform = 'scale(0.9)';
    modalContent.style.opacity = '0';
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function showSuccessModal(message) {
    const modal = document.getElementById('successModal');
    const modalContent = modal.querySelector('.modal-content');
    const modalMessage = document.getElementById('modalMessage');
    const successIconContainer = document.getElementById('successIconContainer');
    
    // Clear and add check mark icon to the container
    successIconContainer.innerHTML = '<i class="fas fa-check-circle text-green-600 text-3xl"></i>';
    
    modalMessage.innerHTML = message;
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modalContent.style.transform = 'scale(1)';
        modalContent.style.opacity = '1';
    }, 10);
    
    // Close modal when OK button is clicked
    document.getElementById('closeModalBtn').onclick = function() {
        modalContent.style.transform = 'scale(0.9)';
        modalContent.style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.add('hidden');
            // Focus back to card input after modal closes
            focusCardInput();
        }, 300);
    };
}

// ================= Balance Check Modal Functions =================
function showBalanceCheckModal(cardData) {
    const modal = document.getElementById('balanceCheckModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Populate modal with card data
    document.getElementById('modalCardHolder').textContent = cardData.name || '-';
    document.getElementById('modalLRN').textContent = cardData.lrn || '-';
    document.getElementById('modalCardNumber').textContent = cardData.cardNumber || '-';
    document.getElementById('modalBalance').textContent = `₱${parseFloat(cardData.balance || 0).toFixed(2)}`;
    
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modalContent.style.transform = 'scale(1)';
        modalContent.style.opacity = '1';
    }, 10);
    
    // Close modal when OK button is clicked
    document.getElementById('closeBalanceModalBtn').onclick = function() {
        modalContent.style.transform = 'scale(0.9)';
        modalContent.style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.add('hidden');
            // Reset view balance button
            resetViewBalanceButton();
        }, 300);
    };
}

// ================= View Balance Functionality =================
function initializeViewBalance() {
    const viewBalanceBtn = document.getElementById('viewBalanceBtn');
    const quickBalance = document.getElementById('quickBalance');
    const quickCardHolder = document.getElementById('quickCardHolder');
    const quickLRN = document.getElementById('quickLRN');
    const quickStatus = document.getElementById('quickStatus');
    
    let isCheckingBalance = false;
    let cardInputActive = false;
    
    // Create a hidden card input for balance checking
    const hiddenCardInput = document.createElement('input');
    hiddenCardInput.type = 'text';
    hiddenCardInput.id = 'hiddenCardInput';
    hiddenCardInput.style.position = 'absolute';
    hiddenCardInput.style.opacity = '0';
    hiddenCardInput.style.pointerEvents = 'none';
    hiddenCardInput.style.height = '0';
    hiddenCardInput.style.width = '0';
    document.body.appendChild(hiddenCardInput);
    
    // Reset view balance button state
    function resetViewBalanceButton() {
        viewBalanceBtn.disabled = false;
        viewBalanceBtn.innerHTML = '<i class="fas fa-credit-card"></i> Click to View Balance';
        quickStatus.textContent = 'Ready';
        quickStatus.className = 'balance-info-value';
        cardInputActive = false;
        hiddenCardInput.value = '';
        hiddenCardInput.blur();
    }
    
    // Start balance check process
    viewBalanceBtn.addEventListener('click', function() {
        if (isCheckingBalance) return;
        
        isCheckingBalance = true;
        viewBalanceBtn.disabled = true;
        viewBalanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ready for Card Tap';
        quickStatus.textContent = 'Waiting for card...';
        quickStatus.className = 'balance-info-value text-yellow-600';
        
        // Reset display
        quickBalance.textContent = '₱0.00';
        quickCardHolder.textContent = '-';
        quickLRN.textContent = '-';
        
        // Focus on hidden input to capture card data
        cardInputActive = true;
        hiddenCardInput.value = '';
        hiddenCardInput.focus();
        
        // Set timeout to reset if no card is tapped
        setTimeout(() => {
            if (cardInputActive) {
                resetViewBalanceButton();
                isCheckingBalance = false;
                quickStatus.textContent = 'Timeout - Try again';
                quickStatus.className = 'balance-info-value text-red-600';
            }
        }, 10000); // 10 second timeout
    });
    
    // Handle card input in hidden field
    hiddenCardInput.addEventListener('input', function() {
        if (!cardInputActive) return;
        
        // Remove any non-digit characters and limit to 10 digits
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
        
        // Check if we have a complete card number
        if (this.value.length === 10) {
            cardInputActive = false;
            viewBalanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking Balance...';
            quickStatus.textContent = 'Checking balance...';
            
            // Fetch card information
            fetchCardBalance(this.value);
        }
    });
    
    // Fetch card balance information
    async function fetchCardBalance(cardNumber) {
        try {
            const userData = await window.fetchCurrentBalance(cardNumber);
            
            if (userData && !userData.disabled) {
                // Update quick view display
                const balance = parseFloat(userData.balance || 0).toFixed(2);
                const name = `${userData.first_name || userData.student_fname || ''} ${userData.middle_name || userData.student_mname || ''} ${userData.last_name || userData.student_lname || ''}`.trim();
                const lrn = userData.lrn_number || '-';
                
                quickBalance.textContent = `₱${balance}`;
                quickCardHolder.textContent = name || '-';
                quickLRN.textContent = lrn;
                quickStatus.textContent = 'Balance retrieved';
                quickStatus.className = 'balance-info-value text-green-600';
                
                // Show detailed modal
                showBalanceCheckModal({
                    name: name,
                    lrn: lrn,
                    cardNumber: cardNumber,
                    balance: balance
                });
            } else {
                // Card not found or disabled
                quickBalance.textContent = '₱0.00';
                quickCardHolder.textContent = '-';
                quickLRN.textContent = '-';
                quickStatus.textContent = userData ? 'Account disabled' : 'Card not found';
                quickStatus.className = 'balance-info-value text-red-600';
                
                // Reset button after a delay
                setTimeout(() => {
                    resetViewBalanceButton();
                }, 2000);
            }
        } catch (error) {
            console.error('Error fetching card balance:', error);
            quickStatus.textContent = 'Error fetching balance';
            quickStatus.className = 'balance-info-value text-red-600';
            
            // Reset button after a delay
            setTimeout(() => {
                resetViewBalanceButton();
            }, 2000);
        } finally {
            isCheckingBalance = false;
        }
    }
    
    // Allow manual entry as fallback
    hiddenCardInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            resetViewBalanceButton();
            isCheckingBalance = false;
        }
    });
}

// ================= Mode Toggle Functionality =================
function initializeModeToggle() {
    const viewBalanceModeBtn = document.getElementById('viewBalanceModeBtn');
    const loadBalanceModeBtn = document.getElementById('loadBalanceModeBtn');
    const viewBalanceSection = document.getElementById('viewBalanceSection');
    const loadBalanceSection = document.getElementById('loadBalanceSection');

    viewBalanceModeBtn.addEventListener('click', function() {
        viewBalanceModeBtn.classList.add('active');
        loadBalanceModeBtn.classList.remove('active');
        viewBalanceSection.classList.remove('hidden');
        loadBalanceSection.classList.add('hidden');
    });

    loadBalanceModeBtn.addEventListener('click', function() {
        loadBalanceModeBtn.classList.add('active');
        viewBalanceModeBtn.classList.remove('active');
        loadBalanceSection.classList.remove('hidden');
        viewBalanceSection.classList.add('hidden');
        // Focus on card input when switching to load balance mode
        setTimeout(() => focusCardInput(), 100);
    });
}

// ================= Main Application Functions =================
// Create validation icons
function createValidationIcons() {
    // Card input icon
    const cardIconContainer = document.createElement('div');
    cardIconContainer.className = 'absolute right-3 top-1/2 transform -translate-y-1/2';
    cardIconContainer.id = 'cardValidationIcon';
    
    const cardIcon = document.createElement('div');
    cardIcon.className = 'w-5 h-5 flex items-center justify-center';
    cardIconContainer.appendChild(cardIcon);
    
    cardInput.parentElement.classList.add('relative');
    cardInput.parentElement.appendChild(cardIconContainer);
    
    // Balance input icon
    const balanceIconContainer = document.createElement('div');
    balanceIconContainer.className = 'absolute right-3 top-1/2 transform -translate-y-1/2';
    balanceIconContainer.id = 'balanceValidationIcon';
    
    const balanceIcon = document.createElement('div');
    balanceIcon.className = 'w-5 h-5 flex items-center justify-center';
    balanceIconContainer.appendChild(balanceIcon);
    
    addBalanceInput.parentElement.classList.add('relative');
    addBalanceInput.parentElement.appendChild(balanceIconContainer);
}

// Update validation icon
function updateValidationIcon(field, isValid, isChecking = false) {
    const iconContainer = document.getElementById(`${field}ValidationIcon`);
    if (!iconContainer) return;
    
    const icon = iconContainer.querySelector('div');
    icon.innerHTML = '';
    
    if (isChecking) {
        icon.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;
    } else if (isValid) {
        icon.innerHTML = `
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
    } else {
        icon.innerHTML = `
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        `;
    }
}

// Enable/disable balance input based on card validity
function toggleBalanceInput(enabled) {
    if (enabled) {
        addBalanceInput.disabled = false;
        addBalanceInput.placeholder = "Enter amount to add";
        addBalanceInput.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-400');
        addBalanceInput.classList.add('bg-white');
    } else {
        addBalanceInput.disabled = true;
        addBalanceInput.placeholder = "Verify card first";
        addBalanceInput.value = '';
        addBalanceInput.classList.remove('bg-white', 'border-green-500');
        addBalanceInput.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-400', 'border-gray-300');
        updateValidationIcon('balance', false);
    }
}

// Focus on card input and select all text
function focusCardInput() {
    cardInput.focus();
    cardInput.select();
    cardInput.style.caretColor = 'transparent';
}

// Close modal
closeModalBtn.addEventListener('click', () => {
    const modalContent = successModal.querySelector('.modal-content');
    modalContent.style.transform = 'scale(0.9)';
    modalContent.style.opacity = '0';
    setTimeout(() => {
        successModal.classList.add('hidden');
        // Focus back to card input after modal closes
        focusCardInput();
    }, 300);
});

// Reset display
function resetDisplay() {
    document.getElementById('current_balance').textContent = "0.00";
    document.getElementById('card_holder_name').textContent = "-";
    document.getElementById('lrn').textContent = "-";
    cardInput.classList.remove('border-green-500', 'border-red-500', 'border-gray-300');
    addBalanceInput.classList.remove('border-red-500', 'border-green-500', 'border-gray-300');
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('text-red-500', 'text-green-500');
    
    // Reset validation icons
    updateValidationIcon('card', false);
    updateValidationIcon('balance', false);
    
    // Disable balance input initially
    toggleBalanceInput(false);
}

// Show error feedback
function showError(message, field = null) {
    feedbackEl.textContent = message;
    feedbackEl.classList.add('text-red-500');
    feedbackEl.classList.remove('text-green-500');
    
    if (field === 'card') {
        cardInput.classList.remove('border-green-500', 'border-gray-300');
        cardInput.classList.add('border-red-500');
        updateValidationIcon('card', false);
        // Disable balance input when card is invalid
        toggleBalanceInput(false);
    } else if (field === 'balance') {
        addBalanceInput.classList.remove('border-green-500', 'border-gray-300');
        addBalanceInput.classList.add('border-red-500');
        updateValidationIcon('balance', false);
    }
}

// Show success feedback
function showSuccess(message) {
    feedbackEl.textContent = message;
    feedbackEl.classList.add('text-green-500');
    feedbackEl.classList.remove('text-red-500');
}

// Validate card number format
function validateCardNumber(cardNumber) {
    if (!cardNumber) {
        showError('Please enter a card number', 'card');
        return false;
    }
    if (!/^\d{10}$/.test(cardNumber)) {
        showError('Card number must be exactly 10 digits', 'card');
        return false;
    }
    cardInput.classList.remove('border-red-500', 'border-gray-300');
    cardInput.classList.add('border-green-500');
    updateValidationIcon('card', true);
    return true;
}

// Check and enforce the ₱5,000 limit
function enforceBalanceLimit() {
    const balance = parseFloat(addBalanceInput.value);
    
    if (balance > 5000) {
        // Disable the submit button
        submitBtn.disabled = true;
        
        // Show error message
        showError('❌ Maximum single transaction is ₱5,000. Please enter a lower amount.', 'balance');
        
        return false;
    }
    
    return true;
}

// Validate balance amount
function validateBalance(balance) {
    if (isNaN(balance) || balance === '') {
        showError('Please enter a balance amount', 'balance');
        return false;
    }
    if (parseFloat(balance) <= 0) {
        showError('Balance must be greater than 0', 'balance');
        return false;
    }
    if (parseFloat(balance) > 5000) {
        showError('Maximum single transaction is ₱5,000', 'balance');
        return false;
    }
    addBalanceInput.classList.remove('border-red-500', 'border-gray-300');
    addBalanceInput.classList.add('border-green-500');
    updateValidationIcon('balance', true);
    return true;
}

// Real-time validation for both fields
function validateForm() {
    const cardNumber = cardInput.value.trim();
    const balance = addBalanceInput.value.trim();
    
    // Clear previous errors
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('text-red-500', 'text-green-500');
    
    let cardValid = true;
    let balanceValid = true;
    
    if (cardNumber) {
        cardValid = validateCardNumber(cardNumber);
    } else {
        cardInput.classList.remove('border-red-500', 'border-green-500');
        cardInput.classList.add('border-gray-300');
        updateValidationIcon('card', false);
        // Keep balance disabled if no card number
        toggleBalanceInput(false);
    }

    // Only validate balance if card is valid and balance input is enabled
    if (balance && isCardValid) {
        balanceValid = validateBalance(balance);
        
        // Additional check for the ₱5,000 limit
        if (balance && parseFloat(balance) > 5000) {
            balanceValid = false;
            submitBtn.disabled = true;
        }
    } else if (balance) {
        // If there's balance input but card is invalid, clear it
        addBalanceInput.value = '';
        balanceValid = false;
    } else {
        addBalanceInput.classList.remove('border-red-500', 'border-green-500');
        addBalanceInput.classList.add('border-gray-300');
        updateValidationIcon('balance', false);
    }

    submitBtn.disabled = !(cardValid && balanceValid && cardNumber && balance && isCardValid && parseFloat(balance) <= 5000);
    return cardValid && balanceValid && parseFloat(balance) <= 5000;
}

// Fetch card info
window.fetchCurrentBalance = async function(cardNumber) {
    if (!/^\d{10}$/.test(cardNumber)) return;

    const balanceEl = document.getElementById('current_balance');
    const nameEl = document.getElementById('card_holder_name');
    const lrnEl = document.getElementById('lrn');

    try {
        // Show loading state
        updateValidationIcon('card', false, true);
        
        const snapshot = await get(ref(db, 'student_users'));
        let found = false;
        let isDisabled = false;
        let userData = null;

        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                if (data.id_number === cardNumber) {
                    found = true;
                    isDisabled = data.disabled ?? false;
                    userData = { ...data, key: child.key };

                    balanceEl.textContent = parseFloat(data.balance ?? 0).toFixed(2);
                    nameEl.textContent = `${data.first_name ?? data.student_fname ?? ''} ${data.middle_name ?? data.student_mname ?? ''} ${data.last_name ?? data.student_lname ?? ''}`.trim() || '-';
                    lrnEl.textContent = data.lrn_number ?? '-';
                }
            });
        }

        // Treat invalid or disabled the same
        if (!found || isDisabled) {
            isCardValid = false;
            cardInput.classList.remove('border-green-500', 'border-gray-300');
            cardInput.classList.add('border-red-500');
            updateValidationIcon('card', false);
            submitBtn.disabled = true;
            addBalanceInput.value = '';
            toggleBalanceInput(false);
            showError(!found ? '⚠️ Card not found! Cannot add balance.' : '⚠️ This account is disabled. Cannot load balance.', 'card');
            // Auto-focus back to card input for quick retry
            setTimeout(() => focusCardInput(), 500);
            return null;
        }

        // Valid card
        isCardValid = true;
        cardInput.classList.remove('border-red-500', 'border-gray-300');
        cardInput.classList.add('border-green-500');
        updateValidationIcon('card', true);
        // Enable balance input only when card is valid
        toggleBalanceInput(true);
        showSuccess('✅ Card verified! You can now add balance.');
        submitBtn.disabled = !validateForm();
        
        return userData;

    } catch (error) {
        console.error("Error fetching balance:", error);
        isCardValid = false;
        cardInput.classList.remove('border-green-500', 'border-gray-300');
        cardInput.classList.add('border-red-500');
        updateValidationIcon('card', false);
        toggleBalanceInput(false);
        showError('❌ Error fetching card information. Please try again.', 'card');
        submitBtn.disabled = true;
        // Auto-focus back to card input for quick retry
        setTimeout(() => focusCardInput(), 500);
        return null;
    }
};

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    // Initialize all functionality
    initializeLogout();
    initializeViewBalance();
    initializeModeToggle();
    createValidationIcons();
    focusCardInput();
    
    // Set initial border colors and disable balance input
    cardInput.classList.add('border-gray-300');
    addBalanceInput.classList.add('border-gray-300');
    toggleBalanceInput(false);
});

// Real-time card input with strict number validation
cardInput.addEventListener('input', function() {
    // Remove any non-digit characters and limit to 10 digits
    this.value = this.value.replace(/\D/g, '').slice(0, 10);

    // Reset validation state when input changes
    if (this.value.length < 10) {
        isCardValid = false;
        resetDisplay();
        validateForm();
        cardInput.style.caretColor = 'transparent';
        submitBtn.disabled = true;
        
        // Show red X if there's some input but not complete
        if (this.value.length > 0) {
            cardInput.classList.remove('border-green-500', 'border-gray-300');
            cardInput.classList.add('border-red-500');
            updateValidationIcon('card', false);
            toggleBalanceInput(false);
        } else {
            cardInput.classList.remove('border-red-500', 'border-green-500');
            cardInput.classList.add('border-gray-300');
            updateValidationIcon('card', false);
            toggleBalanceInput(false);
        }
        return;
    }

    // Only fetch balance when we have exactly 10 digits
    fetchCurrentBalance(this.value).then((userData) => {
        if (userData && cardInput.classList.contains('border-green-500')) {
            cardInput.style.caretColor = '';
            submitBtn.disabled = !validateForm();
        } else {
            cardInput.style.caretColor = 'transparent';
            submitBtn.disabled = true;
            toggleBalanceInput(false);
        }
    });
});

// Prevent non-numeric input for card field
cardInput.addEventListener('keydown', function(e) {
    // Allow: backspace, delete, tab, escape, enter, arrows
    if ([46, 8, 9, 27, 13, 110].includes(e.keyCode) || 
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) || 
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
        return;
    }
    
    // Ensure it's a number and stop the keypress if not
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
    }
});

// Balance input: manual only, block scanner (only when enabled)
addBalanceInput.addEventListener('input', function(e) {
    // If balance input is disabled, prevent any input
    if (this.disabled || !isCardValid) {
        this.value = '';
        return;
    }

    // Enhanced scanner detection
    if (e.inputType === 'insertFromPaste' || 
        (e.isTrusted === false && this.value.length > 5) || 
        (this.value.length > 1 && Date.now() - (this._lastInputTime || 0) < 100)) {
        this.value = '';
        showError('⚠️ Please type the balance manually.', 'balance');
        submitBtn.disabled = true;
        return;
    }
    
    this._lastInputTime = Date.now();

    // Allow only numbers and single decimal point
    this.value = this.value.replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const decimalCount = (this.value.match(/\./g) || []).length;
    if (decimalCount > 1) {
        this.value = this.value.substring(0, this.value.lastIndexOf('.'));
    }
    
    // Limit to 2 decimal places
    if (this.value.includes('.')) {
        const parts = this.value.split('.');
        if (parts[1].length > 2) {
            this.value = parts[0] + '.' + parts[1].substring(0, 2);
        }
    }

    // Enforce the ₱5,000 limit in real-time
    enforceBalanceLimit();
    
    // Only validate form if under the limit
    if (parseFloat(this.value) <= 5000) {
        validateForm();
    }
});

// Prevent any focus or interaction with balance input when disabled
addBalanceInput.addEventListener('focus', function() {
    if (this.disabled || !isCardValid) {
        this.blur();
        // Show message to verify card first
        if (!isCardValid) {
            showError('Please verify your card first before entering balance', 'card');
        }
        // Focus back to card input
        focusCardInput();
    }
});

// Focus out validations
cardInput.addEventListener('blur', function() {
    if (this.value && this.value.length !== 10) {
        showError('❌ Card number must be exactly 10 digits', 'card');
    }
});

addBalanceInput.addEventListener('blur', function() {
    // Only validate balance if card is valid and input is enabled
    if (this.disabled || !isCardValid) return;
    
    const balance = parseFloat(this.value);
    if (this.value && (isNaN(balance) || balance <= 0)) {
        showError('❌ Please enter a valid amount greater than 0', 'balance');
    }
});

// Form submit
document.getElementById('loadCardForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (isProcessing || !isCardValid) return;

    const cardNumber = cardInput.value.trim();
    const addBalance = parseFloat(addBalanceInput.value);
    const now = new Date();
    const dateTimeNow = now.toLocaleString();

    // Double-check the ₱5,000 limit before proceeding
    if (addBalance > 5000) {
        showError('❌ Maximum single transaction is ₱5,000. Please enter a lower amount.', 'balance');
        return;
    }

    if (!validateCardNumber(cardNumber) || !validateBalance(addBalance)) return;

    isProcessing = true;
    cardInput.disabled = true;
    addBalanceInput.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    // Show processing modal
    showProcessingModal();

    // Add minimum processing time to show the modal properly
    const startTime = Date.now();
    const minimumProcessingTime = 1500; // 1.5 seconds minimum

    try {
        // Verify card status before processing
        const userData = await fetchCurrentBalance(cardNumber);
        
        if (!userData || userData.disabled) {
            hideProcessingModal();
            showError(!userData ? '⚠️ Card not found! Cannot add balance.' : '❌ This account is disabled. Cannot load balance.', 'card');
            cardInput.blur();
            return;
        }

        const previousBalance = parseFloat(userData.balance ?? 0);
        const newBalance = previousBalance + addBalance;
        
        if (newBalance > 50000) { 
            hideProcessingModal();
            showError('❌ Balance cannot exceed ₱50,000. Please contact administrator.', 'balance'); 
            return; 
        }

        // Update balance in database
        await update(ref(db, `student_users/${userData.key}`), { balance: newBalance });

        document.getElementById('current_balance').textContent = newBalance.toFixed(2);
        showSuccess(`✅ Balance added successfully!`);
        cardInput.classList.add('border-green-500');
        addBalanceInput.classList.add('border-green-500');

        // Prepare student info for modal and logging
        const studentName = `${userData.first_name ?? userData.student_fname ?? ''} ${userData.middle_name ?? userData.student_mname ?? ''} ${userData.last_name ?? userData.student_lname ?? ''}`.trim();
        const studentLRN = userData.lrn_number ?? '';

        // Calculate remaining time to meet minimum processing time
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(minimumProcessingTime - elapsedTime, 0);

        // Wait for remaining time before showing success
        await new Promise(resolve => setTimeout(resolve, remainingTime));

        // Hide processing modal and show success modal
        hideProcessingModal();

        // Show success modal - WITHOUT DUPLICATE CHECK MARK
        const successMessage = `
            <div class="text-center">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">Balance Added Successfully!</h3>
                <div class="text-left bg-gray-50 p-4 rounded-lg mb-4">
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div class="text-gray-600">Student Name:</div><div class="font-medium">${studentName || 'N/A'}</div>
                        <div class="text-gray-600">LRN:</div><div class="font-medium">${studentLRN || 'N/A'}</div>
                        <div class="text-gray-600">Card Number:</div><div class="font-medium">${cardNumber}</div>
                        <div class="text-gray-600">Amount Added:</div><div class="font-medium text-green-600">₱${addBalance.toFixed(2)}</div>
                        <div class="text-gray-600">Previous Balance:</div><div class="font-medium">₱${previousBalance.toFixed(2)}</div>
                        <div class="text-gray-600">New Balance:</div><div class="font-medium text-blue-600">₱${newBalance.toFixed(2)}</div>
                        <div class="text-gray-600">Date & Time:</div><div class="font-medium">${new Date().toLocaleString()}</div>
                    </div>
                </div>
                <p class="text-sm text-gray-600">The balance has been successfully loaded to the student's account.</p>
            </div>
        `;

        // Show success modal after processing modal is fully hidden
        setTimeout(() => {
            showSuccessModal(successMessage);
        }, 300);

        // Log transaction
        try {
            const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
            if (cashierUser) {
                const logsRef = ref(db, "logs");
                const newLogRef = push(logsRef);

                await set(newLogRef, {
                    action: "Add Load",
                    user: `${cashierUser.first_name} ${cashierUser.last_name}`,
                    lrn_number: `${userData.lrn_number}`,
                    message: `${cashierUser.first_name} ${cashierUser.last_name} loaded ₱${addBalance.toFixed(2)} to card ${cardNumber} (${userData.first_name ?? userData.student_fname ?? ''} ${userData.last_name ?? userData.student_lname ?? ''})`,
                    timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
                });
            }
        } catch (logError) {
            console.error("Error logging transaction:", logError);
        }

        // Reset form after successful transaction and focus back to card input
        setTimeout(() => {
            e.target.reset();
            resetDisplay();
            submitBtn.textContent = 'Add Balance';
            submitBtn.disabled = true;
            isCardValid = false;
            
            // Focus back to card input immediately after reset
            focusCardInput();
        }, 1000);

    } catch (error) {
        console.error("Error adding balance:", error);
        
        // Ensure minimum processing time even for errors
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(minimumProcessingTime - elapsedTime, 0);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
        
        hideProcessingModal();
        setTimeout(() => {
            showError('❌ Error adding balance. Please try again.');
        }, 300);
        
        // Even on error, focus back to card input
        setTimeout(() => {
            focusCardInput();
        }, 500);
    } finally {
        cardInput.disabled = false;
        addBalanceInput.disabled = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Balance';
        isProcessing = false;
    }
});
