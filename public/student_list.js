import { db } from "../script/firebase_conn.js";
import { ref, get, update, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// ---------- Sorting state ----------
let currentSort = { column: "created_at", order: "desc" }; // default: newest first

// ---------- Pagination state ----------
let currentPage = 1;
const rowsPerPage = 14;
let totalStudents = 0;

// Helper: parse balance safely (handles numbers or strings like "₱1,000" or "1000")
function parseBalance(raw) {
    if (raw === undefined || raw === null) return 0;
    // Remove any non-numeric except minus and dot
    const cleaned = String(raw).replace(/[^\d.-]+/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
}

// ========================
// Load all students in the table
// ========================
async function loadStudents() {
    await renderStudents(); // default: no filter
}

// ========================
// Render students with optional search filter + use currentSort + pagination
// ========================
async function renderStudents(filter = "") {
    const studentsRef = ref(db, "student_users");
    const snapshot = await get(studentsRef);
    const tbody = document.getElementById("student_table_body");
    tbody.innerHTML = "";

    let students = [];

    if (snapshot.exists()) {
        snapshot.forEach(child => {
            const data = child.val();
            const key = child.key;

            const id = (data.id_number ?? "").toString().toLowerCase();
            const name = `${data.first_name ?? data.student_fname ?? ""} ${data.last_name ?? data.student_lname ?? ""}`.toLowerCase();

            // Apply search filter if provided
            if (filter && !(id.includes(filter) || name.includes(filter))) {
                return; // skip non-matching rows
            }

            students.push({
                key,
                rawData: data,
                id_number: data.id_number ?? "-",
                first_name: data.first_name ?? data.student_fname ?? "",
                last_name: data.last_name ?? data.student_lname ?? "",
                balance: parseBalance(data.balance),
                disabled: !!data.disabled,
                created_at: data.created_at || data.timestamp || 0 // fallback for old records
            });
        });

        // Apply sorting according to currentSort
        students.sort((a, b) => {
            const col = currentSort.column;
            const ord = currentSort.order === "asc" ? 1 : -1;

            if (col === "id_number") {
                return a.id_number.toString().localeCompare(b.id_number.toString()) * ord;
            }
            if (col === "name") {
                const nameA = (a.first_name + " " + a.last_name).toLowerCase();
                const nameB = (b.first_name + " " + b.last_name).toLowerCase();
                return nameA.localeCompare(nameB) * ord;
            }
            if (col === "balance") {
                // numeric compare
                return (a.balance - b.balance) * ord;
            }
            if (col === "status") {
                // Active (false) first when asc; Disabled (true) first when desc
                const valA = a.disabled ? 1 : 0;
                const valB = b.disabled ? 1 : 0;
                return (valA - valB) * ord;
            }
            if (col === "created_at") {
                // Sort by creation timestamp (newest first by default)
                return (a.created_at - b.created_at) * ord;
            }
            return 0;
        });

        totalStudents = students.length;

        // If no matching students, show a friendly row
        if (students.length === 0) {
            const noRow = document.createElement("tr");
            noRow.innerHTML = `
                <td class="px-4 py-8 text-center text-gray-500" colspan="5">
                    <div class="flex flex-col items-center space-y-2">
                        <i class="fas fa-user-slash text-4xl text-gray-400"></i>
                        <p class="text-lg font-medium">No students found</p>
                        <p class="text-sm text-gray-400">Try adjusting your search criteria</p>
                    </div>
                </td>`;
            tbody.appendChild(noRow);
            // still call attachEventListeners to ensure other UI works
            attachEventListeners();
            updateSortIndicators();
            renderPagination(0);
            return;
        }

        // Calculate pagination
        const startIdx = (currentPage - 1) * rowsPerPage;
        const endIdx = startIdx + rowsPerPage;
        const paginatedStudents = students.slice(startIdx, endIdx);

        // Render rows with improved UI
        paginatedStudents.forEach((s, index) => {
            const row = document.createElement("tr");
            row.classList.add("border-b", "hover:bg-blue-50", "transition-colors", "duration-150");
            
            // Add alternating row colors for better readability
            if (index % 2 === 0) {
                row.classList.add("bg-gray-50");
            }

            // Format balance with proper currency display
            const formattedBalance = new Intl.NumberFormat('en-PH', {
                style: 'currency',
                currency: 'PHP',
                minimumFractionDigits: 2
            }).format(s.balance);

            row.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-800">${s.id_number}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <i class="fas fa-user text-blue-600 text-xs"></i>
                        </div>
                        <span class="font-medium text-gray-700">${s.first_name} ${s.last_name}</span>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${
                        s.balance > 100 ? 'bg-green-100 text-green-800' : 
                        s.balance > 0 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                    }">
                        <i class="fas fa-wallet mr-1 text-xs"></i>
                        ${formattedBalance}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        s.disabled ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                    }">
                        <i class="fas ${s.disabled ? 'fa-times-circle' : 'fa-check-circle'} mr-1"></i>
                        ${s.disabled ? "Disabled" : "Active"}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-150 edit-btn" 
                            data-key="${s.key}" 
                            data-id="${s.id_number}"
                            data-fname="${s.first_name}" 
                            data-lname="${s.last_name}" 
                            data-balance="${s.balance}">
                            <i class="fas fa-edit mr-1"></i> Edit
                        </button>
                        <button class="${
                            s.disabled 
                                ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700" 
                                : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                        } text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-150 disable-btn" 
                            data-key="${s.key}" 
                            data-disabled="${s.disabled ? "true" : "false"}">
                            <i class="fas ${s.disabled ? 'fa-check' : 'fa-ban'} mr-1"></i>
                            ${s.disabled ? "Enable" : "Disable"}
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        attachEventListeners();
        updateSortIndicators();
        renderPagination(totalStudents);
    } else {
        // No students in DB
        const noRow = document.createElement("tr");
        noRow.innerHTML = `
            <td class="px-4 py-12 text-center text-gray-500" colspan="5">
                <div class="flex flex-col items-center space-y-3">
                    <i class="fas fa-database text-5xl text-gray-300"></i>
                    <p class="text-xl font-semibold">No students in the database</p>
                    <p class="text-sm text-gray-400">Start by registering new students</p>
                </div>
            </td>`;
        tbody.appendChild(noRow);
        updateSortIndicators();
        renderPagination(0);
    }
}

// ========================
// Render pagination controls with improved UI
// ========================
function renderPagination(total) {
    const paginationContainer = document.getElementById("paginationContainer");
    if (!paginationContainer) return;

    paginationContainer.innerHTML = "";

    if (total === 0) return;

    const totalPages = Math.ceil(total / rowsPerPage);

    // Create pagination wrapper with better styling
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col sm:flex-row items-center justify-between mt-6 px-4 py-4 bg-white rounded-lg shadow-sm border border-gray-200";

    // Info text with icon
    const infoText = document.createElement("div");
    infoText.className = "text-sm text-gray-600 font-medium mb-3 sm:mb-0";
    const startIdx = (currentPage - 1) * rowsPerPage + 1;
    const endIdx = Math.min(currentPage * rowsPerPage, total);
    infoText.innerHTML = `
        <i class="fas fa-info-circle text-blue-500 mr-1"></i>
        Showing <span class="font-bold text-gray-800">${startIdx}-${endIdx}</span> of <span class="font-bold text-gray-800">${total}</span> students
    `;

    // Buttons container
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "flex gap-2 items-center";

    // Previous button with improved styling
    const prevBtn = document.createElement("button");
    prevBtn.innerHTML = '<i class="fas fa-chevron-left mr-1"></i> Previous';
    prevBtn.className = `px-4 py-2 rounded-lg font-medium text-sm transition-all duration-150 ${
        currentPage === 1
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow-md"
    }`;
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", async () => {
        if (currentPage > 1) {
            currentPage--;
            const filter = document.getElementById("studentSearch")?.value.toLowerCase() || "";
            await renderStudents(filter);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Page numbers with improved design
    const pageNumbers = document.createElement("div");
    pageNumbers.className = "flex gap-1";

    // Smart pagination: show first, last, current and nearby pages
    const pagesToShow = [];
    if (totalPages <= 7) {
        // Show all pages if 7 or fewer
        for (let i = 1; i <= totalPages; i++) {
            pagesToShow.push(i);
        }
    } else {
        // Always show first page
        pagesToShow.push(1);
        
        // Show ellipsis or pages near current
        if (currentPage > 3) {
            pagesToShow.push("...");
        }
        
        // Show pages around current
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            if (!pagesToShow.includes(i)) {
                pagesToShow.push(i);
            }
        }
        
        // Show ellipsis or pages near end
        if (currentPage < totalPages - 2) {
            pagesToShow.push("...");
        }
        
        // Always show last page
        if (!pagesToShow.includes(totalPages)) {
            pagesToShow.push(totalPages);
        }
    }

    pagesToShow.forEach(page => {
        if (page === "...") {
            const ellipsis = document.createElement("span");
            ellipsis.className = "px-3 py-2 text-gray-400";
            ellipsis.textContent = "...";
            pageNumbers.appendChild(ellipsis);
        } else {
            const pageBtn = document.createElement("button");
            pageBtn.textContent = page;
            pageBtn.className = `min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                currentPage === page
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`;
            pageBtn.addEventListener("click", async () => {
                currentPage = page;
                const filter = document.getElementById("studentSearch")?.value.toLowerCase() || "";
                await renderStudents(filter);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            pageNumbers.appendChild(pageBtn);
        }
    });

    // Next button with improved styling
    const nextBtn = document.createElement("button");
    nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right ml-1"></i>';
    nextBtn.className = `px-4 py-2 rounded-lg font-medium text-sm transition-all duration-150 ${
        currentPage === totalPages
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow-md"
    }`;
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", async () => {
        if (currentPage < totalPages) {
            currentPage++;
            const filter = document.getElementById("studentSearch")?.value.toLowerCase() || "";
            await renderStudents(filter);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    buttonsContainer.appendChild(prevBtn);
    buttonsContainer.appendChild(pageNumbers);
    buttonsContainer.appendChild(nextBtn);

    wrapper.appendChild(infoText);
    wrapper.appendChild(buttonsContainer);
    paginationContainer.appendChild(wrapper);
}

// ========================
// Update header arrows (visual indicators) with improved styling
// expects headers to have data-sort attributes
// ========================
function updateSortIndicators() {
    document.querySelectorAll("[data-sort]").forEach(header => {
        const col = header.getAttribute("data-sort");
        header.classList.remove("sort-asc", "sort-desc");
        header.querySelectorAll(".sort-indicator").forEach(n => n.remove());

        const span = document.createElement("span");
        span.className = "sort-indicator ml-2 text-xs";
        if (currentSort.column === col) {
            span.innerHTML = currentSort.order === "asc" 
                ? '<i class="fas fa-sort-up"></i>' 
                : '<i class="fas fa-sort-down"></i>';
            header.classList.add(currentSort.order === "asc" ? "sort-asc" : "sort-desc");
        } else {
            span.innerHTML = '<i class="fas fa-sort" style="opacity: 0.3;"></i>';
        }
        header.appendChild(span);
    });
}

// ========================
// Check for duplicate ID number (excluding current student)
// ========================
async function checkDuplicateId(idNumber, currentKey) {
    const studentsRef = ref(db, "student_users");
    const snapshot = await get(studentsRef);
    
    if (snapshot.exists()) {
        let isDuplicate = false;
        snapshot.forEach(child => {
            const data = child.val();
            const key = child.key;
            
            // Skip if this is the current student being edited
            if (key === currentKey) {
                return;
            }
            
            // Check if another student has the same ID
            if (data.id_number === idNumber) {
                isDuplicate = true;
            }
        });
        return isDuplicate;
    }
    return false;
}

// ========================
// Validation function for ID number (numbers only, max 10 digits)
// ========================
function validateIdNumber(idNumber) {
    const trimmed = idNumber.trim();
    
    if (trimmed === "") {
        showToast("❌ ID Number cannot be empty", "error");
        return false;
    }
    
    // Check if contains any alphabet characters
    if (/[a-zA-Z]/.test(trimmed)) {
        showToast("❌ ID Number must contain only numbers (no letters allowed)", "error");
        return false;
    }
    
    // Check if it's a valid number format
    if (!/^\d+$/.test(trimmed)) {
        showToast("❌ ID Number must contain only numeric digits", "error");
        return false;
    }
    
    // Check if exceeds 10 digits
    if (trimmed.length > 10) {
        showToast("❌ ID Number cannot exceed 10 digits", "error");
        return false;
    }
    
    return true;
}

// ========================
// Attach table event listeners
// (keeps all your existing logic intact)
// ========================
function attachEventListeners() {
    // Toggle enable/disable with confirmation modal
    document.querySelectorAll(".disable-btn").forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener("click", () => {
            const key = newBtn.getAttribute("data-key");
            const isDisabled = newBtn.getAttribute("data-disabled") === "true";
            const studentRow = newBtn.closest("tr");
            const studentName = studentRow.querySelector("td:nth-child(2)")?.textContent.trim() || "this student";

            // Store info inside modal attributes
            const modal = document.getElementById("disableConfirmModal");
            modal.setAttribute("data-key", key);
            modal.setAttribute("data-disabled", isDisabled);

            // Update modal text dynamically
            document.getElementById("disableStudentName").textContent =
                isDisabled
                    ? `Are you sure you want to enable ${studentName}?`
                    : `Are you sure you want to disable ${studentName}?`;

            // Update confirm button label + style
            const confirmBtn = document.getElementById("confirmDisableBtn");
            confirmBtn.textContent = isDisabled ? "Enable" : "Disable";
            confirmBtn.className = isDisabled
                ? "bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                : "bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700";

            // Show modal
            modal.classList.remove("hidden");
            modal.classList.add("flex");
        });
    });

    // Cancel disable
    document.getElementById("cancelDisableBtn").onclick = () => {
        const modal = document.getElementById("disableConfirmModal");
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    };

    // Confirm disable
    document.getElementById("confirmDisableBtn").onclick = async () => {
        const modal = document.getElementById("disableConfirmModal");
        const key = modal.getAttribute("data-key");
        const isDisabled = modal.getAttribute("data-disabled") === "true";

        await update(ref(db, `student_users/${key}`), {
            disabled: !isDisabled
        });

        showToast(isDisabled ? "✅ Student enabled successfully." : "✅ Student disabled successfully.", "success");

        modal.classList.add("hidden");
        modal.classList.remove("flex");

        loadStudents(); // refresh table
    };

    // ========== Existing Edit/Delete bindings unchanged ==========
    document.querySelectorAll(".edit-btn").forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener("click", () => {
            const key = newBtn.getAttribute("data-key");

            document.getElementById("editStudentKey").value = key;
            document.getElementById("editIdNumber").value = newBtn.getAttribute("data-id");
            document.getElementById("editFirstName").value = newBtn.getAttribute("data-fname");
            document.getElementById("editLastName").value = newBtn.getAttribute("data-lname");
            document.getElementById("editBalance").value = newBtn.getAttribute("data-balance");

            // Clear any previous error styling
            document.getElementById("editIdNumber").classList.remove("border-red-500");

            document.getElementById("editStudentModal").classList.remove("hidden");
        });
    });

    // Add real-time input validation for ID Number field
    const editIdNumberInput = document.getElementById("editIdNumber");
    if (editIdNumberInput) {
        // Remove existing listener if any
        const newInput = editIdNumberInput.cloneNode(true);
        editIdNumberInput.parentNode.replaceChild(newInput, editIdNumberInput);
        
        newInput.addEventListener("input", (e) => {
            // Remove any non-numeric characters
            e.target.value = e.target.value.replace(/[^0-9]/g, "");
            
            // Limit to 10 characters
            if (e.target.value.length > 10) {
                e.target.value = e.target.value.slice(0, 10);
            }
            
            // Remove red border if user starts typing valid input
            if (e.target.value.length > 0) {
                e.target.classList.remove("border-red-500");
            }
        });

        // Prevent pasting non-numeric content
        newInput.addEventListener("paste", (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData("text");
            const numericOnly = pastedText.replace(/[^0-9]/g, "").slice(0, 10);
            e.target.value = numericOnly;
            e.target.classList.remove("border-red-500");
        });
    }

    document.getElementById("closeModalBtn").onclick = () => {
        document.getElementById("editStudentModal").classList.add("hidden");
    };

    document.getElementById("saveStudentBtn").onclick = async () => {
        const key = document.getElementById("editStudentKey").value;
        const id_number = document.getElementById("editIdNumber").value.trim();
        const first_name = document.getElementById("editFirstName").value.trim();
        const last_name = document.getElementById("editLastName").value.trim();
        const balance = Number(document.getElementById("editBalance").value) || 0;

        // Validate ID number format before saving
        if (!validateIdNumber(id_number)) {
            // Add red border to highlight the error
            document.getElementById("editIdNumber").classList.add("border-red-500");
            return; // Stop the save operation
        }

        // Check for duplicate ID numbers (excluding current student)
        const isDuplicate = await checkDuplicateId(id_number, key);
        if (isDuplicate) {
            document.getElementById("editIdNumber").classList.add("border-red-500");
            showToast("❌ This ID number is already used by another student", "error");
            return;
        }

        // Remove error styling if validation passes
        document.getElementById("editIdNumber").classList.remove("border-red-500");

        await update(ref(db, `student_users/${key}`), {
            id_number,
            first_name,
            last_name,
            balance
        });

        showToast("✅ Student updated successfully.", "success");
        document.getElementById("editStudentModal").classList.add("hidden");
        loadStudents();
    };

    const deleteBtn = document.getElementById("deleteStudentBtn");
    deleteBtn.onclick = () => {
        const firstName = document.getElementById("editFirstName").value;
        const lastName = document.getElementById("editLastName").value;
        document.getElementById("deleteStudentName").textContent = `Are you sure you want to delete ${firstName} ${lastName}?`;
        document.getElementById("deleteConfirmModal").classList.remove("hidden");
    };

    document.getElementById("cancelDeleteBtn").onclick = () => {
        document.getElementById("deleteConfirmModal").classList.add("hidden");
    };

    document.getElementById("confirmDeleteBtn").onclick = async () => {
        const key = document.getElementById("editStudentKey").value;
        await remove(ref(db, `student_users/${key}`));
        showToast("✅ Student deleted successfully.", "success");
        document.getElementById("deleteConfirmModal").classList.add("hidden");
        document.getElementById("editStudentModal").classList.add("hidden");
        loadStudents();
    };
}

// ========================
// Toast function with type support (success, error, info)
// ========================
function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");
    
    // Reset classes
    toast.className = "fixed bottom-5 right-5 px-6 py-4 rounded-lg shadow-2xl z-[9999] flex items-center space-x-3 animate-slide-in";
    
    // Set color based on type
    if (type === "success") {
        toast.classList.add("bg-green-500", "text-white");
    } else if (type === "error") {
        toast.classList.add("bg-red-500", "text-white");
    } else if (type === "info") {
        toast.classList.add("bg-blue-500", "text-white");
    }
    
    toastMessage.textContent = message;
    toast.classList.remove("hidden");
    
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}

// ========================
// Check if student is active before allowing login/scan
// ========================
async function checkStudentAccess(id_number) {
    const studentsRef = ref(db, "student_users");
    const snapshot = await get(studentsRef);

    if (snapshot.exists()) {
        let found = false;
        snapshot.forEach(child => {
            const data = child.val();

            if (data.id_number === id_number) {
                found = true;
                if (data.disabled) {
                    showToast("❌ This student ID is disabled. Please contact the administrator.", "error");
                    throw new Error("Student account disabled");
                } else {
                    showToast("✅ Student is active. You may proceed.", "success");
                    console.log("Student active:", data);
                }
            }
        });

        if (!found) {
            showToast("⚠️ Student ID not found.", "error");
            throw new Error("Student ID not found");
        }
    } else {
        showToast("⚠️ No students found in the database.", "error");
        throw new Error("No students in DB");
    }
}

// ========================
// Example usage: check on button click
// ========================
document.getElementById("checkStudentBtn")?.addEventListener("click", async () => {
    const id_number = document.getElementById("student_id_input").value.trim();
    if (!id_number) return showToast("Please enter ID number", "error");

    try {
        await checkStudentAccess(id_number);
        console.log("Proceeding with student ID:", id_number);
    } catch (err) {
        console.error(err.message);
    }
});

// ========================
// Search function
// ========================
function setupSearch() {
    const searchInput = document.getElementById("studentSearch");
    const clearBtn = document.getElementById("clearSearch");

    searchInput.addEventListener("input", async () => {
        const filter = searchInput.value.toLowerCase();
        currentPage = 1; // Reset to first page when searching
        await renderStudents(filter); // re-render with filter
    });

    clearBtn.addEventListener("click", async () => {
        searchInput.value = "";
        currentPage = 1; // Reset to first page
        await renderStudents(); // show all again
    });
}

// ========================
// Sorting UI hookup
// - Clickable headers with data-sort attribute
// - Also supports select dropdown #balanceSort (if present)
// ========================
function setupSorting() {
    // header clicks
    document.querySelectorAll("[data-sort]").forEach(header => {
        header.style.cursor = "pointer";
        header.addEventListener("click", async () => {
            const column = header.getAttribute("data-sort");
            if (currentSort.column === column) {
                currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
            } else {
                currentSort.column = column;
                currentSort.order = "asc";
            }
            currentPage = 1; // Reset to first page when sorting
            const filter = document.getElementById("studentSearch")?.value.toLowerCase() || "";
            await renderStudents(filter);
        });
    });

    // optional select dropdown (if you used the improved HTML)
    const balanceSelect = document.getElementById("balanceSort");
    if (balanceSelect) {
        balanceSelect.addEventListener("change", async () => {
            const v = balanceSelect.value;
            if (v === "highToLow") {
                currentSort = { column: "balance", order: "desc" };
            } else if (v === "lowToHigh") {
                currentSort = { column: "balance", order: "asc" };
            } else {
                // default - reset to created_at sort (newest first)
                currentSort = { column: "created_at", order: "desc" };
            }
            currentPage = 1; // Reset to first page when sorting
            const filter = document.getElementById("studentSearch")?.value.toLowerCase() || "";
            await renderStudents(filter);
        });
    }
}

// ========================
// Init
// ========================
window.addEventListener("DOMContentLoaded", async () => {
    await loadStudents();
    setupSearch();
    setupSorting();
});