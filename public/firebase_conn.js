import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCIvoeS3J9mFQCEbA7aZoPAxgmNhjHURiE",
  authDomain: "smartbitefinal.firebaseapp.com",
  databaseURL: "https://smartbitefinal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartbitefinal",
  storageBucket: "smartbitefinal.firebasestorage.app",
  messagingSenderId: "92363576713",
  appId: "1:92363576713:web:b16bdf09a484c15fb8bd58",
  measurementId: "G-WV3DTHSQLG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getDatabase(app);