import { db } from "../script/firebase_conn.js";
import { ref as dbRef, get, child, push, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showError("Please fill in all fields.");
    return;
  }

  try {
    const rootRef = dbRef(db);
    const snapshot = await get(child(rootRef, "cashiers"));

    if (!snapshot.exists()) {
      showError("No accounts found.");
      return;
    }

    let foundUser = null;

    snapshot.forEach((childSnap) => {
      const user = childSnap.val();
      if (
        user.email?.toLowerCase() === email.toLowerCase() &&
        user.password === password
      ) {
        foundUser = { id: childSnap.key, ...user };
      }
    });

    if (foundUser) {
      // Save logged-in user
      localStorage.setItem("cashierUser", JSON.stringify(foundUser));

      // Log login event
      const logsRef = dbRef(db, "logs");
      const newLogRef = push(logsRef);
      const fullName = `${foundUser.first_name} ${foundUser.last_name}`;
      await set(newLogRef, {
        user: fullName,
        message: `${fullName} logged in`,
        timestamp: new Date().toISOString(),
      });

      // ✅ Redirect based on role
      const role = foundUser.role?.toLowerCase();

      if (role === "accountant") {
        window.location.href = "../SMARTBITE-ADMIN/load_rfid.html";
      } else if (role === "it" || role === "super admin") {
        window.location.href = "../public/index.html";
      } else if (role === "cashier") {
        window.location.href = "../public/buy_products.html";
      } else {
        showError("Unknown role. Please contact the administrator.");
      }
    } else {
      showError("Invalid email or password.");
    }
  } catch (err) {
    console.error(err);
    showError("Login failed: " + err.message);
  }
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}
