// intelliface-api/services/faceRecognitionService.js
const axios = require('axios');

// Load this from .env for flexibility
const PYTHON_FACE_API_BASE_URL = process.env.PYTHON_FACE_API_URL || 'http://localhost:5001';

/**
 * Enrolls a face with the Python face recognition service.
 * @param {string} idForEnrollment - The unique identifier for the employee (or user ID).
 * @param {string} imageBase64 - The base64 encoded image string.
 * @returns {Promise<object>} Contains { success: boolean, data?: object, error?: object, status?: number }
 */
async function enrollFace(idForEnrollment, imageBase64) {
  const endpoint = `${PYTHON_FACE_API_BASE_URL}/enroll_face`;
  console.log(`NODE_API_CLIENT: Sending enrollment request for ID: ${idForEnrollment} to Python service at ${endpoint}. Image base64 length: ${imageBase64 ? imageBase64.length : 'N/A'}`);
  if (!idForEnrollment || !imageBase64) {
    console.error("NODE_API_CLIENT: enrollFace called with missing idForEnrollment or imageBase64.");
    return { success: false, error: { message: 'ID and imageBase64 are required for enrollment.' }, status: 400 };
  }
  try {
    const response = await axios.post(endpoint, {
      employee_id: idForEnrollment, // Python service expects 'employee_id'
      image_base64: imageBase64,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000 // 30 seconds timeout, enrollment can be slower
    });
    console.log(`NODE_API_CLIENT: Enrollment response from Python for ${idForEnrollment}:`, response.data);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    console.error(`NODE_API_CLIENT: Error enrolling face for ${idForEnrollment} with Python service.`);
    if (error.response) {
      console.error("Python service error response status:", error.response.status);
      console.error("Python service error response data:", error.response.data);
      return { success: false, error: error.response.data, status: error.response.status };
    } else if (error.request) {
      console.error("Python service did not respond for enrollment:", error.message);
      return { success: false, error: { message: 'Python face service did not respond for enrollment.' }, status: 503 };
    }
    console.error("Error setting up request to Python service (enrollment):", error.message);
    return { success: false, error: { message: 'Network error or Python service unavailable for enrollment.' }, status: 503 };
  }
}

/**
 * Verifies a face with the Python face recognition service.
 * @param {string} idForVerification - The unique identifier for the employee (or user ID).
 * @param {string} imageBase64ToCheck - The base64 encoded image string to verify.
 * @returns {Promise<object>} Contains { success: boolean, data?: object, error?: object, status?: number }
 */
async function verifyFace(idForVerification, imageBase64ToCheck) {
  const endpoint = `${PYTHON_FACE_API_BASE_URL}/verify_face`;
  console.log(`NODE_API_CLIENT: Sending verification request for ID: ${idForVerification} to Python service at ${endpoint}. Image base64 length: ${imageBase64ToCheck ? imageBase64ToCheck.length : 'N/A'}`);
   if (!idForVerification || !imageBase64ToCheck) {
    console.error("NODE_API_CLIENT: verifyFace called with missing idForVerification or imageBase64ToCheck.");
    return { success: false, error: { message: 'ID and imageBase64ToCheck are required for verification.' }, status: 400 };
  }
  try {
    const response = await axios.post(endpoint, {
      employee_id: idForVerification, // Python service expects 'employee_id'
      image_base64_to_check: imageBase64ToCheck,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000 // 25 seconds timeout
    });
    console.log(`NODE_API_CLIENT: Verification response from Python for ${idForVerification}:`, response.data);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    console.error(`NODE_API_CLIENT: Error verifying face for ${idForVerification} with Python service.`);
    if (error.response) {
      console.error("Python service error response status:", error.response.status);
      console.error("Python service error response data:", error.response.data);
      return { success: false, error: error.response.data, status: error.response.status };
    } else if (error.request) {
      console.error("Python service did not respond for verification:", error.message);
      return { success: false, error: { message: 'Python face service did not respond for verification.' }, status: 503 };
    }
    console.error("Error setting up request to Python service (verification):", error.message);
    return { success: false, error: { message: 'Network error or Python service unavailable for verification.' }, status: 503 };
  }
}

module.exports = {
  enrollFace,
  verifyFace,
};