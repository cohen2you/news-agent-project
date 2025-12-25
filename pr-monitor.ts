/**
 * PR Monitor Service
 * Monitors press releases for S&P 500 stocks
 */

import { fetchBenzingaNews } from './benzinga-api';
import { SP500_TOP_100 } from './sp500-tickers';

export interface MonitoredPR {
  ticker: string;
  articles: any[];
  lastChecked: Date;
  lastUpdate: Date | null;
}

export class PRMonitor {
  private monitoredPRs: Map<string, MonitoredPR> = new Map();
  private updateInterval: number = 5 * 60 * 1000; // 5 minutes default
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private apiKey: string;
  private onNewPRs?: (ticker: string, newArticles: any[]) => void;

  constructor(apiKey: string, updateIntervalMinutes: number = 5) {
    this.apiKey = apiKey;
    this.updateInterval = updateIntervalMinutes * 60 * 1000;
  }

  /**
   * Set callback for when new PRs are detected
   */
  setOnNewPRsCallback(callback: (ticker: string, newArticles: any[]) => void) {
    this.onNewPRs = callback;
  }

  /**
   * Start monitoring PRs for specified tickers
   */
  async startMonitoring(tickers: string[] = SP500_TOP_100.slice(0, 100)) {
    if (this.isRunning) {
      console.log('⚠️  PR Monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting PR Monitor for ${tickers.length} tickers (updating every ${this.updateInterval / 60000} minutes)`);

    // Initial check - load immediately
    console.log('📡 Loading initial PRs...');
    await this.checkAllTickers(tickers);

    // Set up interval
    this.intervalId = setInterval(async () => {
      await this.checkAllTickers(tickers);
    }, this.updateInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 PR Monitor stopped');
  }

  /**
   * Check all tickers for new PRs
   */
  private async checkAllTickers(tickers: string[]) {
    console.log(`\n📡 Checking PRs for ${tickers.length} tickers...`);
    const startTime = Date.now();

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      await Promise.all(
        batch.map(ticker => this.checkTicker(ticker))
      );
      
      // Small delay between batches
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Completed PR check in ${duration}s`);
  }

  /**
   * Check a single ticker for new PRs
   */
  private async checkTicker(ticker: string) {
    try {
      const articles = await fetchBenzingaNews(ticker, this.apiKey, 10, true); // prOnly = true, get 10 most recent
      
      const existing = this.monitoredPRs.get(ticker);
      const lastArticleId = existing?.articles[0]?.id;

      // Find new articles (not in previous check)
      const newArticles = existing
        ? articles.filter(article => article.id !== lastArticleId && 
            !existing.articles.some(existing => existing.id === article.id))
        : articles;

      // Always update monitored data (even if no new PRs, we want the latest)
      this.monitoredPRs.set(ticker, {
        ticker,
        articles: articles,
        lastChecked: new Date(),
        lastUpdate: newArticles.length > 0 ? new Date() : (existing?.lastUpdate || null)
      });

      if (newArticles.length > 0) {
        console.log(`   🆕 ${ticker}: Found ${newArticles.length} new PR(s)`);
        
        // Notify callback
        if (this.onNewPRs) {
          this.onNewPRs(ticker, newArticles);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error checking ${ticker}:`, error);
      // Still update last checked time even on error
      const existing = this.monitoredPRs.get(ticker);
      if (existing) {
        existing.lastChecked = new Date();
      }
    }
  }

  /**
   * Get current status of all monitored tickers
   */
  getStatus(): Array<{ ticker: string; articleCount: number; lastUpdate: Date | null }> {
    return Array.from(this.monitoredPRs.values()).map(pr => ({
      ticker: pr.ticker,
      articleCount: pr.articles.length,
      lastUpdate: pr.lastUpdate
    }));
  }

  /**
   * Get recent PRs across all tickers
   */
  getRecentPRs(limit: number = 10): any[] {
    const allPRs: Array<{ article: any; ticker: string; timestamp: Date }> = [];

    this.monitoredPRs.forEach((pr) => {
      pr.articles.forEach(article => {
        allPRs.push({
          article,
          ticker: pr.ticker,
          timestamp: new Date(article.created * 1000)
        });
      });
    });

    // Sort by date (newest first) and return top N
    return allPRs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
      .map(item => ({ ...item.article, ticker: item.ticker }));
  }

  /**
   * Check if monitor is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

