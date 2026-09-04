/**
 * API Configuration for the mobile application.
 */

// 🟢 Set this to true to test with your local computer's backend (make sure to update your IP if it changes)
// 🔴 Set this to false to use the live Azure cloud backend!
const USE_LOCAL_BACKEND = false;

const LOCAL_URL = "http://172.20.10.5:8000"; // Local WiFi IP
const AZURE_URL = "https://fyp-sinhala-avatar-backend-v2.azurewebsites.net";

export const API_BASE_URL = USE_LOCAL_BACKEND ? LOCAL_URL : AZURE_URL;
