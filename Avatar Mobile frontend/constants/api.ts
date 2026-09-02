/**
 * API Configuration for the mobile application.
 *
 * Using the computer's LOCAL IP so a physical phone on the same WiFi can reach it.
 * Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find your IP if this changes.
 *
 * Backend must be started with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
 */
export const API_BASE_URL = "http://172.20.10.5:8000";
