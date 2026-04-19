const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

function toSuperscript(n: number): string {
  return String(n).split('').map(c => SUPERSCRIPT_DIGITS[c] ?? c).join('');
}

/**
 * Format a currency value for human-readable display.
 *
 * - < £1,000,000: exact with commas (no tilde)
 * - £1M–£999M: "~£12.4 million"
 * - £1B–£999B: "~£3.2 billion"
 * - £1T–£999T: "~£8.7 trillion"
 * - £10^15–£10^17: "~£4.3 quadrillion"
 * - £10^18+: "~£3.2 × 10²³"
 */
export function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs < 1_000_000) {
    return sign + '£' + Math.round(abs).toLocaleString('en-GB');
  }

  const tiers: [number, string][] = [
    [1e18, ''],           // fall through to scientific
    [1e15, 'quadrillion'],
    [1e12, 'trillion'],
    [1e9,  'billion'],
    [1e6,  'million'],
  ];

  for (const [threshold, word] of tiers) {
    if (abs >= threshold) {
      if (!word) {
        // Scientific notation for very large values
        const exp = Math.floor(Math.log10(abs));
        const mantissa = abs / Math.pow(10, exp);
        return `${sign}~£${mantissa.toFixed(1)} × 10${toSuperscript(exp)}`;
      }
      const scaled = abs / threshold;
      return `${sign}~£${scaled.toFixed(1)} ${word}`;
    }
  }

  // Shouldn't reach here, but fallback
  return sign + '£' + Math.round(abs).toLocaleString('en-GB');
}
