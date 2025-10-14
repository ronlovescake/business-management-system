/**
 * CSV Utilities Module
 *
 * Reusable functions for CSV import/export operations
 */

/**
 * Escape CSV values properly
 * Handles commas, quotes, and newlines
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // Escape double quotes and wrap in quotes if contains comma, quote, or newline
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Parse a CSV line properly (handles quoted values)
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Export data to CSV file
 *
 * @param data - Array of objects to export
 * @param headers - Column headers
 * @param filename - Output filename (without extension)
 * @param mapRowFn - Function to map data row to CSV values
 */
export function exportToCSV<T>(
  data: T[],
  headers: string[],
  filename: string,
  mapRowFn: (item: T) => (string | number | null | undefined)[]
): void {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Convert data to CSV rows
  const rows = data.map((item) => {
    const values = mapRowFn(item);
    return values.map((val) => escapeCSV(val)).join(',');
  });

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  // Generate filename with current date
  const date = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}_${date}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', fullFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Validate CSV headers
 *
 * @param headers - Headers from CSV file
 * @param requiredColumns - Array of required column names
 * @returns Array of missing columns (empty if valid)
 */
export function validateCSVHeaders(
  headers: string[],
  requiredColumns: string[]
): string[] {
  return requiredColumns.filter((col) => !headers.includes(col));
}
