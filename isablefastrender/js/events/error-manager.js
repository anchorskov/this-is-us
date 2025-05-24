// static/js/events/error-manager.js

/**
 * Centralized error message handling based on known error codes.
 * If a code is unrecognized, default to the message provided or a fallback.
 *
 * @param {string} code - Optional structured error code returned by the server.
 * @param {string} message - Optional plain message fallback.
 * @returns {string} - Message to show to the user.
 */
export function getUserFriendlyError(code, message) {
  switch (code) {
    case 'DUPLICATE_PDF':
      return 'An event with this file has already been submitted. Try changing the file or event details.';
    case 'MISSING_FIELDS':
      return 'Please fill out all required fields and upload a file.';
    case 'INVALID_FILE':
      return 'The uploaded file is invalid or unsupported.';
    case 'UPLOAD_ERROR':
      return 'There was a problem uploading the file. Please try again.';
    case 'DB_ERROR':
      return 'There was a problem saving your event. Please try again.';
    default:
      return message || 'Something went wrong. Please try again.';
  }
}
