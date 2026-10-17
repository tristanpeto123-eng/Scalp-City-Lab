// READ-ONLY MARKET RESEARCH registry. Expands historical simulations ONLY.
// This module is NEVER imported by the broker adapter's paperOrder allowlist.
export const CRYPTO_RESEARCH_ONLY=Object.freeze([
 'SOL/USD','XRP/USD','ADA/USD','AVAX/USD',
 'LINK/USD','DOGE/USD','LTC/USD','BCH/USD'
]);
export const CRYPTO_RESEARCH_MARKETS=Object.freeze(['BTC/USD','ETH/USD',...CRYPTO_RESEARCH_ONLY]);
export function isResearchCrypto(symbol){return CRYPTO_RESEARCH_MARKETS.includes(symbol);}
