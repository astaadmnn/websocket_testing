import { db } from "firebase_conn.js";
import { ref, push, set, get, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const form = document.getElementById("addCashierForm");
  const showUserListBtn = document.getElementById("showUserListBtn");
  const showStatsBtn = document.getElementById("showStatsBtn");
  const backToFormBtn = document.getElementById("backToFormBtn");
  const createFirstUserBtn = document.getElementById("createFirstUserBtn");
  const addCashierSection = document.getElementById("add_cashier_user");
  const userListSection = document.getElementById("user_list_section");
  const statsSection = document.getElementById("stats_section");
  const userTableBody = document.getElementById("userTableBody");
  const noUsersMessage = document.getElementById("noUsersMessage");
  const editUserModal = document.getElementById("editUserModal");
  const closeEditModal = document.getElementById("closeEditModal");
  const cancelEdit = document.getElementById("cancelEdit");
  const editUserForm = document.getElementById("editUserForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const userSearch = document.getElementById("userSearch");
  const roleFilterBtns = document.querySelectorAll('.role-filter-btn');
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  const pageNumbers = document.getElementById("pageNumbers");
  const paginationStart = document.getElementById("paginationStart");
  const paginationEnd = document.getElementById("paginationEnd");
  const paginationTotal = document.getElementById("paginationTotal");
  const userCountText = document.getElementById("userCountText");
  const totalUsers = document.getElementById("totalUsers");
  const cashierCount = document.getElementById("cashierCount");
  const itCount = document.getElementById("itCount");
  const accountantCount = document.getElementById("accountantCount");
  const togglePasswordResetBtn = document.getElementById("togglePasswordReset");
  const viewUserLogsBtn = document.getElementById("viewUserLogs");

  // Logout Modal Elements
  const logoutModal = document.getElementById('logoutConfirmationModal');
  const closeLogoutModalBtn = document.getElementById('closeLogoutModalBtn');
  const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

  // Create modals
  createModals();
  createDeleteModal();

  // Pagination variables
  let currentPage = 1;
  const usersPerPage = 5;
  let allUsers = [];
  let filteredUsers = [];
  let currentFilter = 'all';
  let currentSearch = '';

  // Debug function
  function debug(message, data = null) {
    console.log(`🔍 ${message}`, data || '');
  }

  // Form submission handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrorMessages();

    const first_name = document.getElementById("first_name").value.trim();
    const middle_name = document.getElementById("middle_name").value.trim();
    const last_name = document.getElementById("last_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm_password = document.getElementById("confirm_password").value;
    const role = document.getElementById("role").value;

    let isValid = true;

    if (!first_name) {
      setErrorMessage("first_name_error", 'First name is required');
      isValid = false;
    }

    if (!last_name) {
      setErrorMessage("last_name_error", 'Last name is required');
      isValid = false;
    }

    if (!email) {
      setErrorMessage("email_error", 'Email is required');
      isValid = false;
    } else if (!isValidEmail(email)) {
      setErrorMessage("email_error", 'Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setErrorMessage("password_error", 'Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setErrorMessage("password_error", 'Password must be at least 6 characters');
      isValid = false;
    }

    if (!confirm_password) {
      setErrorMessage("confirm_password_error", 'Please confirm your password');
      isValid = false;
    } else if (password !== confirm_password) {
      setErrorMessage("confirm_password_error", 'Passwords do not match');
      isValid = false;
    }

    if (!role) {
      setErrorMessage("role_error", 'Please select a role');
      isValid = false;
    }

    if (!isValid) return;

    try {
      showProcessingModal('Creating User Account');

      const usersRef = ref(db, "cashiers");
      const snapshot = await get(usersRef);
      let emailExists = false;
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const user = childSnapshot.val();
          if (user && user.email && user.email.toLowerCase() === email.toLowerCase()) {
            emailExists = true;
          }
        });
      }

      if (emailExists) {
        hideProcessingModal();
        setErrorMessage("email_error", 'Email already exists');
        return;
      }

      const newUserRef = push(ref(db, "cashiers"));
      await set(newUserRef, {
        id: newUserRef.key,
        first_name,
        middle_name,
        last_name,
        email,
        password,
        role,
        created_at: Date.now(),
        status: "active",
        updated_at: Date.now()
      });

      const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
      if (cashierUser) {
        const logsRef = push(ref(db, "logs"));
        await set(logsRef, {
          user: `${cashierUser.first_name} ${cashierUser.last_name}`,
          message: `${cashierUser.first_name} ${cashierUser.last_name} added new ${role}: ${first_name} ${last_name}`,
          timestamp: new Date().toISOString(),
          type: "user_created",
          target_user_id: newUserRef.key
        });
      }

      hideProcessingModal();
      showSuccessModal(`${first_name} ${last_name}`, role);
      form.reset();

    } catch (error) {
      console.error("Error adding user:", error);
      console.error("Error details:", error.message, error.stack);
      hideProcessingModal();
      showToast(`Error adding user: ${error.message}`, 'error');
    }
  });

  // Toggle between sections
  showUserListBtn.addEventListener('click', function() {
    addCashierSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    userListSection.classList.remove('hidden');
    loadUserList();
  });

  showStatsBtn.addEventListener('click', function() {
    addCashierSection.classList.add('hidden');
    userListSection.classList.add('hidden');
    statsSection.classList.remove('hidden');
    updateStats();
  });

  backToFormBtn.addEventListener('click', function() {
    userListSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    addCashierSection.classList.remove('hidden');
  });

  createFirstUserBtn.addEventListener('click', function() {
    userListSection.classList.add('hidden');
    addCashierSection.classList.remove('hidden');
  });

  // Modal controls
  closeEditModal.addEventListener('click', closeEditModalFunc);
  cancelEdit.addEventListener('click', closeEditModalFunc);

  // Search functionality
  userSearch.addEventListener('input', function() {
    currentSearch = this.value.toLowerCase();
    filterUsers();
  });

  // Role filter functionality
  roleFilterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      roleFilterBtns.forEach(b => b.classList.remove('active', 'border-blue-500', 'text-blue-600'));
      roleFilterBtns.forEach(b => b.classList.add('border-transparent', 'text-gray-500'));
      
      this.classList.add('active', 'border-blue-500', 'text-blue-600');
      this.classList.remove('border-transparent', 'text-gray-500');
      
      currentFilter = this.getAttribute('data-role');
      filterUsers();
    });
  });

  // Pagination controls
  prevPageBtn.addEventListener('click', function() {
    if (currentPage > 1) {
      currentPage--;
      renderUserTable();
    }
  });

  nextPageBtn.addEventListener('click', function() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderUserTable();
    }
  });

  // Password reset toggle
  if (togglePasswordResetBtn) {
    togglePasswordResetBtn.addEventListener('click', function() {
      const passwordSection = document.getElementById('passwordResetSection');
      const isHidden = passwordSection.classList.contains('hidden');
      
      if (isHidden) {
        passwordSection.classList.remove('hidden');
        this.innerHTML = '<i class="fas fa-times mr-1"></i>Cancel Reset';
      } else {
        resetPasswordSection();
        this.innerHTML = '<i class="fas fa-key mr-1"></i>Reset Password';
      }
    });
  }

  // View user logs button
  if (viewUserLogsBtn) {
    viewUserLogsBtn.addEventListener('click', function() {
      const userId = document.getElementById('edit_user_id').value;
      if (userId) {
        closeEditModalFunc();
        viewUserLogs(userId);
      }
    });
  }

  // Logout functionality with modal
  logoutBtn.addEventListener('click', function() {
    logoutModal.classList.remove('hidden');
  });

  // Close logout modal
  function closeLogoutModal() {
    logoutModal.classList.add('hidden');
  }

  closeLogoutModalBtn.addEventListener('click', closeLogoutModal);
  cancelLogoutBtn.addEventListener('click', closeLogoutModal);

  // Confirm logout
  confirmLogoutBtn.addEventListener('click', function() {
    localStorage.removeItem('cashierUser');
    window.location.href = '/login.html';
  });

  // Close modal when clicking outside
  logoutModal.addEventListener('click', function(e) {
    if (e.target === logoutModal) {
      closeLogoutModal();
    }
  });

  // FIXED: Enhanced edit form submission
  editUserForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    debug('=== EDIT FORM SUBMISSION STARTED ===');
    
    const userId = document.getElementById('edit_user_id').value;
    const firstName = document.getElementById('edit_first_name').value.trim();
    const lastName = document.getElementById('edit_last_name').value.trim();
    const middleName = document.getElementById('edit_middle_name').value.trim();
    const email = document.getElementById('edit_email').value.trim();
    const role = document.getElementById('edit_role').value;
    const status = document.getElementById('edit_status').value;
    const newPassword = document.getElementById('edit_password').value;
    const confirmPassword = document.getElementById('edit_confirm_password').value;

    debug('Form Values:', { userId, firstName, lastName, email, role, status });

    if (!userId) {
      showToast('User ID is missing', 'error');
      return;
    }

    if (!validateEditForm(firstName, lastName, email, role, newPassword, confirmPassword)) {
      debug('❌ Form validation failed');
      return;
    }

    try {
      showProcessingModal('Updating User Account');

      // Check email uniqueness
      const emailCheck = await isEmailChangedAndExists(userId, email);
      if (emailCheck) {
        hideProcessingModal();
        setErrorMessage('edit_email_error', 'Email already exists');
        debug('❌ Email already exists');
        return;
      }

      // Prepare update data
      const updateData = {
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        email: email,
        role: role,
        status: status,
        updated_at: Date.now()
      };

      if (newPassword) {
        updateData.password = newPassword;
        debug('🔑 Password will be updated');
      }

      debug('📦 Update data prepared:', updateData);

      // Firebase update
      const userRef = ref(db, `cashiers/${userId}`);
      debug('🔥 Firebase path:', `cashiers/${userId}`);
      
      await update(userRef, updateData);
      debug('✅ Firebase update successful');

      // Log action
      await logUserUpdate(userId, firstName, lastName, role, !!newPassword);
      debug('✅ Action logged');

      hideProcessingModal();
      showSuccessModal(`${firstName} ${lastName}`, role, 'updated');

      closeEditModalFunc();
      loadUserList(); // Refresh the user list
      debug('✅ User updated successfully');

    } catch (error) {
      console.error('❌ Error updating user:', error);
      hideProcessingModal();
      showToast(`Error updating user: ${error.message}`, 'error');
    }
  });

  // Helper functions
  function setErrorMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = message;
    }
  }

  function clearErrorMessages() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => {
      el.textContent = '';
    });
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Modal functions
  function createModals() {
    // Processing modal
    if (!document.getElementById('processingModal')) {
      const processingModal = document.createElement('div');
      processingModal.id = 'processingModal';
      processingModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
      processingModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 modal-scale p-8">
          <div class="text-center">
            <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i class="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2" id="processingTitle">Processing</h3>
            <p class="text-gray-600" id="processingMessage">Please wait...</p>
          </div>
        </div>
      `;
      document.body.appendChild(processingModal);
    }

    // Success modal
    if (!document.getElementById('successModal')) {
      const successModal = document.createElement('div');
      successModal.id = 'successModal';
      successModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
      successModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 modal-scale p-8">
          <div class="text-center">
            <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i class="fas fa-check text-3xl text-green-600"></i>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2" id="successTitle">Success!</h3>
            <p class="text-gray-600 mb-4" id="successMessage">Operation completed successfully.</p>
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div class="flex items-center justify-between">
                <div class="text-left">
                  <p class="font-semibold text-gray-900" id="successUserName"></p>
                  <p class="text-sm text-gray-600" id="successUserRole"></p>
                </div>
                <div class="bg-green-100 p-2 rounded-full">
                  <i class="fas fa-user-check text-green-600"></i>
                </div>
              </div>
            </div>
            <button id="closeSuccessModal" class="btn-primary w-full">
              <i class="fas fa-check mr-2"></i>Continue
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(successModal);
      document.getElementById('closeSuccessModal').addEventListener('click', hideSuccessModal);
    }
  }

  function createDeleteModal() {
    if (!document.getElementById('deleteUserModal')) {
      const deleteModal = document.createElement('div');
      deleteModal.id = 'deleteUserModal';
      deleteModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
      deleteModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 modal-scale p-8">
          <div class="text-center">
            <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i class="fas fa-exclamation-triangle text-3xl text-red-600"></i>
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Delete User Account</h3>
            <p class="text-gray-600 mb-4" id="deleteMessage">Are you sure you want to delete this user?</p>
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div class="text-left">
                <p class="font-semibold text-gray-900" id="deleteUserName"></p>
                <p class="text-sm text-gray-600" id="deleteUserEmail"></p>
              </div>
            </div>
            <div class="flex space-x-3">
              <button id="cancelDelete" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                Cancel
              </button>
              <button id="confirmDelete" class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                <i class="fas fa-trash mr-2"></i>Delete
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(deleteModal);
      document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);
    }
  }

  function showProcessingModal(action = 'Processing') {
    const modal = document.getElementById('processingModal');
    const title = document.getElementById('processingTitle');
    const message = document.getElementById('processingMessage');
    
    if (title) title.textContent = action;
    if (message) message.textContent = `Please wait while we ${action.toLowerCase()}...`;
    
    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.querySelector('.modal-scale').classList.add('show');
    }, 10);
  }

  function hideProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) {
      modal.querySelector('.modal-scale').classList.remove('show');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    }
  }

  function showSuccessModal(userName, role, action = 'created') {
    const modal = document.getElementById('successModal');
    const title = document.getElementById('successTitle');
    const message = document.getElementById('successMessage');
    const userNameElement = document.getElementById('successUserName');
    const userRoleElement = document.getElementById('successUserRole');

    if (title) title.textContent = action === 'created' ? 'User Created Successfully!' : 'User Updated Successfully!';
    if (message) message.textContent = action === 'created' 
      ? 'The user account has been created successfully.' 
      : 'The user account has been updated successfully.';
    if (userNameElement) userNameElement.textContent = userName;
    if (userRoleElement) userRoleElement.textContent = `${role.charAt(0).toUpperCase() + role.slice(1)} Account`;

    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.querySelector('.modal-scale').classList.add('show');
    }, 10);

    setTimeout(() => {
      hideSuccessModal();
    }, 3000);
  }

  function hideSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
      modal.querySelector('.modal-scale').classList.remove('show');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    }
  }

  function showDeleteModal(user) {
    const modal = document.getElementById('deleteUserModal');
    const userNameElement = document.getElementById('deleteUserName');
    const userEmailElement = document.getElementById('deleteUserEmail');
    
    if (userNameElement) userNameElement.textContent = `${user.first_name} ${user.last_name}`;
    if (userEmailElement) userEmailElement.textContent = user.email || 'No email';
    
    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.querySelector('.modal-scale').classList.add('show');
    }, 10);

    const confirmBtn = document.getElementById('confirmDelete');
    if (confirmBtn) {
      // Remove existing listeners
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
      
      // Add new listener
      document.getElementById('confirmDelete').addEventListener('click', () => {
        hideDeleteModal();
        deleteUser(user.id);
      });
    }
  }

  function hideDeleteModal() {
    const modal = document.getElementById('deleteUserModal');
    if (modal) {
      modal.querySelector('.modal-scale').classList.remove('show');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    }
  }

  // Load user list
  function loadUserList() {
    try {
      if (userTableBody) {
        userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading users...</td></tr>';
      }
      
      const usersRef = ref(db, "cashiers");
      
      onValue(usersRef, (snapshot) => {
        allUsers = [];
        
        if (!snapshot.exists()) {
          if (noUsersMessage) noUsersMessage.classList.remove('hidden');
          if (userTableBody) userTableBody.innerHTML = '';
          updateStats();
          return;
        }

        if (noUsersMessage) noUsersMessage.classList.add('hidden');
        
        snapshot.forEach((childSnapshot) => {
          const user = childSnapshot.val();
          user.id = childSnapshot.key;
          allUsers.push(user);
        });

        allUsers.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        
        filterUsers();
      }, (error) => {
        console.error("Error loading users:", error);
        if (userTableBody) {
          userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading users</td></tr>';
        }
      });

    } catch (error) {
      console.error("Error in loadUserList:", error);
      if (userTableBody) {
        userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading users</td></tr>';
      }
    }
  }

  function filterUsers() {
    filteredUsers = allUsers.filter(user => {
      if (currentFilter !== 'all' && user.role !== currentFilter) {
        return false;
      }
      
      if (currentSearch) {
        const searchStr = `${user.first_name || ''} ${user.last_name || ''} ${user.email || ''}`.toLowerCase();
        if (!searchStr.includes(currentSearch)) {
          return false;
        }
      }
      
      return true;
    });
    
    currentPage = 1;
    renderUserTable();
    updateStats();
  }

  // FIXED: Render user table with proper event delegation
  function renderUserTable() {
    if (!userTableBody) return;
    
    userTableBody.innerHTML = '';
    
    if (filteredUsers.length === 0) {
      if (noUsersMessage) noUsersMessage.classList.remove('hidden');
      if (userCountText) userCountText.textContent = 'No users found';
      return;
    }
    
    if (noUsersMessage) noUsersMessage.classList.add('hidden');
    
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = Math.min(startIndex + usersPerPage, filteredUsers.length);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    if (paginationStart) paginationStart.textContent = startIndex + 1;
    if (paginationEnd) paginationEnd.textContent = endIndex;
    if (paginationTotal) paginationTotal.textContent = filteredUsers.length;
    if (userCountText) userCountText.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredUsers.length} users`;
    
    paginatedUsers.forEach(user => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50 transition-colors';
      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span class="text-white font-medium">${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}</span>
            </div>
            <div class="ml-4">
              <div class="text-sm font-medium text-gray-900">${user.first_name} ${user.last_name}</div>
              <div class="text-sm text-gray-500">${user.email || 'No email'}</div>
              ${user.middle_name ? `<div class="text-sm text-gray-400">${user.middle_name}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="role-badge ${getRoleClass(user.role)}">
            <i class="${getRoleIcon(user.role)} mr-1"></i>
            ${user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Cashier'}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <button class="status-toggle inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            user.status === 'active' 
              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
              : 'bg-red-100 text-red-800 hover:bg-red-200'
          } transition-colors" data-id="${user.id}" data-status="${user.status || 'active'}">
            <i class="fas fa-circle ${
              user.status === 'active' ? 'text-green-500' : 'text-red-500'
            } mr-1" style="font-size: 6px;"></i>
            ${user.status === 'active' ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${formatUserTimestamp(user.created_at)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button class="text-blue-600 hover:text-blue-900 edit-user mr-3" data-id="${user.id}" title="Edit User">
            <i class="fas fa-edit"></i>
          </button>
          <button class="text-indigo-600 hover:text-indigo-900 view-logs mr-3" data-id="${user.id}" title="View Activity Logs">
            <i class="fas fa-history"></i>
          </button>
          <button class="text-red-600 hover:text-red-900 delete-user" data-id="${user.id}" title="Delete User">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      userTableBody.appendChild(row);
    });
    
    updatePagination();
    
    // FIXED: Use event delegation for table buttons
    setupTableEventDelegation();
  }

  // FIXED: Event delegation for table buttons - COMPLETELY REWRITTEN
  function setupTableEventDelegation() {
    // Remove any existing event listeners
    userTableBody.removeEventListener('click', handleTableClick);
    
    // Add new event listener
    userTableBody.addEventListener('click', handleTableClick);
  }

  function handleTableClick(e) {
    const target = e.target;
    
    // Handle edit buttons
    if (target.closest('.edit-user')) {
        const button = target.closest('.edit-user');
        const userId = button.getAttribute('data-id');
        console.log('🔄 Edit button clicked for user:', userId);
        if (userId) {
            openEditModal(userId);
        }
        return;
    }
    
    // Handle view logs buttons
    if (target.closest('.view-logs')) {
        const button = target.closest('.view-logs');
        const userId = button.getAttribute('data-id');
        console.log('📊 View logs clicked for user:', userId);
        if (userId) {
            viewUserLogs(userId);
        }
        return;
    }
    
    // Handle delete buttons
    if (target.closest('.delete-user')) {
        const button = target.closest('.delete-user');
        const userId = button.getAttribute('data-id');
        console.log('🗑️ Delete clicked for user:', userId);
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            showDeleteModal(user);
        }
        return;
    }
    
    // Handle status toggle buttons
    if (target.closest('.status-toggle')) {
        const button = target.closest('.status-toggle');
        const userId = button.getAttribute('data-id');
        const currentStatus = button.getAttribute('data-status');
        console.log('🔄 Status toggle clicked for user:', userId);
        if (userId) {
            toggleUserStatus(userId, currentStatus);
        }
        return;
    }
  }

  function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    if (pageNumbers) {
      pageNumbers.innerHTML = '';
      const maxPagesToShow = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      
      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `px-3 py-1 mx-1 rounded-md border ${
          i === currentPage 
            ? 'bg-blue-600 text-white border-blue-600' 
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        } transition-colors`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
          currentPage = i;
          renderUserTable();
        });
        pageNumbers.appendChild(pageBtn);
      }
    }
  }

  function updateStats() {
    const total = allUsers.length;
    const cashiers = allUsers.filter(user => user.role === 'cashier').length;
    const itStaff = allUsers.filter(user => user.role === 'it').length;
    const accountants = allUsers.filter(user => user.role === 'accountant').length;
    
    if (totalUsers) totalUsers.textContent = total;
    if (cashierCount) cashierCount.textContent = cashiers;
    if (itCount) itCount.textContent = itStaff;
    if (accountantCount) accountantCount.textContent = accountants;
  }

  function getRoleClass(role) {
    switch(role) {
      case 'super admin': return 'bg-purple-100 text-purple-800';
      case 'accountant': return 'bg-green-100 text-green-800';
      case 'it': return 'bg-blue-100 text-blue-800';
      case 'cashier': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getRoleIcon(role) {
    switch(role) {
      case 'super admin': return 'fas fa-crown';
      case 'accountant': return 'fas fa-calculator';
      case 'it': return 'fas fa-laptop-code';
      case 'cashier': return 'fas fa-cash-register';
      default: return 'fas fa-user';
    }
  }

  // FIXED: Open edit modal function - ENHANCED
  async function openEditModal(userId) {
    try {
      debug('🎯 OPEN EDIT MODAL - User ID:', userId);
      
      if (!userId || userId === 'null' || userId === 'undefined') {
        console.error('❌ Invalid user ID:', userId);
        showToast('Invalid user ID', 'error');
        return;
      }

      // Check if modal elements exist
      if (!editUserModal) {
        console.error('❌ Edit modal element not found');
        return;
      }

      debug('📡 Fetching user data from Firebase...');
      const userRef = ref(db, `cashiers/${userId}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        console.error('❌ User not found in database');
        showToast('User not found in database', 'error');
        return;
      }

      const user = snapshot.val();
      debug('✅ User data loaded:', user);
      
      // Populate form fields with validation
      const fields = {
        'edit_user_id': userId,
        'edit_first_name': user.first_name || '',
        'edit_last_name': user.last_name || '',
        'edit_middle_name': user.middle_name || '',
        'edit_email': user.email || '',
        'edit_role': user.role || 'cashier',
        'edit_status': user.status || 'active'
      };
      
      let allFieldsFound = true;
      Object.entries(fields).forEach(([fieldId, value]) => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.value = value;
          debug(`   ✅ Set ${fieldId}:`, value);
        } else {
          console.error(`   ❌ Field not found: ${fieldId}`);
          allFieldsFound = false;
        }
      });
      
      if (!allFieldsFound) {
        console.error('❌ Some form fields are missing');
      }

      // Update UI elements
      updateEditUserSummary(user);
      updateEditModalTimestamps(user);
      resetPasswordSection();
      clearEditFormErrors();
      
      // Show modal with animation
      editUserModal.classList.remove('hidden');
      setTimeout(() => {
        editUserModal.querySelector('.modal-scale')?.classList.add('show');
      }, 10);
      
      debug('✅ Edit modal should be visible now');
      
    } catch (error) {
      console.error('❌ Error in openEditModal:', error);
      showToast(`Error loading user: ${error.message}`, 'error');
    }
  }

  function updateEditUserSummary(user) {
    const summaryElement = document.getElementById('editUserSummary');
    const initialsElement = document.getElementById('editUserInitials');
    const nameElement = document.getElementById('editUserName');
    const roleElement = document.getElementById('editUserCurrentRole');
    
    if (!summaryElement || !initialsElement || !nameElement || !roleElement) {
      debug('Edit user summary elements not found');
      return;
    }
    
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const middleName = user.middle_name || '';
    
    initialsElement.textContent = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    
    let fullName = `${firstName} ${lastName}`;
    if (middleName) {
      fullName = `${firstName} ${middleName} ${lastName}`;
    }
    nameElement.textContent = fullName;
    
    const roleClass = getRoleClass(user.role);
    roleElement.innerHTML = `<span class="${roleClass} px-2 py-1 rounded-full text-xs">${user.role}</span>`;
    
    summaryElement.classList.remove('hidden');
  }

  function updateEditModalTimestamps(user) {
    const createdAtElement = document.getElementById('editUserCreatedAt');
    const updatedAtElement = document.getElementById('editUserTimestamp');
    
    if (createdAtElement) {
      createdAtElement.textContent = user.created_at 
        ? formatUserTimestamp(user.created_at)
        : 'N/A';
    }
    
    if (updatedAtElement) {
      updatedAtElement.textContent = user.updated_at 
        ? formatUserTimestamp(user.updated_at)
        : 'N/A';
    }
  }

  function resetPasswordSection() {
    const passwordSection = document.getElementById('passwordResetSection');
    const passwordInput = document.getElementById('edit_password');
    const confirmPasswordInput = document.getElementById('edit_confirm_password');
    const toggleBtn = document.getElementById('togglePasswordReset');
    
    if (passwordSection) passwordSection.classList.add('hidden');
    if (passwordInput) passwordInput.value = '';
    if (confirmPasswordInput) confirmPasswordInput.value = '';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-key mr-1"></i>Reset Password';
  }

  function clearEditFormErrors() {
    const errorElements = document.querySelectorAll('#editUserForm .error-message');
    errorElements.forEach(el => {
      el.textContent = '';
    });
  }

  function validateEditForm(firstName, lastName, email, role, newPassword, confirmPassword) {
    let isValid = true;
    clearEditFormErrors();

    if (!firstName) {
      setErrorMessage('edit_first_name_error', 'First name is required');
      isValid = false;
    }

    if (!lastName) {
      setErrorMessage('edit_last_name_error', 'Last name is required');
      isValid = false;
    }

    if (!email) {
      setErrorMessage('edit_email_error', 'Email is required');
      isValid = false;
    } else if (!isValidEmail(email)) {
      setErrorMessage('edit_email_error', 'Please enter a valid email address');
      isValid = false;
    }

    if (!role) {
      setErrorMessage('edit_role_error', 'Please select a role');
      isValid = false;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMessage('edit_password_error', 'Password must be at least 6 characters');
        isValid = false;
      }

      if (newPassword !== confirmPassword) {
        setErrorMessage('edit_confirm_password_error', 'Passwords do not match');
        isValid = false;
      }
    }

    return isValid;
  }

  async function isEmailChangedAndExists(userId, newEmail) {
    const usersRef = ref(db, "cashiers");
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
      let emailExists = false;
      
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        if (user && user.email && user.email.toLowerCase() === newEmail.toLowerCase() && childSnapshot.key !== userId) {
          emailExists = true;
        }
      });
      
      return emailExists;
    }
    
    return false;
  }

  async function logUserUpdate(userId, firstName, lastName, role, passwordChanged = false) {
    const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
    if (cashierUser) {
      const logsRef = push(ref(db, "logs"));
      const action = passwordChanged ? 'updated (with password reset)' : 'updated';
      
      await set(logsRef, {
        user: `${cashierUser.first_name} ${cashierUser.last_name}`,
        message: `${cashierUser.first_name} ${cashierUser.last_name} ${action} user: ${firstName} ${lastName} (${role})`,
        timestamp: new Date().toISOString(),
        type: "user_updated",
        target_user_id: userId
      });
    }
  }

  function closeEditModalFunc() {
    if (editUserModal) {
      editUserModal.querySelector('.modal-scale').classList.remove('show');
      setTimeout(() => {
        editUserModal.classList.add('hidden');
      }, 200);
    }
  }

  async function deleteUser(userId) {
    try {
      showProcessingModal('Deleting User');

      const userRef = ref(db, `cashiers/${userId}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        hideProcessingModal();
        showToast('User not found', 'error');
        return;
      }

      const user = snapshot.val();

      await remove(userRef);

      const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
      if (cashierUser) {
        const logsRef = push(ref(db, "logs"));
        await set(logsRef, {
          user: `${cashierUser.first_name} ${cashierUser.last_name}`,
          message: `${cashierUser.first_name} ${cashierUser.last_name} deleted user: ${user.first_name} ${user.last_name}`,
          timestamp: new Date().toISOString(),
          type: "user_deleted",
          target_user_id: userId
        });
      }

      hideProcessingModal();
      showToast(`User ${user.first_name} ${user.last_name} deleted successfully`, 'success');
      loadUserList(); // Refresh the list

    } catch (error) {
      console.error("Error deleting user:", error);
      hideProcessingModal();
      showToast('Error deleting user. Please try again.', 'error');
    }
  }

  async function toggleUserStatus(userId, currentStatus) {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      showProcessingModal('Updating User Status');

      const userRef = ref(db, `cashiers/${userId}`);
      await update(userRef, {
        status: newStatus,
        updated_at: Date.now()
      });

      const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
      if (cashierUser) {
        const userSnapshot = await get(userRef);
        const user = userSnapshot.val();
        
        const logsRef = push(ref(db, "logs"));
        await set(logsRef, {
          user: `${cashierUser.first_name} ${cashierUser.last_name}`,
          message: `${cashierUser.first_name} ${cashierUser.last_name} ${newStatus === 'active' ? 'activated' : 'deactivated'} user: ${user.first_name} ${user.last_name}`,
          timestamp: new Date().toISOString(),
          type: "user_status_changed",
          target_user_id: userId
        });
      }

      hideProcessingModal();
      showToast(`User status updated to ${newStatus}`, 'success');
      loadUserList(); // Refresh the list
      
    } catch (error) {
      console.error("Error updating user status:", error);
      hideProcessingModal();
      showToast('Error updating user status', 'error');
    }
  }

  async function viewUserLogs(userId) {
    try {
      debug('Loading logs for user:', userId);
      showProcessingModal('Loading Activity Logs');

      const userRef = ref(db, `cashiers/${userId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        hideProcessingModal();
        showToast('User not found', 'error');
        return;
      }

      const user = userSnapshot.val();
      debug('User found:', user);
      
      const logsRef = ref(db, "logs");
      const logsSnapshot = await get(logsRef);
      
      let userLogs = [];
      
      if (logsSnapshot.exists()) {
        logsSnapshot.forEach((childSnapshot) => {
          const log = childSnapshot.val();
          // Check if log is related to this user
          if (log.target_user_id === userId || 
              (log.message && user.email && log.message.toLowerCase().includes(user.email.toLowerCase()))) {
            userLogs.push({
              ...log,
              id: childSnapshot.key
            });
          }
        });
      }

      debug('Found logs:', userLogs.length);
      userLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      hideProcessingModal();
      showUserLogsModal(user, userLogs);
      
    } catch (error) {
      console.error("Error loading user logs:", error);
      hideProcessingModal();
      showToast('Error loading activity logs', 'error');
    }
  }

  function showUserLogsModal(user, logs) {
    let logsModal = document.getElementById('userLogsModal');
    
    if (!logsModal) {
      logsModal = document.createElement('div');
      logsModal.id = 'userLogsModal';
      logsModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
      logsModal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 modal-scale max-h-[90vh] flex flex-col">
          <div class="p-6 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-xl font-bold text-gray-900 flex items-center">
                  <i class="fas fa-history text-blue-500 mr-2"></i>
                  Activity Logs - <span id="logsUserName"></span>
                </h3>
                <p class="text-gray-600 text-sm mt-1">User activity and system actions</p>
              </div>
              <button id="closeLogsModal" class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>
          </div>
          
          <div class="flex-1 overflow-y-auto p-6">
            <div class="mb-4 flex justify-between items-center">
              <div class="flex items-center space-x-4">
                <div class="flex-shrink-0 h-12 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span class="text-white font-medium" id="logsUserInitials"></span>
                </div>
                <div>
                  <h4 class="font-semibold text-gray-900" id="logsUserFullName"></h4>
                  <p class="text-sm text-gray-600"><span id="logsUserEmail"></span> • <span id="logsUserRole"></span></p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-600">Total Activities: <span class="font-semibold" id="logsCount">0</span></p>
              </div>
            </div>
            
            <div id="logsList" class="space-y-3">
            </div>
            
            <div id="noLogsMessage" class="text-center py-8 hidden">
              <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-3"></i>
              <h4 class="text-lg font-medium text-gray-900 mb-2">No Activity Logs</h4>
              <p class="text-gray-500">No activity recorded for this user yet.</p>
            </div>
          </div>
          
          <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <button id="exportLogsBtn" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
              <i class="fas fa-download mr-2"></i>
              Export Logs
            </button>
            <button id="closeLogsModalBottom" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              <i class="fas fa-times mr-2"></i>
              Close
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(logsModal);
      
      document.getElementById('closeLogsModal').addEventListener('click', closeLogsModal);
      document.getElementById('closeLogsModalBottom').addEventListener('click', closeLogsModal);
    }
    
    document.getElementById('logsUserName').textContent = `${user.first_name} ${user.last_name}`;
    document.getElementById('logsUserInitials').textContent = `${user.first_name?.charAt(0)}${user.last_name?.charAt(0)}`;
    document.getElementById('logsUserFullName').textContent = `${user.first_name} ${user.last_name}`;
    document.getElementById('logsUserEmail').textContent = user.email || 'No email';
    document.getElementById('logsUserRole').innerHTML = `<span class="role-badge ${getRoleClass(user.role)}">${user.role}</span>`;
    document.getElementById('logsCount').textContent = logs.length;
    
    const logsList = document.getElementById('logsList');
    const noLogsMessage = document.getElementById('noLogsMessage');
    
    if (logs.length === 0) {
      logsList.classList.add('hidden');
      noLogsMessage.classList.remove('hidden');
    } else {
      logsList.classList.remove('hidden');
      noLogsMessage.classList.add('hidden');
      
      logsList.innerHTML = logs.map(log => `
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-white transition-colors">
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center space-x-2">
              <i class="fas ${getLogIcon(log.type)} ${getLogColor(log.type)}"></i>
              <span class="font-medium text-gray-900">${log.user || 'System'}</span>
            </div>
            <span class="text-sm text-gray-500">${formatLogTimestamp(log.timestamp)}</span>
          </div>
          <p class="text-gray-700">${log.message}</p>
          <div class="flex justify-between items-center mt-2">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLogTypeClass(log.type)}">
              ${log.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <span class="text-xs text-gray-400">ID: ${log.id?.substring(0, 8) || 'N/A'}...</span>
          </div>
        </div>
      `).join('');
    }
    
    const exportBtn = document.getElementById('exportLogsBtn');
    exportBtn.onclick = () => exportUserLogs(user, logs);
    
    logsModal.classList.remove('hidden');
    setTimeout(() => {
      logsModal.querySelector('.modal-scale').classList.add('show');
    }, 10);
  }

  function closeLogsModal() {
    const logsModal = document.getElementById('userLogsModal');
    if (logsModal) {
      logsModal.querySelector('.modal-scale').classList.remove('show');
      setTimeout(() => {
        logsModal.classList.add('hidden');
      }, 200);
    }
  }

  function exportUserLogs(user, logs) {
    const csvContent = [
      ['Timestamp', 'User', 'Message', 'Type'],
      ...logs.map(log => [
        new Date(log.timestamp).toLocaleString('en-PH'),
        log.user || 'System',
        log.message,
        log.type
      ])
    ];
    
    const csvString = csvContent.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${user.first_name}_${user.last_name}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Logs exported successfully', 'success');
  }

  function getLogIcon(type) {
    switch(type) {
      case 'user_created': return 'fa-user-plus';
      case 'user_updated': return 'fa-user-edit';
      case 'user_deleted': return 'fa-user-times';
      case 'user_status_changed': return 'fa-toggle-on';
      default: return 'fa-info-circle';
    }
  }

  function getLogColor(type) {
    switch(type) {
      case 'user_created': return 'text-green-500';
      case 'user_updated': return 'text-blue-500';
      case 'user_deleted': return 'text-red-500';
      case 'user_status_changed': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  }

  function getLogTypeClass(type) {
    switch(type) {
      case 'user_created': return 'bg-green-100 text-green-800';
      case 'user_updated': return 'bg-blue-100 text-blue-800';
      case 'user_deleted': return 'bg-red-100 text-red-800';
      case 'user_status_changed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function formatLogTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatUserTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  function showToast(message, type = 'success') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    });

    const toast = document.createElement('div');
    toast.className = `toast fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${
      type === 'success' ? 'bg-green-500 text-white' : 
      type === 'error' ? 'bg-red-500 text-white' : 
      'bg-yellow-500 text-white'
    }`;
    toast.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
      toast.classList.add('translate-x-0');
    }, 10);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.classList.remove('translate-x-0');
        toast.classList.add('translate-x-full');
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }
    }, 3000);
  }

  function initializePage() {
    const currentPageName = window.location.pathname.split('/').pop();
    document.querySelectorAll('.menu-item').forEach(item => {
      if (item.getAttribute('data-page') === currentPageName) {
        item.classList.add('active');
      }
    });

    const cashierUser = JSON.parse(localStorage.getItem("cashierUser"));
    if (!cashierUser) {
      window.location.href = '/login.html';
      return;
    }

    const allowedRoles = ['super admin', 'it'];
    if (!allowedRoles.includes(cashierUser.role)) {
      showToast('You do not have permission to access this page.', 'error');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 2000);
      return;
    }

    updateStats();
  }

  // Add global click listener for debugging
  document.addEventListener('click', function(e) {
    if (e.target.closest('.edit-user')) {
        console.log('🎯 GLOBAL CLICK - Edit button detected');
    }
  }, true);

  // Initialize the application
  initializePage();

  // Make functions available for testing
  window.debugUserSystem = {
    testEdit: () => {
      if (allUsers.length > 0) {
        openEditModal(allUsers[0].id);
      } else {
        console.log('No users available to test');
      }
    },
    loadUserList,
    allUsers: () => allUsers,
    filteredUsers: () => filteredUsers
  };
});
