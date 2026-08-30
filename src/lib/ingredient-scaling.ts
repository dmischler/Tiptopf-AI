const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const REVERSE_UNICODE: Array<[number, string]> = [
  [0.5, '½'],
  [0.25, '¼'],
  [0.75, '¾'],
  [1 / 3, '⅓'],
  [2 / 3, '⅔'],
];

const KNOWN_UNITS = new Set([
  'g', 'kg', 'mg',
  'ml', 'l', 'cl', 'dl',
  'el', 'tl',
  'prise', 'prisen',
  'bund', 'bunde', 'bündel',
  'stück', 'stk', 'st',
  'dose', 'dosen',
  'blatt', 'blätter',
  'zweig', 'zweige',
  'zehe', 'zehen',
  'handvoll',
  'pck', 'pack', 'paket',
  'becher', 'glas', 'gläser',
  'tasse', 'tassen',
]);

interface ParsedIngredient {
  qualifier: string | null;
  amount: number | [number, number];
  rawUnit: string;
  unit: string;
  name: string;
}

const UNICODE_FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');
const MIXED_UNICODE_RE = new RegExp(`^(\\d+)\\s*([${UNICODE_FRACTION_CHARS}])`);

function parseNumberToken(s: string): { value: number | [number, number]; raw: string; consumed: number } | null {
  // Range first: 2-3 or 2 – 3 or 1,5-2,5
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (range) {
    const a = parseFloat(range[1].replace(',', '.'));
    const b = parseFloat(range[2].replace(',', '.'));
    return {
      value: a <= b ? [a, b] : [b, a],
      raw: range[0],
      consumed: range[0].length,
    };
  }

  // Mixed unicode: 1½ or 1 ½
  const mixedUnicode = s.match(MIXED_UNICODE_RE);
  if (mixedUnicode) {
    const whole = parseInt(mixedUnicode[1], 10);
    const frac = UNICODE_FRACTIONS[mixedUnicode[2]];
    if (frac !== undefined) {
      return {
        value: whole + frac,
        raw: mixedUnicode[0],
        consumed: mixedUnicode[0].length,
      };
    }
  }

  // Mixed ascii: 1 1/2
  const mixedAscii = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixedAscii) {
    const den = parseInt(mixedAscii[3], 10);
    if (den > 0) {
      return {
        value: parseInt(mixedAscii[1], 10) + parseInt(mixedAscii[2], 10) / den,
        raw: mixedAscii[0],
        consumed: mixedAscii[0].length,
      };
    }
  }

  // Unicode fraction
  const u = s[0];
  if (u && u in UNICODE_FRACTIONS) {
    return {
      value: UNICODE_FRACTIONS[u],
      raw: u,
      consumed: 1,
    };
  }

  // ASCII fraction 1/2
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const num = parseInt(frac[1], 10);
    const den = parseInt(frac[2], 10);
    if (den > 0) {
      return {
        value: num / den,
        raw: frac[0],
        consumed: frac[0].length,
      };
    }
  }

  // Decimal / integer (1,5 or 1.5 or 1)
  const num = s.match(/^(\d+)([.,](\d+))?/);
  if (num) {
    const val = parseFloat(num[0].replace(',', '.'));
    return {
      value: val,
      raw: num[0],
      consumed: num[0].length,
    };
  }

  return null;
}

function parseUnitAndRest(afterAmount: string): { rawUnit: string; unit: string; name: string } {
  const s = afterAmount.trimStart();
  if (!s) {
    return { rawUnit: '', unit: '', name: '' };
  }

  // Match leading token as potential unit
  const m = s.match(/^([A-Za-zÄÖÜäöüß]+)([\s,;:•·\-–—]*)(.*)$/);
  if (!m) {
    return { rawUnit: '', unit: '', name: s };
  }

  const token = m[1];
  const rest = (m[3] || '').trimStart();

  const lower = token.toLowerCase();
  if (KNOWN_UNITS.has(lower)) {
    return {
      rawUnit: token,
      unit: lower,
      name: rest,
    };
  }

  // Not a unit -> whole thing is name
  return { rawUnit: '', unit: '', name: s };
}

function parseIngredient(text: string): ParsedIngredient | null {
  if (!text || !text.trim()) return null;

  let s = text.trimStart();
  let qualifier: string | null = null;

  const qm = s.match(/^(ca\.?|etwa|ungefähr|rund|circa|approx\.?)\s+/i);
  if (qm) {
    qualifier = qm[1];
    s = s.slice(qm[0].length);
  }

  const num = parseNumberToken(s);
  if (!num) return null;

  const after = s.slice(num.consumed);
  const { rawUnit, unit, name } = parseUnitAndRest(after);

  return {
    qualifier,
    amount: num.value,
    rawUnit,
    unit,
    name: name.trim(),
  };
}

function formatAmount(n: number, isCount: boolean): string {
  if (isCount) {
    // round to nearest 0.5 for counts (Eier, Stück, etc.)
    const r = Math.round(n * 2) / 2;
    if (Math.abs(r - Math.round(r)) < 0.001) {
      return String(Math.round(r));
    }
    return r.toFixed(1).replace(/\.0$/, '');
  }

  if (n < 1) {
    return n.toFixed(2).replace(/\.?0+$/, '');
  }
  if (n <= 10) {
    const s = n.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }
  return String(Math.round(n));
}

export function scaleIngredient(ingredient: string, ratio: number): string {
  if (ratio === 1 || !ingredient.trim()) return ingredient;

  const parsed = parseIngredient(ingredient);
  if (!parsed) return ingredient;

  const { qualifier, amount, rawUnit, name } = parsed;

  let scaled: number | [number, number];
  if (Array.isArray(amount)) {
    scaled = [amount[0] * ratio, amount[1] * ratio];
  } else {
    scaled = amount * ratio;
  }

  const isCount = /\b(ei|eier|stück|stk)\b/i.test(name + ' ' + rawUnit);

  let amountStr: string;
  if (Array.isArray(scaled)) {
    const [lo, hi] = scaled[0] <= scaled[1] ? scaled : [scaled[1], scaled[0]];
    amountStr = `${formatAmount(lo, isCount)}-${formatAmount(hi, isCount)}`;
  } else {
    amountStr = formatAmount(scaled, isCount);
  }

  const q = qualifier ? qualifier + ' ' : '';
  const u = rawUnit ? rawUnit : '';

  // Rebuild with sensible spacing
  let out = q + amountStr;
  if (u) out += ' ' + u;
  if (name) out += (u || amountStr ? ' ' : '') + name;

  return out.trim();
}

// Helper for debugging / future use
export function canScale(ingredient: string): boolean {
  return parseIngredient(ingredient) !== null;
}
