// Blocklist of slurs and extreme profanity for filtering player names and catchphrases.
// This is not exhaustive but catches the most common offensive terms.
const BLOCKED_WORDS = [
  // Racial slurs
  'nigger', 'nigga', 'nigg3r', 'n1gger', 'n1gga',
  'chink', 'ch1nk', 'gook', 'g00k', 'spic', 'sp1c',
  'wetback', 'beaner', 'kike', 'k1ke', 'kyke',
  'coon', 'c00n', 'darkie', 'raghead', 'towelhead',
  'redskin', 'pajeet', 'zipperhead',
  'cracker', 'honky', 'gringo',
  // Homophobic slurs
  'faggot', 'f4ggot', 'fagg0t', 'fag', 'f4g',
  'dyke', 'tranny', 'tr4nny',
  // Extreme profanity
  'fuck', 'fuk', 'fck', 'f_ck', 'fu_k', 'phuck', 'phuk',
  'shit', 'sh1t', 'sht', 'sh!t',
  'bitch', 'b1tch', 'b!tch',
  'cunt', 'c_nt', 'cnt',
  'cock', 'c0ck', 'dick', 'd1ck',
  'pussy', 'pu55y',
  'ass', 'a55',
  'retard', 'r3tard', 'ret4rd',
  // Nazi / hate
  'nazi', 'n4zi', 'hitler', 'h1tler', 'heil',
  'whitepower', 'whitepow3r', 'sieg',
  // Sexual
  'rape', 'r4pe', 'molest', 'pedo', 'ped0', 'pedophile',
];

// Build a single regex at load time for performance
// Escape special regex chars in blocked words, then join with |
const escaped = BLOCKED_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const PATTERN = new RegExp('(' + escaped.join('|') + ')', 'gi');

function filterText(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(PATTERN, (match) => '*'.repeat(match.length));
}

module.exports = { filterText };
