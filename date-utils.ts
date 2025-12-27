/**
 * Date formatting utilities
 * Shared functions for formatting dates in EST/EDT timezone
 */

/**
 * Format a date string to "[Month Day Hour:Minute AM/PM]" format in EST/EDT
 * @param isoDateString - ISO date string or Date object
 * @returns Formatted date string like "[Dec 27 2:30 PM]"
 */
export function formatPubDate(isoDateString?: string | Date | number): string {
  if (!isoDateString) return "[New]"; // Fallback if no date provided

  const date = typeof isoDateString === 'string' || typeof isoDateString === 'number'
    ? new Date(isoDateString)
    : isoDateString;
  
  if (isNaN(date.getTime())) {
    return "[New]";
  }

  // Format: "Dec 27 2:30 PM" in EST/EDT (America/New_York timezone)
  // Using toLocaleString with timezone option for each component to handle EST/EDT automatically
  const timeZone = 'America/New_York';
  
  const month = date.toLocaleString('en-US', { timeZone, month: 'short' });
  const day = parseInt(date.toLocaleString('en-US', { timeZone, day: 'numeric' }));
  const hour24 = parseInt(date.toLocaleString('en-US', { timeZone, hour: 'numeric', hour12: false }));
  const minute = parseInt(date.toLocaleString('en-US', { timeZone, minute: 'numeric' }));
  
  // Convert 24-hour to 12-hour format
  let hour12 = hour24 % 12;
  hour12 = hour12 ? hour12 : 12; // the hour '0' should be '12'
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const minutePadded = minute.toString().padStart(2, '0');

  return `[${month} ${day} ${hour12}:${minutePadded} ${ampm}]`;
}

