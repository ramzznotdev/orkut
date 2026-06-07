/**
 * QRIS Dynamic Generator
 * Converts static QRIS to dynamic QRIS with specific amount
 */

// CRC16-CCITT calculation
function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Parse TLV structure
function parseTLV(qris: string): Map<string, string> {
  const result = new Map<string, string>();
  let i = 0;
  while (i < qris.length - 4) { // -4 to exclude CRC
    const tag = qris.substring(i, i + 2);
    const len = parseInt(qris.substring(i + 2, i + 4), 10);
    const value = qris.substring(i + 4, i + 4 + len);
    result.set(tag, value);
    i += 4 + len;
  }
  return result;
}

// Build TLV string from map
function buildTLV(tlvMap: Map<string, string>, tagOrder: string[]): string {
  let result = '';
  for (const tag of tagOrder) {
    if (tlvMap.has(tag)) {
      const value = tlvMap.get(tag)!;
      result += tag + value.length.toString().padStart(2, '0') + value;
    }
  }
  return result;
}

/**
 * Convert static QRIS to dynamic QRIS with amount
 */
export function generateDynamicQris(staticQris: string, amount: number): string {
  // Standard QRIS tag order
  const tagOrder = ['00', '01', '26', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63'];
  
  // Parse existing QRIS
  const tlvMap = parseTLV(staticQris);
  
  // Change Tag 01: 11 (static) -> 12 (dynamic)
  tlvMap.set('01', '12');
  
  // Add Tag 54: Transaction Amount
  tlvMap.set('54', amount.toString());
  
  // Build string without CRC
  let qrisWithoutCrc = buildTLV(tlvMap, tagOrder);
  
  // Add CRC placeholder
  qrisWithoutCrc += '6304';
  
  // Calculate and append CRC
  const crc = crc16ccitt(qrisWithoutCrc);
  
  return qrisWithoutCrc + crc;
}

/**
 * Validate QRIS string by checking CRC
 */
export function validateQris(qris: string): boolean {
  if (qris.length < 8) return false;
  
  const dataWithoutCrc = qris.slice(0, -4);
  const providedCrc = qris.slice(-4);
  const calculatedCrc = crc16ccitt(dataWithoutCrc);
  
  return providedCrc.toUpperCase() === calculatedCrc;
}
