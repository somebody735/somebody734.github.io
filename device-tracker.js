// device-tracker.js
// Place this at: https://somebody734.github.io/device-tracker.js

(function() {
  const firebaseConfig = {
    apiKey: "AIzaSyAkYe_tvP743kEvmvNW6mL0FYLqz1rt0Hk",
    authDomain: "device-tracker-fa249.firebaseapp.com",
    projectId: "device-tracker-fa249",
    storageBucket: "device-tracker-fa249.firebasestorage.app",
    messagingSenderId: "717051168639",
    appId: "1:717051168639:web:d3b3ad93e9179a86d57c4a"
  };

  const FIREBASE_SCRIPT = "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js";
  const FIRESTORE_SCRIPT = "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js";
  const AUTH_SCRIPT = "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js";

  let db, auth, initialized = false;

  // Load Firebase scripts
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Initialize Firebase
  async function initializeFirebase() {
    if (initialized) return;
    
    try {
      await loadScript(FIREBASE_SCRIPT);
      await loadScript(FIRESTORE_SCRIPT);
      await loadScript(AUTH_SCRIPT);

      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      auth = firebase.auth();
      
      await auth.signInAnonymously();
      initialized = true;
      console.log("[DeviceTracker] Initialized successfully");
    } catch (e) {
      console.error("[DeviceTracker] Initialization error:", e);
      throw e;
    }
  }

  // Get or create device ID
  function getDeviceID() {
    let deviceID = localStorage.getItem('deviceID');
    
    if (!deviceID) {
      deviceID = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceID', deviceID);
    }
    
    return deviceID;
  }

  // Check if device is blocked
  async function isDeviceBlocked(deviceID) {
    try {
      const doc = await db.collection('blocklist').doc(deviceID).get();
      return doc.exists;
    } catch (e) {
      console.error("[DeviceTracker] Error checking blocklist:", e);
      return false;
    }
  }

  // Get block reason
  async function getBlockReason(deviceID) {
    try {
      const doc = await db.collection('blocklist').doc(deviceID).get();
      if (doc.exists) {
        return doc.data().reason || "Your device has been blocked. Contact administrator for more info.";
      }
      return null;
    } catch (e) {
      console.error("[DeviceTracker] Error getting block reason:", e);
      return null;
    }
  }

  // Check incognito mode
  async function checkIncognito() {
    return new Promise((resolve) => {
      try {
        const test = indexedDB.open('test');
        test.onerror = () => resolve(true);
        test.onsuccess = () => resolve(false);
      } catch (e) {
        resolve(true);
      }
    });
  }

  // Register device
  async function registerDevice() {
    try {
      const deviceID = getDeviceID();
      
      // Check if blocked
      if (await isDeviceBlocked(deviceID)) {
        const reason = await getBlockReason(deviceID);
        blockUser(reason);
        return false;
      }

      // Get repository info from URL
      const repo = window.location.hostname === 'somebody734.github.io' 
        ? 'somebody734.github.io' 
        : window.location.hostname.replace('.github.io', '');

      // Register/update device
      await db.collection('devices').doc(deviceID).set({
        deviceID: deviceID,
        lastSeen: new Date(),
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        currentPage: window.location.href,
        repository: repo,
        isIncognito: await checkIncognito(),
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language
      }, { merge: true });

      console.log("[DeviceTracker] Device registered:", deviceID);
      return true;
    } catch (e) {
      console.error("[DeviceTracker] Registration error:", e);
      return true; // Allow access even if tracking fails
    }
  }

  // Block user interface
  function blockUser(reason = "Your device has been blocked") {
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; margin: 0;">
        <div style="text-align: center; background: white; padding: 50px 40px; border-radius: 15px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px;">
          <div style="font-size: 60px; margin-bottom: 20px;">🚫</div>
          <h1 style="color: #333; margin: 0 0 15px 0; font-size: 28px;">Access Denied</h1>
          <p style="font-size: 16px; color: #666; margin: 15px 0; line-height: 1.6;">${reason}</p>
          <p style="color: #999; font-size: 13px; margin: 20px 0 0 0;">If you believe this is an error, please contact the site administrator.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <code style="background: #f5f5f5; padding: 8px 12px; border-radius: 4px; font-size: 11px; color: #666; display: block; word-break: break-all;">${getDeviceID()}</code>
          </div>
        </div>
      </div>
    `;
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.height = '100%';
  }

  // Update device activity
  async function updateActivity() {
    try {
      const deviceID = getDeviceID();
      
      await db.collection('devices').doc(deviceID).update({
        lastSeen: new Date(),
        currentPage: window.location.href
      });
    } catch (e) {
      console.error("[DeviceTracker] Activity update error:", e);
    }
  }

  // Public API
  window.DeviceTracker = {
    async initialize() {
      await initializeFirebase();
      const allowed = await registerDevice();
      
      // Update activity every 30 seconds
      setInterval(updateActivity, 30000);
      
      return allowed;
    },
    
    getDeviceID() {
      return getDeviceID();
    },
    
    async getStatus() {
      const deviceID = getDeviceID();
      const blocked = await isDeviceBlocked(deviceID);
      return {
        deviceID,
        blocked,
        reason: blocked ? await getBlockReason(deviceID) : null
      };
    }
  };

  // Auto-initialize if data attribute is present
  if (document.currentScript?.dataset.autoInit === 'true') {
    window.addEventListener('DOMContentLoaded', () => {
      DeviceTracker.initialize();
    });
  }
})();