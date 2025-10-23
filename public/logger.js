import { db } from "../script/firebase_conn.js";
import { ref as dbRef, onValue, remove } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// State management
let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
let itemsPerPage = 25;

// DOM Elements
const logsTableBody = document.getElementById("logsTableBody");
const searchInput = document.getElementById("searchInput");
const dateFilter = document.getElementById("dateFilter");
const actionFilter = document.getElementById("actionFilter");
const itemsPerPageSelect = document.getElementById("itemsPerPage");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const firstPageBtn = document.getElementById("firstPageBtn");
const lastPageBtn = document.getElementById("lastPageBtn");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");

// ==================== FIREBASE LISTENER ====================
const logsRef = dbRef(db, "logs");
onValue(logsRef, (snapshot) => {
  allLogs = [];
  
  if (snapshot.exists()) {
    snapshot.forEach((childSnap) => {
      const log = childSnap.val();
      const message = log.message || "No message";
      
      allLogs.push({
        id: childSnap.key,
        message: message,
        timestamp: log.timestamp || Date.now(),
        user: log.user || "System",
        action: log.action || detectActionFromMessage(message),
        ...log
      });
    });
  }

  // Sort logs by timestamp (newest first)
  allLogs.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
  
  console.log('📥 Loaded logs:', allLogs.length);
  
  // Update statistics
  updateStatistics();
  
  // Apply filters and render
  applyFilters();
});

// ==================== ACTION DETECTION ====================
function detectActionFromMessage(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('login') || msg.includes('logged in')) return 'login';
  if (msg.includes('logout') || msg.includes('logged out')) return 'logout';
  if (msg.includes('register') || msg.includes('registration')) return 'register';
  if (msg.includes('load') || msg.includes('loaded') || msg.includes('loading')) return 'load';
  if (msg.includes('withdraw') || msg.includes('withdrawal')) return 'withdraw';
  if (msg.includes('purchase') || msg.includes('bought') || msg.includes('buy')) return 'purchase';
  if (msg.includes('delete') || msg.includes('deleted') || msg.includes('removed')) return 'delete';
  if (msg.includes('update') || msg.includes('updated') || msg.includes('modified')) return 'update';
  if (msg.includes('add') || msg.includes('added') || msg.includes('create')) return 'add';
  if (msg.includes('view') || msg.includes('viewed')) return 'view';
  if (msg.includes('search') || msg.includes('searched')) return 'search';
  if (msg.includes('export') || msg.includes('exported')) return 'export';
  if (msg.includes('import') || msg.includes('imported')) return 'import';
  
  return 'other';
}

// ==================== STATISTICS ====================
function updateStatistics() {
  const totalLogsEl = document.getElementById("totalLogs");
  const todayLogsEl = document.getElementById("todayLogs");
  const activeUsersEl = document.getElementById("activeUsers");
  
  totalLogsEl.textContent = allLogs.length.toLocaleString();
  
  // Calculate today's logs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = allLogs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= today;
  }).length;
  todayLogsEl.textContent = todayCount.toLocaleString();
  
  // Calculate unique users
  const uniqueUsers = new Set(allLogs.map(log => log.user));
  activeUsersEl.textContent = uniqueUsers.size.toLocaleString();
}

// ==================== FILTERING ====================
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedDate = dateFilter.value;
  const selectedAction = actionFilter.value;
  
  console.log('🔍 Applying filters:', {
    searchTerm,
    selectedDate,
    selectedAction,
    totalLogs: allLogs.length
  });
  
  filteredLogs = allLogs.filter(log => {
    // Search filter
    const matchesSearch = !searchTerm || 
      log.message.toLowerCase().includes(searchTerm) ||
      log.user.toLowerCase().includes(searchTerm) ||
      (log.action && log.action.toLowerCase().includes(searchTerm));
    
    // Date filter
    let matchesDate = true;
    if (selectedDate) {
      const logDate = new Date(log.timestamp);
      const filterDate = new Date(selectedDate);
      
      matchesDate = 
        logDate.getFullYear() === filterDate.getFullYear() &&
        logDate.getMonth() === filterDate.getMonth() &&
        logDate.getDate() === filterDate.getDate();
    }
    
    // Action filter
    let matchesAction = true;
    if (selectedAction !== 'all') {
      matchesAction = 
        (log.action && log.action.toLowerCase() === selectedAction) ||
        log.message.toLowerCase().includes(selectedAction);
    }
    
    return matchesSearch && matchesDate && matchesAction;
  });
  
  console.log('✅ Filtered logs:', filteredLogs.length);
  
  // Update filtered count
  document.getElementById("filteredLogs").textContent = filteredLogs.length.toLocaleString();
  
  // Update active filters display
  updateActiveFilters();
  
  // Reset to first page when filters change
  currentPage = 1;
  renderLogs();
}

// ==================== ACTIVE FILTERS DISPLAY ====================
function updateActiveFilters() {
  const activeFiltersContainer = document.getElementById("activeFilters");
  const filters = [];
  
  if (searchInput.value) {
    filters.push({
      label: `Search: "${searchInput.value}"`,
      clear: () => { searchInput.value = ''; applyFilters(); }
    });
  }
  
  if (dateFilter.value) {
    filters.push({
      label: `Date: ${new Date(dateFilter.value).toLocaleDateString()}`,
      clear: () => { dateFilter.value = ''; applyFilters(); }
    });
  }
  
  if (actionFilter.value !== 'all') {
    filters.push({
      label: `Action: ${actionFilter.value.charAt(0).toUpperCase() + actionFilter.value.slice(1)}`,
      clear: () => { actionFilter.value = 'all'; applyFilters(); }
    });
  }
  
  if (filters.length === 0) {
    activeFiltersContainer.innerHTML = '<span class="text-gray-500 text-sm">No active filters</span>';
    return;
  }
  
  activeFiltersContainer.innerHTML = `
    <span class="text-sm text-gray-600 mr-2">Active filters:</span>
    ${filters.map((filter, index) => `
      <span class="filter-badge inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-semibold">
        ${filter.label}
        <button onclick="window.clearFilter(${index})" class="hover:text-blue-900 transition-colors">
          <i class="fas fa-times text-xs"></i>
        </button>
      </span>
    `).join('')}
  `;
  
  // Store filter clear functions globally
  window.activeFilterClearFunctions = filters.map(f => f.clear);
}

window.clearFilter = (index) => {
  if (window.activeFilterClearFunctions && window.activeFilterClearFunctions[index]) {
    window.activeFilterClearFunctions[index]();
  }
};

// ==================== RENDER LOGS ====================
function renderLogs() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
  
  // Update showing info
  const showingStart = filteredLogs.length === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(endIndex, filteredLogs.length);
  document.getElementById("showingStart").textContent = showingStart.toLocaleString();
  document.getElementById("showingEnd").textContent = showingEnd.toLocaleString();
  document.getElementById("totalEntries").textContent = filteredLogs.length.toLocaleString();
  
  if (paginatedLogs.length === 0) {
    logsTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-12 text-gray-500">
          <i class="fas fa-inbox text-4xl mb-3 text-gray-300"></i>
          <p class="text-lg font-semibold">No logs found</p>
          <p class="text-sm mt-2">Try adjusting your filters or search terms</p>
          ${allLogs.length === 0 ? 
            '<p class="text-xs mt-1 text-orange-500">No logs available in the system</p>' : 
            '<p class="text-xs mt-1 text-blue-500">No logs match your current filters</p>'
          }
        </td>
      </tr>
    `;
    updatePagination();
    return;
  }
  
  logsTableBody.innerHTML = paginatedLogs.map((log, index) => {
    const actualIndex = startIndex + index + 1;
    const icon = getLogIcon(log.message, log.action);
    const color = getLogColor(log.message, log.action);
    const formattedTime = formatTimestamp(log.timestamp);
    const userInitial = log.user.charAt(0).toUpperCase();
    
    return `
      <tr class="log-row border-b border-gray-100 hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
        <td class="px-6 py-4 text-sm font-semibold text-gray-700">
          ${actualIndex.toLocaleString()}
        </td>
        <td class="px-6 py-4 text-sm text-gray-600">
          <div class="flex items-center gap-2">
            <i class="fas fa-clock text-gray-400"></i>
            <span class="font-mono">${formattedTime}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              ${userInitial}
            </div>
            <div>
              <span class="font-semibold text-gray-700 block">${log.user}</span>
              ${log.action && log.action !== 'other' ? `
                <span class="text-xs text-gray-500 capitalize">${log.action}</span>
              ` : ''}
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-sm">
          <div class="flex items-center gap-3">
            <span class="log-icon flex-shrink-0 w-10 h-10 rounded-lg ${color} flex items-center justify-center shadow-sm">
              <i class="${icon} text-white text-sm"></i>
            </span>
            <div class="flex-1 min-w-0">
              <span class="text-gray-700 break-words">${log.message}</span>
              ${log.id ? `
                <div class="text-xs text-gray-400 mt-1 font-mono">ID: ${log.id}</div>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  updatePagination();
}

// ==================== LOG HELPERS ====================
function getLogIcon(message, action) {
  const msg = message.toLowerCase();
  const act = action ? action.toLowerCase() : '';
  
  if (act === 'login' || msg.includes('login')) return 'fas fa-sign-in-alt';
  if (act === 'logout' || msg.includes('logout')) return 'fas fa-sign-out-alt';
  if (act === 'register' || msg.includes('register')) return 'fas fa-user-plus';
  if (act === 'load' || msg.includes('load')) return 'fas fa-wallet';
  if (act === 'withdraw' || msg.includes('withdraw')) return 'fas fa-money-bill-wave';
  if (act === 'purchase' || msg.includes('purchase') || msg.includes('bought')) return 'fas fa-shopping-cart';
  if (act === 'delete' || msg.includes('delete')) return 'fas fa-trash';
  if (act === 'update' || msg.includes('update')) return 'fas fa-edit';
  if (act === 'add' || msg.includes('add')) return 'fas fa-plus-circle';
  if (act === 'view' || msg.includes('view')) return 'fas fa-eye';
  if (act === 'search' || msg.includes('search')) return 'fas fa-search';
  if (act === 'export' || msg.includes('export')) return 'fas fa-download';
  if (act === 'import' || msg.includes('import')) return 'fas fa-upload';
  if (act === 'error' || msg.includes('error') || msg.includes('failed')) return 'fas fa-exclamation-triangle';
  if (act === 'success' || msg.includes('success')) return 'fas fa-check-circle';
  
  return 'fas fa-info-circle';
}

function getLogColor(message, action) {
  const msg = message.toLowerCase();
  const act = action ? action.toLowerCase() : '';
  
  if (act === 'login' || msg.includes('login')) return 'bg-gradient-to-br from-green-400 to-green-600';
  if (act === 'logout' || msg.includes('logout')) return 'bg-gradient-to-br from-red-400 to-red-600';
  if (act === 'register' || msg.includes('register')) return 'bg-gradient-to-br from-blue-400 to-blue-600';
  if (act === 'load' || msg.includes('load')) return 'bg-gradient-to-br from-emerald-400 to-emerald-600';
  if (act === 'withdraw' || msg.includes('withdraw')) return 'bg-gradient-to-br from-orange-400 to-orange-600';
  if (act === 'purchase' || msg.includes('purchase') || msg.includes('bought')) return 'bg-gradient-to-br from-purple-400 to-purple-600';
  if (act === 'delete' || msg.includes('delete')) return 'bg-gradient-to-br from-pink-400 to-pink-600';
  if (act === 'update' || msg.includes('update')) return 'bg-gradient-to-br from-yellow-400 to-yellow-600';
  if (act === 'add' || msg.includes('add')) return 'bg-gradient-to-br from-teal-400 to-teal-600';
  if (act === 'view' || msg.includes('view')) return 'bg-gradient-to-br from-indigo-400 to-indigo-600';
  if (act === 'search' || msg.includes('search')) return 'bg-gradient-to-br from-cyan-400 to-cyan-600';
  if (act === 'export' || msg.includes('export')) return 'bg-gradient-to-br from-lime-400 to-lime-600';
  if (act === 'import' || msg.includes('import')) return 'bg-gradient-to-br from-amber-400 to-amber-600';
  if (act === 'error' || msg.includes('error') || msg.includes('failed')) return 'bg-gradient-to-br from-red-500 to-red-700';
  if (act === 'success' || msg.includes('success')) return 'bg-gradient-to-br from-green-500 to-green-700';
  
  return 'bg-gradient-to-br from-gray-400 to-gray-600';
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  // Return formatted date if more than a week ago
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==================== PAGINATION ====================
function updatePagination() {
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  
  // Update page numbers display
  const pageNumbersContainer = document.getElementById("pageNumbers");
  pageNumbersContainer.innerHTML = '';
  
  // Show max 7 page numbers for better navigation
  const maxPages = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
  let endPage = Math.min(totalPages, startPage + maxPages - 1);
  
  if (endPage - startPage < maxPages - 1) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = i;
    pageBtn.className = `px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
      i === currentPage 
        ? 'bg-blue-500 text-white shadow-md' 
        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
    }`;
    pageBtn.addEventListener('click', () => {
      currentPage = i;
      renderLogs();
      // Smooth scroll to top of table
      logsTableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    pageNumbersContainer.appendChild(pageBtn);
  }

  // Update button states with better styling
  const buttonClass = "px-4 py-2 rounded-lg font-semibold transition-all duration-200";
  const enabledClass = "bg-blue-500 text-white hover:bg-blue-600 shadow-md";
  const disabledClass = "bg-gray-200 text-gray-400 cursor-not-allowed";
  
  prevPageBtn.className = `${buttonClass} ${currentPage === 1 ? disabledClass : enabledClass}`;
  firstPageBtn.className = `${buttonClass} ${currentPage === 1 ? disabledClass : enabledClass}`;
  nextPageBtn.className = `${buttonClass} ${currentPage === totalPages || totalPages === 0 ? disabledClass : enabledClass}`;
  lastPageBtn.className = `${buttonClass} ${currentPage === totalPages || totalPages === 0 ? disabledClass : enabledClass}`;

  prevPageBtn.disabled = currentPage === 1;
  firstPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
  lastPageBtn.disabled = currentPage === totalPages || totalPages === 0;
  
  // Update page info
  document.getElementById("currentPage").textContent = currentPage;
  document.getElementById("totalPages").textContent = totalPages || 1;
}

// ==================== EVENT LISTENERS ====================
searchInput.addEventListener("input", debounce(() => {
  console.log('🔍 Search input:', searchInput.value);
  applyFilters();
}, 300));

dateFilter.addEventListener("change", () => {
  console.log('📅 Date filter:', dateFilter.value);
  applyFilters();
});

actionFilter.addEventListener("change", () => {
  console.log('🎯 Action filter:', actionFilter.value);
  applyFilters();
});

itemsPerPageSelect.addEventListener("change", () => {
  itemsPerPage = parseInt(itemsPerPageSelect.value);
  currentPage = 1;
  console.log('📊 Items per page changed to:', itemsPerPage);
  renderLogs();
});

refreshBtn.addEventListener("click", () => {
  console.log('🔄 Refreshing data...');
  // Refresh icon animation
  const icon = refreshBtn.querySelector('i');
  icon.classList.add('fa-spin');
  setTimeout(() => {
    icon.classList.remove('fa-spin');
  }, 1000);
  
  // Show refreshing state
  const originalText = refreshBtn.innerHTML;
  refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing...';
  refreshBtn.disabled = true;
  
  // Simulate refresh (in real scenario, this would re-fetch data)
  setTimeout(() => {
    applyFilters();
    refreshBtn.innerHTML = originalText;
    refreshBtn.disabled = false;
    showNotification('Logs refreshed successfully!', 'success');
  }, 500);
});

resetFiltersBtn.addEventListener("click", () => {
  console.log('🗑️ Resetting all filters');
  searchInput.value = "";
  dateFilter.value = "";
  actionFilter.value = "all";
  applyFilters();
  showNotification('All filters reset', 'info');
});

// ==================== CLEAR LOGS FUNCTIONALITY ====================
function showClearLogsModal() {
  const modal = document.getElementById('clearLogsModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function hideClearLogsModal() {
  const modal = document.getElementById('clearLogsModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// Clear logs button event listener
if (clearLogsBtn) {
  clearLogsBtn.addEventListener('click', showClearLogsModal);
}

// Confirm clear logs
document.getElementById('confirmClearBtn')?.addEventListener('click', async function() {
  try {
    // Show loading state
    const confirmBtn = this;
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Clearing...';
    confirmBtn.disabled = true;
    
    // Clear logs from Firebase
    await remove(logsRef);
    
    // Hide the modal
    hideClearLogsModal();
    
    // Reset button
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
    
    // Show success message
    showNotification('All logs cleared successfully!', 'success');
    
  } catch (error) {
    console.error('Error clearing logs:', error);
    
    // Reset button
    const confirmBtn = document.getElementById('confirmClearBtn');
    confirmBtn.innerHTML = '<i class="fas fa-trash mr-2"></i>Clear Logs';
    confirmBtn.disabled = false;
    
    // Show error message
    showNotification('Failed to clear logs. Please try again.', 'error');
  }
});

// Cancel clear logs
document.getElementById('cancelClearBtn')?.addEventListener('click', hideClearLogsModal);

// ==================== EXPORT LOGS TO EXCEL (ExcelJS Version) ====================
exportBtn.addEventListener("click", async () => {
  if (filteredLogs.length === 0) {
    showNotification('No logs available to export with current filters.', 'warning');
    return;
  }

  try {
    // Show exporting state
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Exporting...';
    exportBtn.disabled = true;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartBite System';
    workbook.lastModifiedBy = 'SmartBite System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('System Logs', {
      views: [{ state: 'frozen', ySplit: 1 }] // Freeze header row
    });

    // Define columns
    worksheet.columns = [
      { header: '#', key: 'index', width: 8 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'User', key: 'user', width: 15 },
      { header: 'Action', key: 'action', width: 12 },
      { header: 'Message', key: 'message', width: 50 },
      { header: 'Log ID', key: 'id', width: 20 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Time', key: 'time', width: 12 }
    ];

    // Style header row
    worksheet.getRow(1).font = { 
      bold: true, 
      color: { argb: 'FFFFFFFF' } 
    };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2F75B5' }
    };
    worksheet.getRow(1).alignment = { 
      vertical: 'middle', 
      horizontal: 'center' 
    };

    // Add data rows
    filteredLogs.forEach((log, index) => {
      const logDate = new Date(log.timestamp);
      const row = worksheet.addRow({
        index: index + 1,
        timestamp: logDate.toLocaleString(),
        user: log.user,
        action: log.action || 'N/A',
        message: log.message,
        id: log.id || 'N/A',
        date: logDate.toLocaleDateString(),
        time: logDate.toLocaleTimeString()
      });

      // Alternate row colors for better readability
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `H${filteredLogs.length + 1}`
    };

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, `system_logs_${new Date().toISOString().slice(0, 10)}_${filteredLogs.length}_entries.xlsx`);
    
    // Reset button
    setTimeout(() => {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = false;
    }, 1000);
    
    showNotification(`Exported ${filteredLogs.length} logs to Excel successfully!`, 'success');
    
  } catch (error) {
    console.error('Export error:', error);
    exportBtn.innerHTML = '<i class="fas fa-file-excel mr-2"></i>Export Excel';
    exportBtn.disabled = false;
    showNotification('Failed to export logs. Please try again.', 'error');
  }
});

// ==================== UTILITY FUNCTIONS ====================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.custom-notification');
  existingNotifications.forEach(notification => notification.remove());
  
  const notification = document.createElement('div');
  notification.className = `custom-notification fixed top-4 right-4 px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 transform transition-transform duration-300 translate-x-0`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  const colors = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-orange-500 text-white',
    info: 'bg-blue-500 text-white'
  };
  
  notification.className += ` ${colors[type]}`;
  notification.innerHTML = `
    <i class="fas ${icons[type]} text-2xl"></i>
    <span class="font-semibold">${message}</span>
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// ==================== SEED SAMPLE DATA (FOR TESTING) ====================
window.seedSampleLogs = async function() {
  if (!confirm('This will add sample logs for testing. Continue?')) return;
  
  const sampleLogs = [
    {
      message: "User john_doe successfully logged in",
      user: "john_doe",
      action: "login",
      timestamp: Date.now() - 1000 * 60 * 5 // 5 minutes ago
    },
    {
      message: "Product 'iPhone 15' was added to inventory",
      user: "admin",
      action: "add",
      timestamp: Date.now() - 1000 * 60 * 30 // 30 minutes ago
    },
    {
      message: "User jane_smith made a purchase: iPhone 15",
      user: "jane_smith",
      action: "purchase",
      timestamp: Date.now() - 1000 * 60 * 60 * 2 // 2 hours ago
    },
    {
      message: "Inventory updated for product 'Samsung Galaxy'",
      user: "admin",
      action: "update",
      timestamp: Date.now() - 1000 * 60 * 60 * 24 // 1 day ago
    },
    {
      message: "Failed login attempt for user unknown",
      user: "System",
      action: "login",
      timestamp: Date.now() - 1000 * 60 * 60 * 48 // 2 days ago
    }
  ];
  
  try {
    // Note: In a real scenario, you would write to Firebase here
    // For now, we'll just add to the current array
    sampleLogs.forEach(log => {
      allLogs.unshift({
        id: 'sample_' + Math.random().toString(36).substr(2, 9),
        ...log
      });
    });
    
    applyFilters();
    showNotification('Sample logs added successfully!', 'success');
  } catch (error) {
    console.error('Error seeding sample logs:', error);
    showNotification('Failed to add sample logs', 'error');
  }
}

// ==================== DEBUG FUNCTIONS ====================
window.debugFilters = function() {
  console.group('🔍 Filter Debug Information');
  console.log('📊 Total logs:', allLogs.length);
  console.log('🎯 Available actions:', [...new Set(allLogs.map(log => log.action))]);
  console.log('👤 Available users:', [...new Set(allLogs.map(log => log.user))]);
  console.log('📅 Date range:', {
    oldest: allLogs.length > 0 ? new Date(allLogs[allLogs.length - 1].timestamp).toLocaleDateString() : 'N/A',
    newest: allLogs.length > 0 ? new Date(allLogs[0].timestamp).toLocaleDateString() : 'N/A'
  });
  console.groupEnd();
}

// ==================== INITIAL SETUP ====================
window.addEventListener("DOMContentLoaded", () => {
  // Initialize items per page
  itemsPerPageSelect.value = itemsPerPage;
  
  // Set today's date as default in date filter
  const today = new Date().toISOString().split('T')[0];
  dateFilter.value = today;
  
  // Apply initial filters
  applyFilters();
  
  // Add debug button (remove in production)
  addDebugButton();
  
  console.log('✅ System logs manager initialized');
});

function addDebugButton() {
  if (document.getElementById('debugBtn')) return;
  
  const debugBtn = document.createElement('button');
  debugBtn.id = 'debugBtn';
  debugBtn.innerHTML = '<i class="fas fa-bug mr-2"></i>Debug';
  debugBtn.className = 'fixed bottom-4 right-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition z-40 shadow-lg';
  debugBtn.onclick = window.debugFilters;
  
  document.body.appendChild(debugBtn);
}

// Pagination button event listeners
prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderLogs();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderLogs();
  }
});

firstPageBtn.addEventListener("click", () => {
  currentPage = 1;
  renderLogs();
});

lastPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  currentPage = totalPages;
  renderLogs();
});

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('clearLogsModal');
  if (e.target === modal) {
    hideClearLogsModal();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  
  // Escape to clear filters
  if (e.key === 'Escape') {
    if (document.getElementById('clearLogsModal')?.classList.contains('flex')) {
      hideClearLogsModal();
    } else {
      searchInput.value && resetFiltersBtn.click();
    }
  }
});

console.log('🚀 System Logs Manager loaded successfully!');