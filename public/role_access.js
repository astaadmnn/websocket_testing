// SMARTBITE-ADMIN/script/role_access.js
document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop();

  // 🛑 Skip this script on the login page
  if (currentPage === "login.html") return;

  // 🔒 Get the logged-in user
  const user = JSON.parse(localStorage.getItem("cashierUser"));

  // If no session, redirect to login
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userRole = user.role?.toLowerCase() || "";
  console.log("Logged in as:", userRole);

  // 🧭 Sidebar item filtering based on role
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    const menuItems = sidebar.querySelectorAll("li a");

    const roleAccess = {
      accountant: ["load_rfid.html", "return_money.html", "sales.html"],
      it: ["index.html", "load_rfid.html", "student_list.html"],
      cashier: ["buy_products.html", "products.html", "order-display.html", "add_role.html"],
      "super admin": ["*"], // full access
    };

    const allowedPages = roleAccess[userRole] || [];

    menuItems.forEach((link) => {
      const page = link.getAttribute("data-page");
      if (!allowedPages.includes("*") && !allowedPages.includes(page)) {
        link.parentElement.style.display = "none";
      }
    });
  }

  // 🧭 Role-based redirect configuration
  const roleSettings = {
    accountant: {
      allowed: ["load_rfid.html", "return_money.html", "sales.html"],
      defaultPage: "load_rfid.html",
      folder: "",
    },
    it: {
      allowed: ["index.html", "load_rfid.html", "student_list.html"],
      defaultPage: "index.html",
      folder: "",
    },
    cashier: {
      allowed: ["buy_products.html", "products.html", "order-display.html", "add_role.html"],
      defaultPage: "buy_products.html",
      folder: "",
    },
    "super admin": {
      allowed: ["*"],
      defaultPage: null, // no forced redirect
      folder: "",
    },
  };

  const settings = roleSettings[userRole];

  // 🚦 Redirect to default page if user is on a disallowed page
  if (settings) {
    const { allowed, defaultPage, folder } = settings;

    // Only redirect if current page is NOT allowed and not already on default
    if (!allowed.includes("*") && !allowed.includes(currentPage)) {
      if (currentPage !== defaultPage) {
        console.log(`Redirecting ${userRole} to ${folder}${defaultPage}`);
        window.location.href = `${folder}${defaultPage}`;
      }
    }
  } else {
    // Unknown role fallback
    window.location.href = "login.html";
  }

  // 🚪 Logout button functionality
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("cashierUser");
      window.location.href = "login.html";
    });
  }
});
