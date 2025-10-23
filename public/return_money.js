import { db } from "../script/firebase_conn.js";
import { ref, get, update, push, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let isProcessing = false;
let isCardValid = false;
let currentUserData = null;

// Elements
const cardInput = document.getElementById('card_number_return');
const returnAmountInput = document.getElementById('return_balance_input');
const submitBtn = document.querySelector('#returnMoneyForm button[type="submit"]');
const feedbackEl = document.getElementById('cardFeedback');
const successModal = document.getElementById('successModal');
const processingModal = document.getElementById('processingModal');
const modalMessage = document.getElementById('modalMessage');
const closeModalBtn = document.getElementById('closeModalBtn');

// ================= LOGOUT FUNCTIONALITY =================
function initializeLogoutModal() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmationModal');
    const closeLogoutModalBtn = document.getElementById('closeLogoutModalBtn');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (!logoutBtn || !logoutModal) {
        console.log('Logout elements not found');
        return;
    }

    console.log('Initializing logout modal...');

    // Remove any existing event listeners by cloning and replacing the button
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

    // Get fresh reference to the logout button
    const refreshedLogoutBtn = document.getElementById('logoutBtn');

    // Add click event listener to show modal
    refreshedLogoutBtn.addEventListener('click', function(e) {
        console.log('Logout button clicked - preventing default');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.log('Showing logout modal');
        logoutModal.classList.remove('hidden');
        logoutModal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
    });

    // Close modal when close button is clicked
    closeLogoutModalBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Close logout modal');
        logoutModal.classList.add('hidden');
        logoutModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
    });

    // Close modal when cancel button is clicked
    cancelLogoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Cancel logout');
        logoutModal.classList.add('hidden');
        logoutModal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
    });

    // Perform logout when confirm button is clicked
    confirmLogoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Confirming logout');
        
        // Show processing state
        const originalText = confirmLogoutBtn.innerHTML;
        confirmLogoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        confirmLogoutBtn.disabled = true;

        // Clear local storage
        localStorage.removeItem('cashierUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        sessionStorage.clear();

        console.log('Local storage cleared, redirecting...');
        
        // Redirect to login page after a brief delay to show the loading state
        setTimeout(() => {
            window.location.href = '/SMARTBITE-ADMIN/login.html';
        }, 500);
    });

    // Close modal when clicking outside
    logoutModal.addEventListener('click', function(e) {
        if (e.target === logoutModal) {
            console.log('Clicked outside modal - closing');
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

    console.log('Logout modal initialized successfully');
}

// ================= MODAL CONTROL FUNCTIONS =================
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
    
    modalMessage.innerHTML = message;
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        modalContent.style.transform = 'scale(1)';
        modalContent.style.opacity = '1';
    }, 10);
    
    document.getElementById('closeModalBtn').onclick = function() {
        modalContent.style.transform = 'scale(0.9)';
        modalContent.style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    };
}

// Close modal
closeModalBtn.addEventListener('click', () => {
    const modalContent = successModal.querySelector('.modal-content');
    modalContent.style.transform = 'scale(0.9)';
    modalContent.style.opacity = '0';
    setTimeout(() => successModal.classList.add('hidden'), 300);
});

// ================= CORE APPLICATION FUNCTIONS =================

// ------------------------
//  GLOBAL ERROR HANDLER
// ------------------------
window.addEventListener('error', (e) => {
    console.error("Unhandled error:", e.message);
    hideProcessingModal();
    showError('⚠️ Something went wrong. Please refresh the page.');
});

// Focus card input for RFID
function focusCardInput() {
    cardInput.focus();
    cardInput.select();
    cardInput.style.caretColor = 'transparent';
    cardInput.addEventListener('keydown', preventCharacterInput);
}

// Prevent non-numeric input
function preventCharacterInput(e) {
    if ([8,9,13,27,37,38,39,40,46].includes(e.keyCode) || (e.ctrlKey && [65,67,86,88].includes(e.keyCode))) return;
    if ((e.keyCode<48||e.keyCode>57)&&(e.keyCode<96||e.keyCode>105)) e.preventDefault();
}

// Reset display
function resetDisplay() {
    document.getElementById('current_balance').textContent = "0.00";
    document.getElementById('card_holder_name').textContent = "-";
    document.getElementById('lrn').textContent = "-";
    cardInput.classList.remove('border-green-500','border-red-500','animate-shake');
    returnAmountInput.classList.remove('border-red-500','animate-shake');
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('text-red-500','text-green-500');
    toggleAmountInput(false);
    currentUserData = null;
}

// Enable/disable return amount
function toggleAmountInput(enabled){
    if(enabled){
        returnAmountInput.disabled=false;
        submitBtn.disabled=false;
        returnAmountInput.classList.remove('bg-gray-100','cursor-not-allowed','text-gray-400');
        returnAmountInput.classList.add('bg-white');
        submitBtn.classList.remove('opacity-50','cursor-not-allowed');
    } else {
        returnAmountInput.disabled=true;
        submitBtn.disabled=true;
        returnAmountInput.value='';
        returnAmountInput.classList.remove('bg-white','border-green-500');
        returnAmountInput.classList.add('bg-gray-100','cursor-not-allowed','text-gray-400','border-gray-300');
        submitBtn.classList.add('opacity-50','cursor-not-allowed');
    }
}

// Show error
function showError(msg,field=null){
    feedbackEl.textContent=msg;
    feedbackEl.classList.add('text-red-500');
    feedbackEl.classList.remove('text-green-500');
    if(field==='card'){ 
        cardInput.classList.add('border-red-500','animate-shake'); 
        setTimeout(()=> cardInput.classList.remove('animate-shake'),500);
    }
    if(field==='amount'){ 
        returnAmountInput.classList.add('border-red-500','animate-shake'); 
        setTimeout(()=> returnAmountInput.classList.remove('animate-shake'),500);
    }
}

// Show success
function showSuccess(msg){
    feedbackEl.textContent=msg;
    feedbackEl.classList.add('text-green-500');
    feedbackEl.classList.remove('text-red-500');
}

// Validate card
function validateCardNumber(cardNumber){
    if(!/^\d{10}$/.test(cardNumber)){ 
        showError('Card must be exactly 10 digits','card'); 
        return false;
    }
    return true;
}

// ✅ Validate amount (with ₱5,000 limit and auto re-enable)
function validateReturnAmount(amount){
    if(!currentUserData){ 
        showError('Verify card first','amount'); 
        return false;
    }
    if(isNaN(amount)||amount<=0){ 
        showError('Enter valid amount','amount'); 
        return false;
    }

    // 💡 New rule: Do not allow return above ₱5,000
    if(amount > 5000){
        showError('⚠️ Maximum return limit is ₱5,000','amount');
        returnAmountInput.value = '5000';

        // Disable input and button
        returnAmountInput.disabled = true;
        returnAmountInput.classList.add('bg-gray-100','cursor-not-allowed','text-gray-400');
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50','cursor-not-allowed');

        // 🔁 Auto re-enable after 3 seconds
        setTimeout(() => {
            returnAmountInput.disabled = false;
            returnAmountInput.classList.remove('bg-gray-100','cursor-not-allowed','text-gray-400');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50','cursor-not-allowed');
            showError('','amount');
        }, 3000);

        return false;
    }

    const balance = parseFloat(currentUserData.balance ?? 0);
    if (isNaN(balance)) { 
        showError('⚠️ Invalid balance data for this user.', 'amount'); 
        return false; 
    }
    if(amount>balance){ 
        showError('Return amount exceeds balance','amount'); 
        return false;
    }
    return true;
}

// Safe Firebase get with retry
async function safeGet(refPath, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await get(ref(db, refPath));
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(res => setTimeout(res, 500));
        }
    }
}

// Fetch card data
async function fetchCurrentBalance(cardNumber){
    if(!validateCardNumber(cardNumber)) return;
    isProcessing=true;
    try{
        const snapshot = await safeGet('student_users');
        let found=false, isDisabled=false, userData=null;
        if(snapshot.exists()){
            snapshot.forEach(child=>{
                const data=child.val();
                if(data.id_number===cardNumber){
                    found=true;
                    isDisabled=data.disabled??false;
                    userData={...data,key:child.key};
                    document.getElementById('current_balance').textContent=parseFloat(data.balance??0).toFixed(2);
                    document.getElementById('card_holder_name').textContent=`${data.first_name??data.student_fname??''} ${data.middle_name??data.student_mname??''} ${data.last_name??data.student_lname??''}`.trim()||'-';
                    document.getElementById('lrn').textContent=data.lrn_number??'-';
                }
            });
        }

        if(!found){ 
            isCardValid=false; 
            currentUserData=null; 
            showError('❌ Card not found!','card'); 
            toggleAmountInput(false); 
            return;
        }
        if(isDisabled){ 
            isCardValid=false; 
            currentUserData=null; 
            showError('⚠️ Account disabled','card'); 
            toggleAmountInput(false); 
            return;
        }

        isCardValid=true;
        currentUserData=userData;
        showSuccess('✅ Card verified! You can return money.');
        toggleAmountInput(true);
    } catch(e){
        console.error(e);
        if (e.code === 'PERMISSION_DENIED') showError('⚠️ Access denied to student data.','card');
        else if (e.code === 'NETWORK_ERROR') showError('⚠️ Network error, please check your connection.','card');
        else showError('❌ Failed to fetch card info','card');
        toggleAmountInput(false);
    } finally{
        isProcessing=false;
    }
}

// ================= EVENT LISTENERS =================

// Input listeners
cardInput.addEventListener('input',()=>{ 
    cardInput.value=cardInput.value.replace(/\D/g,'').slice(0,10);
    if(cardInput.value.length===10) fetchCurrentBalance(cardInput.value);
    else resetDisplay();
});

returnAmountInput.addEventListener('input',()=>{
    if(!isCardValid) return;
    returnAmountInput.value=returnAmountInput.value.replace(/[^\d.]/g,'');
});

// Prevent double submission
submitBtn.addEventListener('click', (e) => {
    if (isProcessing) e.preventDefault();
});

// Submit handler
document.getElementById('returnMoneyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isProcessing || !currentUserData) return;

    const amount = parseFloat(returnAmountInput.value);
    if (!validateReturnAmount(amount)) return;

    isProcessing = true;
    cardInput.disabled = true;
    returnAmountInput.disabled = true;
    submitBtn.disabled = true;

    showProcessingModal();

    const startTime = Date.now();
    const minimumProcessingTime = 1500;

    try {
        const balance = parseFloat(currentUserData.balance);
        if (isNaN(balance)) throw new Error('Invalid balance format.');
        const newBalance = balance - amount;
        await update(ref(db, `student_users/${currentUserData.key}`), { balance: newBalance });
        await fetchCurrentBalance(currentUserData.id_number);

        try {
            const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
            if (cashierUser) {
                const logsRef = ref(db, "logs");
                const newLogRef = push(logsRef);
                const logData = {
                    action: "Withdraw Money",
                    user: `${cashierUser.first_name} ${cashierUser.last_name}`,
                    lrn_number: `${currentUserData.lrn_number}`,
                    message: `${cashierUser.first_name} ${cashierUser.last_name} returned ₱${amount.toFixed(2)} from card ${currentUserData.id_number} (${currentUserData.first_name ?? currentUserData.student_fname ?? ''} ${currentUserData.last_name ?? currentUserData.student_lname ?? ''})`,
                    timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
                };

                try {
                    await set(newLogRef, logData);
                } catch (logError) {
                    console.warn("Logging failed, saving locally.");
                    const offlineLogs = JSON.parse(localStorage.getItem('offlineLogs') || '[]');
                    offlineLogs.push(logData);
                    localStorage.setItem('offlineLogs', JSON.stringify(offlineLogs));
                }
            }
        } catch (logError) {
            console.error("Error logging transaction:", logError);
        }

        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(minimumProcessingTime - elapsedTime, 0);
        await new Promise(resolve => setTimeout(resolve, remainingTime));

        hideProcessingModal();

        const dateTimeNow = new Date().toLocaleString();
        const successMessage = `
        <div class="text-center">
          <h3 class="text-xl md:text-2xl font-semibold text-gray-900 mb-4">Money Returned Successfully!</h3>
          <div class="bg-gray-50 p-4 rounded-lg mb-4 text-left">
            <div class="grid grid-cols-2 gap-2 text-sm md:text-base">
              <div class="text-gray-600">Student Name:</div><div class="font-medium">${document.getElementById('card_holder_name').textContent}</div>
              <div class="text-gray-600">LRN:</div><div class="font-medium">${document.getElementById('lrn').textContent}</div>
              <div class="text-gray-600">Card Number:</div><div class="font-medium">${currentUserData.id_number}</div>
              <div class="text-gray-600">Amount Returned:</div><div class="font-medium text-red-600">₱${amount.toFixed(2)}</div>
              <div class="text-gray-600">Previous Balance:</div><div class="font-medium">₱${balance.toFixed(2)}</div>
              <div class="text-gray-600">New Balance:</div><div class="font-medium text-blue-600">₱${newBalance.toFixed(2)}</div>
              <div class="text-gray-600">Date/Time:</div><div class="font-medium">${dateTimeNow}</div>
            </div>
          </div>
          <p class="text-sm text-gray-600">The balance has been successfully deducted from the student's account.</p>
        </div>`;

        setTimeout(() => {
            showSuccessModal(successMessage);
        }, 300);

        e.target.reset();
        resetDisplay();

    } catch (error) {
        console.error("Error returning money:", error);
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(minimumProcessingTime - elapsedTime, 0);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
        hideProcessingModal();
        setTimeout(() => {
            showError('❌ Failed to return money');
        }, 300);
    } finally {
        cardInput.disabled = false;
        returnAmountInput.disabled = false;
        submitBtn.disabled = false;
        isProcessing = false;
    }
});

// ================= INITIALIZATION =================

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing return money application...');
    
    // Initialize logout modal first
    initializeLogoutModal();
    
    // Initialize main application
    focusCardInput();
    resetDisplay();
    
    console.log('Return money application initialized successfully');
});

// Also initialize if DOM is already loaded
if (document.readyState === 'complete') {
    initializeLogoutModal();
    focusCardInput();
    resetDisplay();
}