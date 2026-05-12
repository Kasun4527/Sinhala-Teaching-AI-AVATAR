/**
 * Normalizes legacy Sinhala font encoding (FMAbhaya/Bhashitha/DL-Saman style) to Unicode.
 * This handles the specific character mappings found in the Buddhism curriculum database.
 */
export function normalizeSinhalaText(input: string | undefined): string {
  if (!input) return "";

  // If input already looks like Unicode (has non-ASCII chars beyond the legacy ones), return as is.
  // Note: Some legacy chars are in the 0x80-0xFF range (like ÿ), so we check carefully.
  if (/[^\x00-\xFF]/.test(input)) {
    return input;
  }

  // Definitive Bhashitha/FMAbhaya Mapping
  const map: Record<string, string> = {
    "w": "අ", "W": "උ", "b": "ඉ", "t": "එ",
    "f": "ෙ", "e": "ෙ", // Kombuwas
    "n": "බ", "i": "ස", ";": "ත", "a": "්", "d": "ා", "o": "ද", "h": "ය",
    "N": "භ", "s": "ි", ".": "ග", "c": "ජ", "m": "ප", "[": "ං", "p": "ච",
    "u": "ම", "y": "හ", "ú": "වි", ",": "ල", "l": "ක", "k": "න", "r": "ර",
    "j": "ව", "v": "ඩ", "ÿ": "දු", "=": "ු", "I": "ි", "S": "ී", "K": "ණ",
    "L": "ළ", "M": "ං", "x": "ං", "Y": "ඤ", "Z": "ඥ", "P": "ඡ", "Q": "ඪ",
    "R": "ඍ", "T": "ඔ", "U": "ඌ", "V": "ඓ", "X": "ඞ", "G": "ඟ", "J": "ඦ",
    "H": "ඃ", "C": "ඣ", "B": "ඊ", "A": "ඇ", "g": "ට",
    " ": " ", ":": ":", "?": "?", "-": "-", 
    "(": "(", ")": ")", "•": "•", "0": "0", "1": "1", "2": "2", "3": "3",
    "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9"
  };

  let result = "";
  let i = 0;
  const chars = Array.from(input);

  while (i < chars.length) {
    const char = chars[i];
    const next = chars[i + 1];
    const nextNext = chars[i + 2];

    // 1. Handle O-pilla combination: Kombuwa + Root + A-pilla -> ෝ
    if ((char === 'f' || char === 'e') && next && (nextNext === 'd' || nextNext === 'o' || nextNext === 'h')) {
      const root = map[next] || next;
      result += root + "ෝ";
      i += 3;
      continue;
    }

    // 2. Handle E-pilla (Kombuwa): Kombuwa + Root -> ෙ
    if ((char === 'f' || char === 'e') && next) {
      const root = map[next] || next;
      result += root + "ෙ";
      i += 2;
      continue;
    }

    // 4. Default Mapping
    result += map[char] || char;
    i++;
  }

  // Cleanup: Fix remaining combining character order issues
  return result
    .replace(/ො/g, "ෝ")
    .replace(/ේ/g, "ේ")
    .replace(/්ා/g, "ා")
    .replace(/්ි/g, "ි")
    .replace(/්ී/g, "ී")
    .replace(/්ු/g, "ු")
    .replace(/්ූ/g, "ූ");
}
