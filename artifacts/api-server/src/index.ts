import app from "./app";
import { logger } from "./lib/logger";
import { seedExperiences } from "./lib/seed-experiences";
import { seedTeawares } from "./lib/seed-teawares";
import { startBackupCron } from "./lib/backups";
import { startContentTrendsCron } from "./lib/content-trends-cron";
import { startAnalyticsInsightsCron } from "./lib/analytics-insights-cron";
import { startAbandonedCartCron } from "./lib/abandoned-cart-cron";
import { startKeywordRankCron } from "./lib/keyword-rank-cron";
import { startJournalCron } from "./lib/journal-cron";
import { startTeapediaCron } from "./lib/teapedia-cron";
import { startContentHubCron } from "./lib/content-hub-cron";
import { startRecipesCron } from "./lib/recipes-cron";
import { startDispatchCron } from "./lib/dispatch-cron";
import { startAutoPublishCron } from "./lib/auto-publish-cron";
import { startTrendIngestCron } from "./lib/trend-ingest-cron";
import { startSocialTweetCron } from "./lib/social-tweet-cron";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void seedExperiences();
  void seedTeawares();
  startBackupCron();
  startContentTrendsCron();
  startAnalyticsInsightsCron();
  startAbandonedCartCron();
  startKeywordRankCron();
  startJournalCron();
  startTeapediaCron();
  startContentHubCron();
  startRecipesCron();
  startDispatchCron();
  startAutoPublishCron();
  startTrendIngestCron();
  startSocialTweetCron();
});
