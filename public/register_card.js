import { db } from "firebase_conn.js";
import { ref, push, set, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

emailjs.init("qnR21gUxnxbWbz5Zs");

document.addEventListener("DOMContentLoaded", () => {
  // Debug: Check if Excel elements exist
  console.log("DOM loaded - checking Excel elements:");
  console.log("excelFile:", document.getElementById("excelFile"));
  console.log("uploadExcelBtn:", document.getElementById("uploadExcelBtn"));
  console.log("downloadTemplateBtn:", document.getElementById("downloadTemplateBtn"));
  console.log("excelUploadStatus:", document.getElementById("excelUploadStatus"));

  // Initialize logout functionality
  initializeLogout();

  // ================= Modal Functions =================
  function showModal(title, message, type = "error") {
    const backdrop = document.createElement("div");
    backdrop.id = "modalBackdrop";
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      padding: 30px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      text-align: center;
      animation: slideUp 0.3s ease-out;
      border: 1px solid rgba(255,255,255,0.2);
    `;

    const titleColor = type === "error" ? "#dc2626" : type === "success" ? "#16a34a" : "#d97706";
    const icon = type === "error" ? "❌" : type === "success" ? "✅" : "⚠️";
    
    modal.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 15px;">${icon}</div>
      <h2 style="margin-bottom: 20px; color: ${titleColor}; font-weight: bold; font-size: 24px;">${title}</h2>
      <div style="text-align: left; margin-bottom: 25px; color: #475569; line-height: 1.6;">${message}</div>
      <button id="closeModalBtn" 
        style="padding: 12px 32px; border: none; background: ${titleColor}; color: white; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.3s; box-shadow: 0 4px 12px ${titleColor}40;">
        OK
      </button>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    const closeBtn = document.getElementById("closeModalBtn");
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.transform = "translateY(-2px)";
      closeBtn.style.boxShadow = `0 6px 16px ${titleColor}60`;
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.transform = "translateY(0)";
      closeBtn.style.boxShadow = `0 4px 12px ${titleColor}40`;
    });
    closeBtn.addEventListener("click", () => {
      document.body.removeChild(backdrop);
    });

    // Add keyframe animations
    if (!document.getElementById("modalAnimations")) {
      const style = document.createElement("style");
      style.id = "modalAnimations";
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function showProcessingModal(message) {
    const backdrop = document.createElement("div");
    backdrop.id = "processingModal";
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.2);
    `;

    modal.innerHTML = `
      <div class="flex flex-col items-center justify-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-6"></div>
        <h3 style="margin-bottom: 12px; color: #1e40af; font-weight: bold; font-size: 20px;">Processing</h3>
        <p style="color: #64748b;">${message}</p>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    
    return backdrop;
  }

  function hideProcessingModal() {
    const modal = document.getElementById("processingModal");
    if (modal) {
      document.body.removeChild(modal);
    }
  }

  // ================= Helper Functions =================
  function showError(message, fieldIds = []) {
    const errDiv = document.getElementById("registerError");
    if (!errDiv) return;
    errDiv.innerHTML = message;
    errDiv.classList.remove("hidden");
    document.getElementById("registerSuccess")?.classList.add("hidden");

    const allFields = ["card_number_register","student_lrn","student_email","generate_password","birthdate_register","initial_balance","first_name_register","middle_name_register","last_name_register"];
    allFields.forEach(id => {
      const el = document.getElementById(id);
      const indicator = document.getElementById(`${id}_indicator`);
      if (!el) return;
      if (fieldIds.includes(id)) {
        el.classList.add("border-red-500");
        el.classList.remove("border-green-500");
        if (indicator) indicator.style.backgroundColor = "#ef4444";
      } else {
        el.classList.remove("border-red-500");
      }
    });
  }

  function showSuccess(message){
    const successDiv = document.getElementById("registerSuccess");
    if (!successDiv) return;
    successDiv.innerHTML = message;
    successDiv.classList.remove("hidden");
    document.getElementById("registerError")?.classList.add("hidden");

    const allFields = ["card_number_register","student_lrn","student_email","generate_password","birthdate_register","initial_balance","first_name_register","middle_name_register","last_name_register"];
    allFields.forEach(id => {
      const el = document.getElementById(id);
      const indicator = document.getElementById(`${id}_indicator`);
      if (!el) return;
      el.classList.remove("border-red-500");
      el.classList.add("border-green-500");
      if (indicator) indicator.style.backgroundColor = "#22c55e";
    });
  }

  // ================= Auto-capitalize names =================
  function capitalizeWords(str) {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // ================= Input Highlight with Visual Indicators =================
  const allFields = ["card_number_register","student_lrn","student_email","generate_password","birthdate_register","initial_balance","first_name_register","middle_name_register","last_name_register"];
  
  // Create visual indicators for each field
  allFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    // Create indicator dot
    const indicator = document.createElement("span");
    indicator.id = `${id}_indicator`;
    indicator.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #9ca3af;
      transition: all 0.3s ease;
      pointer-events: none;
      z-index: 10;
      box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.2);
    `;
    
    // Wrap input in relative container if not already
    if (el.parentElement.style.position !== "relative") {
      el.parentElement.style.position = "relative";
    }
    
    // Append indicator
    el.parentElement.appendChild(indicator);
  });

  // ================= Real-time Validation =================
  function validateField(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.log(`❌ validateField: Element ${id} not found`);
      return true;
    }
    
    const val = el.value.trim();
    let error = "";
    let isValid = true;

    console.log(`🔍 Validating ${id}: "${val}"`);

    switch(id){
      case "card_number_register":
        if(!val) {
          error = "Card number is required.";
          isValid = false;
        }
        break;
      case "student_lrn":
        if(!val) {
          error = "LRN is required.";
          isValid = false;
        } else if(!/^\d+$/.test(val)) {
          error = "LRN must contain only numbers.";
          isValid = false;
        } else if(val.length < 12) {
          error = "LRN must be at least 12 digits.";
          isValid = false;
        } else if(val.length > 12) {
          error = "LRN cannot exceed 12 digits.";
          isValid = false;
        }
        break;
      case "student_email":
        if(!val) {
          error = "Email is required.";
          isValid = false;
        } else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          error = "Invalid email format.";
          isValid = false;
        } else if(!val.toLowerCase().endsWith('.com')) {
          error = "Email must end with .com";
          isValid = false;
        }
        break;
      case "generate_password":
        if(!val) {
          error = "Password is required.";
          isValid = false;
        }
        break;
      case "birthdate_register":
        if(!val) {
          error = "Birthdate is required.";
          isValid = false;
        } else {
          let dob;
          if (val.includes('-')) {
            dob = new Date(val + "T00:00:00");
          } else if (val.includes('/')) {
            const parts = val.split('/');
            if (parts.length === 3) {
              dob = new Date(parts[2], parts[0] - 1, parts[1]);
            } else {
              dob = new Date(val);
            }
          } else {
            dob = new Date(val);
          }
          
          const today = new Date(); today.setHours(0,0,0,0);
          const minBirth = new Date(); minBirth.setFullYear(today.getFullYear()-10);
          
          if(isNaN(dob.getTime())) {
            error = "Invalid birthdate.";
            isValid = false;
          } else if(dob > today) {
            error = "Birthdate cannot be in the future.";
            isValid = false;
          } else if(dob > minBirth) {
            error = "Student must be at least 10 years old.";
            isValid = false;
          }
        }
        break;
      case "initial_balance":
        const balance = parseFloat(val) || 0;
        if(balance < 0) {
          error = "Balance cannot be negative.";
          isValid = false;
        } else if(balance > 250) {
          error = "Initial balance cannot exceed ₱250.";
          isValid = false;
        }
        break;
      case "first_name_register":
        if(!val) {
          error = "First name is required.";
          isValid = false;
        } else if(!/^[A-Za-z\s]+$/.test(val)) {
          error = "First name should contain only letters and spaces.";
          isValid = false;
        }
        break;
      case "middle_name_register":
        if(val && !/^[A-Za-z\s]*$/.test(val)) {
          error = "Middle name should contain only letters and spaces.";
          isValid = false;
        }
        break;
      case "last_name_register":
        if(!val) {
          error = "Last name is required.";
          isValid = false;
        } else if(!/^[A-Za-z\s]+$/.test(val)) {
          error = "Last name should contain only letters and spaces.";
          isValid = false;
        }
        break;
    }

    const indicator = document.getElementById(`${id}_indicator`);
    
    console.log(`🎯 ${id} validation result:`, { isValid, error, indicatorExists: !!indicator });

    if(!isValid){
      el.classList.add("border-red-500");
      el.classList.remove("border-green-500");
      if (indicator) {
        indicator.style.backgroundColor = "#ef4444";
        indicator.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.2)";
        console.log(`🔴 Setting ${id} indicator to RED`);
      }
      return false;
    } else {
      el.classList.remove("border-red-500");
      el.classList.add("border-green-500");
      if (indicator) {
        indicator.style.backgroundColor = "#22c55e";
        indicator.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.2)";
        console.log(`🟢 Setting ${id} indicator to GREEN`);
      }
      return true;
    }
  }

  // ================= CSS OVERRIDE FOR VISUAL INDICATORS =================
  const style = document.createElement('style');
  style.textContent = `
    [id$="_indicator"] {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    .border-red-500 {
      border-color: #ef4444 !important;
      border-width: 2px !important;
    }
    .border-green-500 {
      border-color: #22c55e !important;
      border-width: 2px !important;
    }
    input.border-red-500 {
      border-color: #ef4444 !important;
    }
    input.border-green-500 {
      border-color: #22c55e !important;
    }
    input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
  `;
  document.head.appendChild(style);

  // ================= Auto-generate Password on Card Scan =================
  function generatePassword() {
    const passwordField = document.getElementById("generate_password");
    const generateBtn = document.getElementById("generateBtn");
    if (!passwordField) return;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    passwordField.value = password;
    
    // Update password field indicator to green
    const passwordIndicator = document.getElementById("generate_password_indicator");
    if (passwordIndicator) {
      passwordIndicator.style.backgroundColor = "#22c55e";
      passwordIndicator.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.2)";
    }
    
    // Validate the password field
    validateField("generate_password");
    
    // Disable generate button after generation
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.style.opacity = "0.5";
      generateBtn.style.cursor = "not-allowed";
      generateBtn.textContent = "✓ Generated";
    }
    
    // Clear any error messages on successful generation
    document.getElementById("registerError")?.classList.add("hidden");
  }

  // ================= Async duplicate check =================
  async function asyncDuplicateCheck() {
    const cardEl = document.getElementById("card_number_register");
    const lrnEl = document.getElementById("student_lrn");
    const emailEl = document.getElementById("student_email");
    if (!cardEl || !lrnEl || !emailEl) return true;

    let allValid = true;

    try {
      const snapshot = await get(ref(db,"student_users"));
      const students = snapshot.val() || {};
      const card = cardEl.value.trim();
      const lrn = lrnEl.value.trim();
      const email = emailEl.value.trim();

      const cardIndicator = document.getElementById("card_number_register_indicator");
      const lrnIndicator = document.getElementById("student_lrn_indicator");
      const emailIndicator = document.getElementById("student_email_indicator");

      if(card && Object.values(students).some(s => s.id_number === card)){
        cardEl.classList.add("border-red-500");
        cardEl.classList.remove("border-green-500");
        if (cardIndicator) {
          cardIndicator.style.backgroundColor = "#ef4444";
          cardIndicator.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.2)";
        }
        allValid = false;
      } else if(card) {
        cardEl.classList.remove("border-red-500");
        cardEl.classList.add("border-green-500");
        if (cardIndicator) {
          cardIndicator.style.backgroundColor = "#22c55e";
          cardIndicator.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.2)";
        }
      }

      if(lrn && Object.values(students).some(s => s.lrn_number === lrn)){
        lrnEl.classList.add("border-red-500");
        lrnEl.classList.remove("border-green-500");
        if (lrnIndicator) {
          lrnIndicator.style.backgroundColor = "#ef4444";
          lrnIndicator.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.2)";
        }
        allValid = false;
      } else if(lrn) {
        lrnEl.classList.remove("border-red-500");
        lrnEl.classList.add("border-green-500");
        if (lrnIndicator) {
          lrnIndicator.style.backgroundColor = "#22c55e";
          lrnIndicator.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.2)";
        }
      }

      if(email && Object.values(students).some(s => s.email === email)){
        emailEl.classList.add("border-red-500");
        emailEl.classList.remove("border-green-500");
        if (emailIndicator) {
          emailIndicator.style.backgroundColor = "#ef4444";
          emailIndicator.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.2)";
        }
        allValid = false;
      } else if(email) {
        emailEl.classList.remove("border-red-500");
        emailEl.classList.add("border-green-500");
        if (emailIndicator) {
          emailIndicator.style.backgroundColor = "#22c55e";
          emailIndicator.style.boxShadow = "0 0 0 3px rgba(34, 197, 94, 0.2)";
        }
      }
    } catch(err){ console.error(err); }

    return allValid;
  }

  // ================= Field Event Listeners =================
  console.log("=== Setting up field event listeners ===");

  // Name fields with auto-capitalization
  ["first_name_register", "middle_name_register", "last_name_register"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", function() {
        const cursorPos = this.selectionStart;
        this.value = capitalizeWords(this.value);
        this.setSelectionRange(cursorPos, cursorPos);
        validateField(id);
      });
      
      el.addEventListener("blur", function() {
        this.value = capitalizeWords(this.value);
        validateField(id);
      });
    }
  });

  // LRN Field
  const lrnField = document.getElementById("student_lrn");
  if (lrnField) {
    console.log("✅ Setting up LRN field validation");
    
    lrnField.addEventListener("input", function() {
      validateField("student_lrn");
    });
    
    lrnField.addEventListener("blur", function() {
      validateField("student_lrn");
      asyncDuplicateCheck();
    });
  }

  // Email Field
  const emailField = document.getElementById("student_email");
  if (emailField) {
    console.log("✅ Setting up Email field validation");
    
    emailField.addEventListener("input", function() {
      validateField("student_email");
    });
    
    emailField.addEventListener("blur", function() {
      validateField("student_email");
      asyncDuplicateCheck();
    });
  }

  // Initial Balance Field - Strict 250 max
  const initialBalanceField = document.getElementById("initial_balance");
  if (initialBalanceField) {
    console.log("✅ Setting up Initial Balance field validation with 250 max");
    
    initialBalanceField.addEventListener("input", function() {
      let value = this.value.trim();
      const balance = parseFloat(value) || 0;
      
      if (balance > 250) {
        this.value = "250";
      }
      
      validateField("initial_balance");
    });
    
    initialBalanceField.addEventListener("blur", function() {
      const balance = parseFloat(this.value) || 0;
      
      if (balance > 250) {
        this.value = "250";
      }
      
      validateField("initial_balance");
    });
  }

  // Other fields
  const otherFields = allFields.filter(id => 
    !["student_lrn", "student_email", "initial_balance", "first_name_register", "middle_name_register", "last_name_register"].includes(id)
  );
  
  otherFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      console.log(`✅ Setting up validation for: ${id}`);
      
      el.addEventListener("input", function() {
        validateField(id);
      });
      
      el.addEventListener("blur", function() {
        validateField(id);
      });
    }
  });

  // Card number field - auto-generate password
  const cardNumberField = document.getElementById("card_number_register");
  if (cardNumberField) {
    cardNumberField.addEventListener("input", function() {
      const value = this.value.trim();
      if (value.length >= 8) {
        const passwordField = document.getElementById("generate_password");
        if (passwordField && !passwordField.value) {
          setTimeout(() => {
            generatePassword();
          }, 100);
        }
      }
      validateField("card_number_register");
    });
  }

  // Password field - re-enable generate button if cleared
  const passwordField = document.getElementById("generate_password");
  const generateBtn = document.getElementById("generateBtn");
  if (passwordField && generateBtn) {
    passwordField.addEventListener("input", function() {
      if (!this.value) {
        generateBtn.disabled = false;
        generateBtn.style.opacity = "1";
        generateBtn.style.cursor = "pointer";
        generateBtn.textContent = "Generate";
      }
      validateField("generate_password");
    });
  }

  function preventScanner(elId, allowDecimal=false, isLRN=false, isEmail=false, isBirthdate=false){
    const el = document.getElementById(elId);
    if (!el) return;

    el.addEventListener("paste", e => {
      e.preventDefault();
      if (isLRN) {
        showModal("Input Error", "Pasting is not allowed for LRN. Please enter manually.", "error");
      } else if (isEmail) {
        showModal("Input Error", "Pasting is not allowed for email. Please type the email manually.", "error");
      } else if (isBirthdate) {
        showModal("Input Error", "Pasting is not allowed for birthdate. Please use the date picker.", "error");
      } else if (allowDecimal) {
        showModal("Input Error", "Pasting is not allowed for balance. Please enter manually.", "error");
      } else {
        showModal("Input Error", "Pasting is not allowed for this field. Please enter manually.", "error");
      }
    });

    if (isLRN) {
      el.addEventListener("keydown", function(e) {
        const allowedKeys = [8, 9, 13, 16, 17, 18, 19, 20, 27, 33, 34, 35, 36, 37, 38, 39, 40, 45, 46, 144, 145];
        const isNumber = (e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105);
        
        if (!isNumber && allowedKeys.indexOf(e.keyCode) === -1) {
          e.preventDefault();
        }
      });
    }

    if (isEmail) {
      let lastInputTime = 0;
      el.addEventListener("keydown", function(e) {
        const currentTime = new Date().getTime();
        
        if (currentTime - lastInputTime < 50) {
          e.preventDefault();
          return;
        }
        lastInputTime = currentTime;
      });
    }

    if (isBirthdate) {
      el.addEventListener("keydown", function(e){
        const allowedKeys = [8, 9, 13, 27, 33, 34, 35, 36, 37, 38, 39, 40, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 189, 109];
        if (!allowedKeys.includes(e.keyCode)) {
          e.preventDefault();
        }
      });

      el.addEventListener("focus", function() {
        this.showPicker && this.showPicker();
      });
    }

    if (allowDecimal) {
      let lastInputTime = 0;
      
      el.addEventListener("keydown", function(e) {
        const currentTime = new Date().getTime();
        const allowedKeys = [8, 9, 13, 16, 17, 18, 19, 20, 27, 33, 34, 35, 36, 37, 38, 39, 40, 45, 46, 144, 145];
        const isNumber = (e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105);
        const isDecimal = e.keyCode === 190 || e.keyCode === 110;
        
        if (currentTime - lastInputTime < 100) {
          e.preventDefault();
          return;
        }
        
        if (!isNumber && !isDecimal && allowedKeys.indexOf(e.keyCode) === -1) {
          e.preventDefault();
          return;
        }
        
        lastInputTime = currentTime;
      });

      el.addEventListener("input", function(){
        const val = this.value.trim();
        const balance = parseFloat(val) || 0;
        
        if (balance > 250) {
          this.value = "250";
        }
      });
    }

    el.addEventListener("drop", function(e) {
      e.preventDefault();
    });

    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocapitalize", "off");
    el.setAttribute("spellcheck", "false");
  }

  preventScanner("birthdate_register", false, false, false, true);
  preventScanner("initial_balance", true, false, false, false);
  preventScanner("student_email", false, false, true, false);
  preventScanner("student_lrn", false, true, false, false);

  // Enhanced Birthdate Field
  const birthdateField = document.getElementById("birthdate_register");
  if (birthdateField) {
    birthdateField.addEventListener("input", function() {
      validateField("birthdate_register");
    });

    birthdateField.addEventListener("change", function() {
      const birthdate = this.value.trim();
      if (birthdate) {
        let dob;
        if (birthdate.includes('-')) {
          dob = new Date(birthdate + "T00:00:00");
        } else if (birthdate.includes('/')) {
          const parts = birthdate.split('/');
          if (parts.length === 3) {
            dob = new Date(parts[2], parts[0] - 1, parts[1]);
          } else {
            dob = new Date(birthdate);
          }
        } else {
          dob = new Date(birthdate);
        }
        
        const today = new Date(); today.setHours(0,0,0,0);
        const minBirth = new Date(); minBirth.setFullYear(today.getFullYear()-10);
        
        if (isNaN(dob.getTime()) || dob > today || dob > minBirth) {
          this.value = "";
        } else {
          validateField("birthdate_register");
        }
      }
    });

    birthdateField.addEventListener("click", function() {
      if (this.showPicker) {
        try {
          this.showPicker();
        } catch (err) {
          console.log("Native date picker not supported");
        }
      }
    });

    birthdateField.style.cursor = "pointer";
    birthdateField.title = "Click to open date picker";
  }

  // ================= Form Submit with Error Collection =================
  const form = document.getElementById("registerCardForm");
  if (form) {
    form.addEventListener("submit", async function(e){
      e.preventDefault();

      // First, validate all fields to update their indicators
      allFields.forEach(id => validateField(id));

      // Collect all errors from fields with red indicators
      const errors = [];
      const errorFields = [];
      const errorMessages = {
        card_number_register: "Card Number",
        student_lrn: "LRN (Learner Reference Number)",
        student_email: "Email Address",
        generate_password: "Password",
        birthdate_register: "Birthdate",
        initial_balance: "Initial Balance",
        first_name_register: "First Name",
        middle_name_register: "Middle Name",
        last_name_register: "Last Name"
      };

      // Check which fields have red indicators (validation errors)
      allFields.forEach(id => {
        const el = document.getElementById(id);
        const indicator = document.getElementById(`${id}_indicator`);
        
        if (el && indicator) {
          const isRed = window.getComputedStyle(indicator).backgroundColor === 'rgb(239, 68, 68)' || 
                        el.classList.contains('border-red-500');
          
          if (isRed) {
            errorFields.push(errorMessages[id] || id);
          }
        }
      });

      // Get actual values for detailed validation
      const card_number = document.getElementById("card_number_register").value.trim();
      const lrn_number = document.getElementById("student_lrn").value.trim();
      const email = document.getElementById("student_email").value.trim();
      const password = document.getElementById("generate_password").value.trim();
      const bod = document.getElementById("birthdate_register").value.trim();
      const initialBalance = parseFloat(document.getElementById("initial_balance").value) || 0;
      const firstName = document.getElementById("first_name_register").value.trim();
      const middleName = document.getElementById("middle_name_register").value.trim();
      const lastName = document.getElementById("last_name_register").value.trim();

      // Detailed validation with specific error messages
      if (!card_number) {
        errors.push("Card Number is required");
      }
      
      if (!lrn_number) {
        errors.push("LRN is required");
      } else if (!/^\d+$/.test(lrn_number)) {
        errors.push("LRN must contain only numbers");
      } else if (lrn_number.length !== 12) {
        errors.push("LRN must be exactly 12 digits");
      }
      
      if (!email) {
        errors.push("Email is required");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Email format is invalid");
      } else if (!email.toLowerCase().endsWith('.com')) {
        errors.push("Email must end with .com");
      }
      
      if (!password) {
        errors.push("Password is required");
      }
      
      if (!bod) {
        errors.push("Birthdate is required");
      } else {
        let birthDateObj;
        if (bod.includes('-')) {
          birthDateObj = new Date(bod + "T00:00:00");
        } else if (bod.includes('/')) {
          const parts = bod.split('/');
          if (parts.length === 3) {
            birthDateObj = new Date(parts[2], parts[0] - 1, parts[1]);
          } else {
            birthDateObj = new Date(bod);
          }
        } else {
          birthDateObj = new Date(bod);
        }
        
        const today = new Date(); today.setHours(0,0,0,0);
        const minBirth = new Date(); minBirth.setFullYear(today.getFullYear()-10);
        
        if (!birthDateObj || isNaN(birthDateObj.getTime())) {
          errors.push("Birthdate format is invalid");
        } else if (birthDateObj > today) {
          errors.push("Birthdate cannot be in the future");
        } else if (birthDateObj > minBirth) {
          errors.push("Student must be at least 10 years old");
        }
      }
      
      if (initialBalance > 250) {
        errors.push("Initial Balance cannot exceed ₱250.00");
      } else if (initialBalance < 0) {
        errors.push("Initial Balance cannot be negative");
      }
      
      if (!firstName) {
        errors.push("First Name is required");
      } else if (!/^[A-Za-z\s]+$/.test(firstName)) {
        errors.push("First Name should contain only letters and spaces");
      }
      
      if (middleName && !/^[A-Za-z\s]*$/.test(middleName)) {
        errors.push("Middle Name should contain only letters and spaces");
      }
      
      if (!lastName) {
        errors.push("Last Name is required");
      } else if (!/^[A-Za-z\s]+$/.test(lastName)) {
        errors.push("Last Name should contain only letters and spaces");
      }

      // Check for duplicates in database
      try {
        const snapshot = await get(ref(db,"student_users"));
        const students = snapshot.val() || {};
        
        if (card_number && Object.values(students).some(s => s.id_number === card_number)) {
          errors.push("Card Number is already registered in the system");
        }
        if (lrn_number && Object.values(students).some(s => s.lrn_number === lrn_number)) {
          errors.push("LRN is already registered in the system");
        }
        if (email && Object.values(students).some(s => s.email === email)) {
          errors.push("Email is already registered in the system");
        }
      } catch (err) {
        console.error("Database error during duplicate check:", err);
        errors.push("Database connection error - please try again");
      }

      // If there are ANY errors, show them in a comprehensive modal
      if (errors.length > 0 || errorFields.length > 0) {
        // Combine both error sources
        const allErrors = [...new Set([...errors])];
        
        // Create a detailed error list with icons
        const errorListHTML = allErrors.map((error, index) => {
          return `<div style="display: flex; align-items: flex-start; padding: 12px; background: ${index % 2 === 0 ? '#fef2f2' : '#ffffff'}; border-radius: 8px; margin-bottom: 8px;">
            <span style="color: #dc2626; font-size: 18px; margin-right: 12px; flex-shrink: 0;">•</span>
            <span style="color: #374151; flex: 1;">${error}</span>
          </div>`;
        }).join('');
        
        const errorCount = allErrors.length;
        const pluralText = errorCount === 1 ? 'error' : 'errors';
        
        showModal(
          "Validation Failed", 
          `<div style="margin-bottom: 20px;">
            <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <p style="color: #991b1b; font-weight: 600; font-size: 16px; margin: 0;">
                <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                Found ${errorCount} ${pluralText} in your form
              </p>
              <p style="color: #7f1d1d; font-size: 14px; margin: 8px 0 0 0;">
                Please correct the following issues before submitting:
              </p>
            </div>
            <div style="max-height: 400px; overflow-y: auto; padding: 4px;">
              ${errorListHTML}
            </div>
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 8px; margin-top: 20px;">
              <p style="color: #1e40af; font-size: 13px; margin: 0;">
                <i class="fas fa-info-circle" style="margin-right: 6px;"></i>
                <strong>Tip:</strong> Fields with red indicators need attention. Fix all red indicators before submitting.
              </p>
            </div>
          </div>`, 
          "error"
        );
        return;
      }

      // All validations passed - proceed with registration
      const processingModal = showProcessingModal("Registering student... Please wait.");

      try {
        // Send Email
        try { 
          await emailjs.send("service_61w4f68","template_kydwfrf",{ email, lrn_number, password });
        } catch (err) { 
          console.error("Email sending error:", err); 
          hideProcessingModal();
          showModal("Registration Error", "Failed to send email. Please try again.", "error");
          return; 
        }

        // Save student to database
        const newUserRef = push(ref(db,"student_users"));
        await set(newUserRef,{
          id_number: card_number, 
          lrn_number, 
          student_fname: firstName, 
          student_mname: middleName, 
          student_lname: lastName,
          bod,
          balance: initialBalance, 
          createdTime: new Date().toISOString(),
          password, 
          email, 
          remember_me: false
        });

        const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
        if (cashierUser) {
          const logsRef = ref(db, "logs");
          const newLogRef = push(logsRef);
          await set(newLogRef, {
            action: "Registered",
            user: `${cashierUser.first_name} ${cashierUser.last_name}`,
            message: `${cashierUser.first_name} ${cashierUser.last_name} registered a student: ${firstName} ${lastName}`,
            timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
          });
        }

        localStorage.setItem("userName", firstName + " " + lastName);
        
        hideProcessingModal();
        showModal("Success", `Student successfully registered!<br><br>📧 Password and LRN sent to:<br><strong>${email}</strong>`, "success");
        
        e.target.reset();
        
        // Reset all indicators to gray
        allFields.forEach(id => {
          const indicator = document.getElementById(`${id}_indicator`);
          if (indicator) {
            indicator.style.backgroundColor = "#9ca3af";
            indicator.style.boxShadow = "0 0 0 3px rgba(156, 163, 175, 0.2)";
          }
        });

        // Re-enable generate button
        if (generateBtn) {
          generateBtn.disabled = false;
          generateBtn.style.opacity = "1";
          generateBtn.style.cursor = "pointer";
          generateBtn.textContent = "Generate";
        }
        
        const loggedInUser = document.getElementById("loggedInUser");
        if(loggedInUser) loggedInUser.textContent = "Welcome, "+localStorage.getItem("userName");

      } catch (err) { 
        console.error("Database save error:", err); 
        hideProcessingModal();
        showModal("Registration Error", "Error saving student. Please try again.", "error");
      }
    });
  }

  // ================= Generate Password Button =================
  if (generateBtn) {
    generateBtn.addEventListener("click", function(e){
      e.preventDefault();
      generatePassword();
    });
  }

  // ================= Highlight current sidebar page =================
  const currentPage = window.location.pathname.split("/").pop();
  document.querySelectorAll("#sidebar a").forEach(link => {
    if(link.dataset.page === currentPage){
      link.classList.add("bg-slate-700", "text-white", "font-semibold", "rounded-lg", "pl-3");
    }
  });

  // ================= Excel Batch Upload - SINGLE INTEGRATED VERSION =================
  function initializeExcelUpload() {
    console.log("Initializing Excel upload functionality...");
    
    const excelFileInput = document.getElementById("excelFile");
    const uploadExcelBtn = document.getElementById("uploadExcelBtn");
    const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
    
    if (!uploadExcelBtn || !excelFileInput) {
      console.error("❌ Excel upload elements not found!");
      return;
    }

    // Enhanced formatBirthdate function
    function formatBirthdate(dateString) {
      if (dateString === undefined || dateString === null || dateString === '') return '';

      let dateStr = dateString.toString().trim();
      console.log(`Formatting birthdate: "${dateString}" -> "${dateStr}"`);

      // Handle Excel numeric serial dates
      if (!isNaN(dateStr) && Number(dateStr) > 20000 && Number(dateStr) < 60000) {
        console.log("Detected Excel serial date:", dateStr);
        const excelEpoch = new Date(1900, 0, 1);
        const serialDays = Number(dateStr) - 2;
        excelEpoch.setDate(excelEpoch.getDate() + serialDays);

        const month = String(excelEpoch.getMonth() + 1).padStart(2, '0');
        const day = String(excelEpoch.getDate()).padStart(2, '0');
        const year = excelEpoch.getFullYear();
        const result = `${month}/${day}/${year}`;
        console.log("Converted serial date to:", result);
        return result;
      }

      if (dateStr.includes(' ')) {
        dateStr = dateStr.split(' ')[0];
      }

      let date;

      try {
        if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          if (parts[0].length === 4) {
            date = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            date = new Date(parts[2], parts[0] - 1, parts[1]);
          }
        } else if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts[0].length === 4) {
            date = new Date(parts[0], parts[1] - 1, parts[2]);
          } else if (parts[2].length === 4) {
            date = new Date(parts[2], parts[0] - 1, parts[1]);
          } else {
            date = new Date(dateStr);
          }
        } else if (dateStr.length === 8 && !isNaN(dateStr)) {
          if (dateStr.substring(0, 2) > '12') {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            date = new Date(year, month - 1, day);
          } else {
            const month = dateStr.substring(0, 2);
            const day = dateStr.substring(2, 4);
            const year = dateStr.substring(4, 8);
            date = new Date(year, month - 1, day);
          }
        } else {
          date = new Date(dateStr);
        }

        if (isNaN(date.getTime())) {
          console.warn(`⚠️ Invalid date format: "${dateString}" -> "${dateStr}"`);
          return '';
        }

        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        const result = `${month}/${day}/${year}`;
        console.log(`Successfully formatted date: "${dateString}" -> "${result}"`);
        return result;
      } catch (error) {
        console.error(`Error formatting date "${dateString}":`, error);
        return '';
      }
    }

    function handleFileSelect(e) {
      const file = e.target.files[0];
      if (file) {
        console.log("File selected:", file.name, file.type, file.size);
        
        const uploadExcelBtn = document.getElementById("uploadExcelBtn");
        if (uploadExcelBtn) {
          uploadExcelBtn.disabled = false;
          uploadExcelBtn.textContent = `Upload ${file.name}`;
        }
      }
    }

    async function handleExcelUpload(e) {
      e.preventDefault();
      console.log("=== STARTING EXCEL UPLOAD ===");

      const file = excelFileInput.files[0];
      if (!file) {
        showModal("Upload Error", "Please select an Excel file first.", "error");
        return;
      }

      console.log("Processing file:", file.name, file.type, file.size);

      if (typeof XLSX === 'undefined') {
        showModal("Library Error", "Excel processing library not loaded. Please refresh the page.", "error");
        return;
      }

      const allowedTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel"
      ];
      const fileExt = file.name.split(".").pop().toLowerCase();
      
      if (!allowedTypes.includes(file.type) && !["xls","xlsx"].includes(fileExt)) {
        showModal("Upload Error", "Invalid file type. Please upload an Excel file (.xlsx or .xls).", "error");
        excelFileInput.value = "";
        return;
      }

      const processingModal = showProcessingModal("Processing Excel file... Please wait.");

      try {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            console.log("File read successfully, processing data...");
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            console.log(`Found ${jsonData.length} rows in Excel file`);
            console.log("First few rows:", jsonData.slice(0, 3));

            await processExcelData(jsonData);
            
          } catch (error) {
            console.error("Error processing Excel data:", error);
            hideProcessingModal();
            showModal("Processing Error", "Failed to process Excel file: " + error.message, "error");
          }
        };

        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          hideProcessingModal();
          showModal("File Error", "Error reading file. Please try again.", "error");
        };

        reader.readAsArrayBuffer(file);
        
      } catch (error) {
        console.error("Upload error:", error);
        hideProcessingModal();
        showModal("Upload Error", "Unexpected error during upload: " + error.message, "error");
      }
    }

    async function processExcelData(jsonData) {
      console.log("Processing Excel data...");
      
      try {
        const seenCardNumbers = new Set();
        const seenLrnNumbers = new Set();
        const seenEmails = new Set();
        const snapshot = await get(ref(db, "student_users"));
        const existingStudents = snapshot.val() || {};
        
        console.log(`Found ${Object.keys(existingStudents).length} existing students in database`);

        const skipped = [];
        const added = [];
        const validRows = [];

        // First pass: validate all rows
        for (const [index, row] of jsonData.entries()) {
          const rowNumber = index + 2;
          console.log(`Processing row ${rowNumber}:`, row);

          const card = String(row.card_number || row.id_number || "").trim();
          const lrn = String(row.student_lrn || row.lrn || row.lrn_number || "").trim();
          const email = String(row.student_email || row.email || "").trim();
          const firstName = capitalizeWords(String(row.first_name || row.fname || "").trim());
          const middleName = capitalizeWords(String(row.middle_name || row.mname || "").trim());
          const lastName = capitalizeWords(String(row.last_name || row.lname || "").trim());
          let birthdate = String(row.bod || row.birthdate || row.birth_date || "").trim();
          const initialBalance = parseFloat(row.initial_balance || row.balance || 0) || 0;

          let skipReason = "";

          // Basic validations
          if (initialBalance > 250) {
            skipReason = "Initial balance cannot exceed ₱250";
          } else if (!card) {
            skipReason = "Missing card number";
          } else if (!lrn) {
            skipReason = "Missing LRN";
          } else if (!/^\d+$/.test(lrn) || lrn.length !== 12) {
            skipReason = "LRN must be exactly 12 digits";
          } else if (!email) {
            skipReason = "Missing email";
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            skipReason = "Invalid email format";
          } else if (!email.toLowerCase().endsWith('.com')) {
            skipReason = "Email must end with .com";
          } else if (!firstName || !lastName) {
            skipReason = "Missing first name or last name";
          } else if (!birthdate) {
            skipReason = "Missing birthdate";
          }

          // Format and validate birthdate
          if (!skipReason && birthdate) {
            const formattedBirthdate = formatBirthdate(birthdate);
            if (formattedBirthdate) {
              birthdate = formattedBirthdate;
              const dateParts = birthdate.split('/');
              if (dateParts.length === 3) {
                const dob = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
                const today = new Date(); today.setHours(0,0,0,0);
                const minBirth = new Date(); minBirth.setFullYear(today.getFullYear()-10);
                
                if (isNaN(dob.getTime())) {
                  skipReason = "Invalid birthdate format";
                } else if (dob > today) {
                  skipReason = "Birthdate cannot be in the future";
                } else if (dob > minBirth) {
                  skipReason = "Student must be at least 10 years old";
                }
              } else {
                skipReason = "Invalid birthdate format";
              }
            } else {
              skipReason = "Invalid birthdate format";
            }
          }

          // Check for duplicates
          if (!skipReason) {
            if (seenCardNumbers.has(card)) {
              skipReason = `Duplicate card number in Excel: ${card}`;
            } else if (seenLrnNumbers.has(lrn)) {
              skipReason = `Duplicate LRN in Excel: ${lrn}`;
            } else if (seenEmails.has(email)) {
              skipReason = `Duplicate email in Excel: ${email}`;
            } else if (Object.values(existingStudents).some(s => s.id_number === card)) {
              skipReason = `Card number already exists in database: ${card}`;
            } else if (Object.values(existingStudents).some(s => s.lrn_number === lrn)) {
              skipReason = `LRN already exists in database: ${lrn}`;
            } else if (Object.values(existingStudents).some(s => s.email === email)) {
              skipReason = `Email already exists in database: ${email}`;
            }
          }

          if (skipReason) {
            console.log(`Skipping row ${rowNumber}: ${skipReason}`);
            skipped.push(`Row ${rowNumber}: ${skipReason}`);
          } else {
            seenCardNumbers.add(card);
            seenLrnNumbers.add(lrn);
            seenEmails.add(email);
            validRows.push({ 
              rowNumber,
              card, 
              lrn, 
              email, 
              firstName, 
              middleName, 
              lastName, 
              birthdate, 
              initialBalance,
              row
            });
            console.log(`✅ Row ${rowNumber} validated successfully`);
          }
        }

        console.log(`Validation complete: ${validRows.length} valid, ${skipped.length} skipped`);

        // Second pass: process valid rows
        let successfullyAdded = 0;
        let emailSuccessCount = 0;
        let emailFailCount = 0;

        for (const rowData of validRows) {
          const { card, lrn, email, firstName, middleName, lastName, birthdate, initialBalance, rowNumber, row } = rowData;

          try {
            // Generate password if not provided
            let password = row.generate_password && row.generate_password.trim() !== ""
              ? row.generate_password.trim()
              : (() => {
                  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
                  let pass = "";
                  for (let i = 0; i < 12; i++) {
                    pass += chars.charAt(Math.floor(Math.random() * chars.length));
                  }
                  return pass;
                })();

            // Save to database
            const newUserRef = push(ref(db, "student_users"));
            await set(newUserRef, {
              id_number: card,
              lrn_number: lrn,
              student_fname: firstName,
              student_mname: middleName,
              student_lname: lastName,
              password: password,
              email: email,
              bod: birthdate,
              balance: initialBalance,
              createdTime: new Date().toISOString(),
              remember_me: false
            });

            console.log(`✅ Saved student: ${firstName} ${lastName} (${card})`);

            // Send email
            try {
              await emailjs.send("service_61w4f68", "template_kydwfrf", { 
                email: email, 
                lrn_number: lrn, 
                password: password 
              });
              emailSuccessCount++;
              console.log(`✅ Email sent to: ${email}`);
            } catch (emailError) {
              emailFailCount++;
              console.error(`❌ Failed to send email to ${email}:`, emailError);
            }

            successfullyAdded++;
            added.push(`Row ${rowNumber}: ${firstName} ${lastName} (${card})`);

          } catch (error) {
            console.error(`❌ Error processing row ${rowNumber}:`, error);
            skipped.push(`Row ${rowNumber}: Database error - ${error.message}`);
          }
        }

        hideProcessingModal();
        showUploadResults(successfullyAdded, skipped, added, emailSuccessCount, emailFailCount);
        excelFileInput.value = "";

      } catch (error) {
        console.error("Error processing Excel data:", error);
        hideProcessingModal();
        showModal("Processing Error", "Failed to process Excel data: " + error.message, "error");
      }
    }

    function showUploadResults(successfullyAdded, skipped, added, emailSuccessCount, emailFailCount) {
      let resultMessage = '';

      if (successfullyAdded > 0) {
        resultMessage = `<div style="font-size: 18px; margin-bottom: 15px;">✅ Successfully added <strong>${successfullyAdded}</strong> student(s)!</div>`;
        
        if (emailSuccessCount > 0) {
          resultMessage += `<div style="color: #16a34a; margin: 8px 0;">📧 ${emailSuccessCount} email(s) sent successfully</div>`;
        }
        if (emailFailCount > 0) {
          resultMessage += `<div style="color: #d97706; margin: 8px 0;">⚠️ ${emailFailCount} email(s) failed to send</div>`;
        }
        if (skipped.length > 0) {
          resultMessage += `<div style="color: #64748b; margin: 8px 0;">⏭️ ${skipped.length} row(s) skipped</div>`;
        }
        
        if (added.length > 0) {
          const previewAdded = added.slice(0, 3).map(s => `<div style="padding: 4px 0;">• ${s}</div>`).join("");
          const moreAdded = added.length > 3 ? `<div style="padding: 4px 0; color: #64748b;">...and ${added.length - 3} more</div>` : "";
          resultMessage += `<div style="margin-top: 20px; text-align: left;"><strong>Added Students:</strong><div style="background: #f0fdf4; padding: 10px; border-radius: 6px; margin-top: 8px;">${previewAdded}${moreAdded}</div></div>`;
        }
        
        if (skipped.length > 0) {
          const previewSkipped = skipped.slice(0, 5).map(s => `<div style="padding: 4px 0;">• ${s}</div>`).join("");
          const moreSkipped = skipped.length > 5 ? `<div style="padding: 4px 0; color: #64748b;">...and ${skipped.length - 5} more</div>` : "";
          resultMessage += `<div style="margin-top: 20px; text-align: left;"><strong>Skipped Rows:</strong><div style="background: #fef2f2; padding: 10px; border-radius: 6px; margin-top: 8px; max-height: 200px; overflow-y: auto;">${previewSkipped}${moreSkipped}</div></div>`;
        }
        
        showModal("Excel Upload Complete", resultMessage, "success");
      } else if (skipped.length > 0) {
        const previewSkipped = skipped.slice(0, 10).map(s => `<div style="padding: 4px 0;">• ${s}</div>`).join("");
        const moreSkipped = skipped.length > 10 ? `<div style="padding: 4px 0;">...and ${skipped.length - 10} more</div>` : "";
        
        showModal("Excel Upload Results", 
          `⚠️ No students added. ${skipped.length} row(s) skipped:<div style="background: #fef2f2; padding: 10px; border-radius: 6px; margin-top: 10px; max-height: 300px; overflow-y: auto;">${previewSkipped}${moreSkipped}</div>`, 
          "warning");
      } else {
        showModal("Excel Upload Results", "❌ No valid data found in the Excel file.", "error");
      }
    }

    // Set up event listeners
    uploadExcelBtn.addEventListener("click", handleExcelUpload);
    excelFileInput.addEventListener("change", handleFileSelect);

    // Download template button
    if (downloadTemplateBtn) {
      downloadTemplateBtn.addEventListener("click", () => {
        const headers = [
          "card_number",
          "student_lrn",
          "first_name",
          "middle_name",
          "last_name",
          "student_email",
          "generate_password",
          "birthdate",
          "initial_balance"
        ];

        const exampleRow = [          
          "000000000001",
          "123456789012",
          "Juan",
          "Santos",
          "Dela Cruz",
          "juan@example.com",
          "",
          "2010-05-20",
          "250"
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
        ws["A2"].z = "@"; 
        ws["B2"].z = "@"; 

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "StudentUploadTemplate.xlsx");
      });
    }

    console.log("✅ Excel upload functionality initialized");
  }

  // Initialize Excel upload
  initializeExcelUpload();
});

// ================= Logout Function =================
function initializeLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutModal = document.getElementById("logoutConfirmationModal");
  const closeLogoutModalBtn = document.getElementById("closeLogoutModalBtn");
  const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
  const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

  if (!logoutBtn || !logoutModal) {
    console.log("Logout elements not found");
    return;
  }

  // Remove any existing event listeners to prevent conflicts
  const newLogoutBtn = logoutBtn.cloneNode(true);
  logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);

  // Get fresh references to all elements
  const refreshedLogoutBtn = document.getElementById("logoutBtn");
  const refreshedLogoutModal = document.getElementById("logoutConfirmationModal");
  const refreshedCloseBtn = document.getElementById("closeLogoutModalBtn");
  const refreshedCancelBtn = document.getElementById("cancelLogoutBtn");
  const refreshedConfirmBtn = document.getElementById("confirmLogoutBtn");

  // Show logout modal when logout button is clicked
  refreshedLogoutBtn.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Logout button clicked - showing modal');
    refreshedLogoutModal.classList.remove("hidden");
    refreshedLogoutModal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
  });

  // Close modal when close button is clicked
  refreshedCloseBtn.addEventListener("click", function() {
    console.log('Close logout modal');
    refreshedLogoutModal.classList.add("hidden");
    refreshedLogoutModal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  });

  // Close modal when cancel button is clicked
  refreshedCancelBtn.addEventListener("click", function() {
    console.log('Cancel logout');
    refreshedLogoutModal.classList.add("hidden");
    refreshedLogoutModal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  });

  // Perform logout when confirm button is clicked
  refreshedConfirmBtn.addEventListener("click", function() {
    console.log('Confirming logout');
    
    // Show processing state
    refreshedConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
    refreshedConfirmBtn.disabled = true;

    // Clear local storage
    localStorage.removeItem("cashierUser");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    sessionStorage.clear();

    // Sign out from Firebase
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        console.log("Firebase signout successful");
        // Redirect to login page
        window.location.href = "index.html";
      })
      .catch((error) => {
        console.error("Firebase logout failed:", error);
        // Still redirect even if Firebase signout fails
        window.location.href = "index.html";
      });
  });

  // Close modal when clicking outside
  refreshedLogoutModal.addEventListener("click", function(e) {
    if (e.target === refreshedLogoutModal) {
      console.log('Clicked outside modal - closing');
      refreshedLogoutModal.classList.add("hidden");
      refreshedLogoutModal.classList.remove("flex");
      document.body.classList.remove("overflow-hidden");
    }
  });

  // Prevent any form submission if logout button is inside a form
  const forms = document.querySelectorAll("form");
  forms.forEach(form => {
    form.addEventListener("submit", function(e) {
      if (e.submitter === refreshedLogoutBtn) {
        e.preventDefault();
      }
    });
  });
}

// Also initialize if script loads after DOM is already loaded
if (document.readyState === 'complete') {
  initializeLogout();

}
