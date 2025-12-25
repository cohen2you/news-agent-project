/**
 * Top 20 stocks for PR monitoring
 * Selected stocks for automated PR monitoring
 */
export const MONITORED_STOCKS = [
  'NVDA',  // Nvidia
  'MSFT',  // Microsoft
  'AAPL',  // Apple
  'AMZN',  // Amazon
  'GOOGL', // Alphabet (Google) - using GOOGL
  'META',  // Meta Platforms (Facebook)
  'AVGO',  // Broadcom
  'BRK.B', // Berkshire Hathaway
  'LLY',   // Eli Lilly & Co.
  'TSLA',  // Tesla
  'JPM',   // JPMorgan Chase
  'V',     // Visa
  'COST',  // Costco Wholesale
  'XOM',   // Exxon Mobil
  'WMT',   // Walmart
  'JNJ',   // Johnson & Johnson
  'PG',    // Procter & Gamble
  'HD',    // Home Depot
  'UNH',   // UnitedHealth Group
  'ABBV'   // AbbVie
];

/**
 * Top 100 S&P 500 stocks by market cap (kept for backward compatibility)
 * Used for monitoring PRs and news
 */
export const SP500_TOP_100 = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'V', 'UNH',
  'XOM', 'JNJ', 'JPM', 'WMT', 'MA', 'PG', 'AVGO', 'HD', 'COST', 'MRK',
  'ABBV', 'PEP', 'CVX', 'ADBE', 'CSCO', 'TMO', 'MCD', 'ABT', 'ACN', 'NFLX',
  'CRM', 'LIN', 'AMD', 'DIS', 'VZ', 'NKE', 'PM', 'TXN', 'CMCSA', 'DHR',
  'NEE', 'RTX', 'HON', 'UPS', 'QCOM', 'AMGN', 'BMY', 'T', 'INTU', 'SPGI',
  'AXP', 'LOW', 'AMAT', 'BKNG', 'GE', 'PLD', 'DE', 'ADI', 'SBUX', 'GS',
  'SYK', 'ELV', 'BLK', 'C', 'ADP', 'TJX', 'GILD', 'MDT', 'ZTS', 'MO',
  'ISRG', 'REGN', 'MMC', 'CI', 'VRTX', 'WM', 'KLAC', 'SNPS', 'CDNS', 'APH',
  'MCO', 'FTNT', 'NXPI', 'AON', 'ITW', 'CTSH', 'EQIX', 'ICE', 'FAST', 'ANET',
  'MCHP', 'IDXX', 'PAYX', 'ODFL', 'CPRT', 'CTVA', 'WBD', 'ON', 'CDW', 'FERG'
];

/**
 * Get a subset of tickers for testing or reduced monitoring
 */
export function getTickersForMonitoring(limit: number = 100): string[] {
  return SP500_TOP_100.slice(0, limit);
}

