// validation-utils.js — Reusable field validation utilities

export function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
  }
  
  export function isValidPhone(phone) {
    return /^\+?[0-9\s\-()]{7,}$/.test(phone);
  }
  
  export function isFutureDate(dateStr) {
    const now = new Date();
    const inputDate = new Date(dateStr);
    return inputDate > now;
  }
  
  export function areRequiredFieldsPresent(fields) {
    return fields.every(f => f && f.trim && f.trim().length > 0);
  }  