import path from "node:path";
import express, { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import catalogRouter from "./catalog";
import adminAuthRouter from "./admin-auth";
import adminProductsRouter from "./admin-products";
import adminProductImagesRouter from "./admin-product-images";
import adminArticlesRouter from "./admin-articles";
import adminOrdersRouter from "./admin-orders";
import adminOverviewRouter from "./admin-overview";
import adminMissionControlRouter from "./admin-mission-control";
import adminCopilotRouter from "./admin-copilot";
import adminAlertsRouter from "./admin-alerts";
import adminActivityRouter from "./admin-activity";
import adminCustomersRouter from "./admin-customers";
import adminTeamRouter, { acceptRouter as adminTeamAcceptRouter } from "./admin-team";
import adminShippingRouter from "./admin-shipping";
import shiprocketWebhookRouter from "./shiprocket-webhook";
import adminBusinessRouter from "./admin-business";
import adminDocumentsRouter from "./admin-documents";
import adminReturnsRouter from "./admin-returns";
import adminInventoryRouter from "./admin-inventory";
import adminSubscriptionsRouter from "./admin-subscriptions";
import adminLoyaltyRouter from "./admin-loyalty";
import adminGiftCardsRouter from "./admin-gift-cards";
import adminRecipesRouter from "./admin-recipes";
import messagesRouter from "./messages";
import experiencesRouter from "./experiences";
import adminExperiencesRouter from "./admin-experiences";
import adminBackupRouter from "./admin-backup";
import adminSeoRouter from "./admin-seo";
import adminSeoProRouter from "./admin-seo-pro";
import adminHomepageSeoRouter from "./admin-homepage-seo";
import adminContentRouter from "./admin-content";
import adminAnalyticsRouter from "./admin-analytics";
import eventsRouter from "./events";
import seoPublicRouter from "./seo-public";
import emailTrackingRouter from "./email-tracking";
import checkoutIntentRouter from "./checkout-intent";
import pushRouter from "./push";
import adminMarketingRouter from "./admin-marketing";
import adminCampaignsRouter from "./admin-campaigns";
import adminKeywordsRouter from "./admin-keywords";
import teaPassRouter from "./tea-pass";
import nudgesRouter from "./nudges";
import partnersRouter from "./partners";
import aiConciergeRouter from "./ai-concierge";
import paymentsRouter from "./payments";
import adminPaymentsRouter from "./admin-payments";
import checkoutPlaceRouter from "./checkout-place";
import shopperAuthRouter from "./shopper-auth";
import journalUgcRouter from "./journal-ugc";
import adminJournalRouter from "./admin-journal";
import teapediaRouter from "./teapedia";
import adminTeapediaRouter from "./admin-teapedia";
import franchiseRouter from "./franchise";
import wholesaleRouter from "./wholesale";
import loyaltyRouter from "./loyalty";
import giftCardsRouter from "./gift-cards";
import shopperOrdersRouter from "./shopper-orders";
import subscriptionsRouter from "./subscriptions";
import reviewsRouter from "./reviews";
import recipesRouter from "./recipes";
import contentHubRouter from "./content-hub";
import adminContentHubRouter from "./admin-content-hub";
import adminImagesRouter from "./admin-images";
import adminTrendsRouter from "./admin-trends";
import adminSocialRouter from "./admin-social";
import adminIntegrationsRouter from "./admin-integrations";
import adminDeployRouter from "./admin-deploy";
import publicTrendingRouter from "./trending";
import publicFeedRouter from "./feed";

const router: IRouter = Router();

// Static handler for AI-generated images stored on the local filesystem
// (Object Storage fallback used by self-hosted/VPS deploys without
// Replit Object Storage). Long-lived cache headers since filenames are
// content-hashed.
const LOCAL_IMAGES_DIR = path.resolve(process.cwd(), "uploads", "generated");
router.use(
  "/local-images",
  express.static(LOCAL_IMAGES_DIR, {
    maxAge: "365d",
    immutable: true,
    fallthrough: false,
  }),
);

router.use(healthRouter);
router.use(storageRouter);
router.use(catalogRouter);
router.use(experiencesRouter);
router.use(adminAuthRouter);
router.use(adminProductsRouter);
router.use(adminProductImagesRouter);
router.use(adminArticlesRouter);
router.use(adminOrdersRouter);
router.use(adminOverviewRouter);
router.use(adminMissionControlRouter);
router.use(adminCopilotRouter);
router.use(adminAlertsRouter);
router.use(adminActivityRouter);
router.use(adminCustomersRouter);
router.use(adminTeamAcceptRouter);
router.use(adminTeamRouter);
router.use(adminShippingRouter);
router.use(shiprocketWebhookRouter);
router.use(adminBusinessRouter);
router.use(adminDocumentsRouter);
router.use(adminReturnsRouter);
router.use(adminInventoryRouter);
router.use(adminSubscriptionsRouter);
router.use(adminLoyaltyRouter);
router.use(adminGiftCardsRouter);
router.use(adminRecipesRouter);
router.use(messagesRouter);
router.use(adminExperiencesRouter);
router.use(adminBackupRouter);
router.use(adminSeoRouter);
router.use(adminSeoProRouter);
router.use(adminHomepageSeoRouter);
router.use(adminContentRouter);
router.use(adminAnalyticsRouter);
router.use(eventsRouter);
router.use(emailTrackingRouter);
router.use(checkoutIntentRouter);
router.use(pushRouter);
router.use(adminMarketingRouter);
router.use(adminCampaignsRouter);
router.use(adminKeywordsRouter);
router.use(teaPassRouter);
router.use(nudgesRouter);
router.use(partnersRouter);
router.use(aiConciergeRouter);
router.use(paymentsRouter);
router.use(adminPaymentsRouter);
router.use(checkoutPlaceRouter);
router.use(shopperAuthRouter);
router.use(journalUgcRouter);
router.use(adminJournalRouter);
router.use(teapediaRouter);
router.use(adminTeapediaRouter);
router.use(franchiseRouter);
router.use(wholesaleRouter);
router.use(loyaltyRouter);
router.use(giftCardsRouter);
router.use(shopperOrdersRouter);
router.use(subscriptionsRouter);
router.use(reviewsRouter);
router.use(recipesRouter);
router.use(contentHubRouter);
router.use(adminContentHubRouter);
router.use(adminImagesRouter);
router.use(adminTrendsRouter);
router.use(adminSocialRouter);
router.use(adminIntegrationsRouter);
router.use(adminDeployRouter);
router.use(publicTrendingRouter);
router.use(publicFeedRouter);
// Public SEO assets are also exposed at /api/sitemap.xml etc. so the storefront
// (or a static deploy) can reverse-proxy them at the storefront root.
router.use(seoPublicRouter);

export default router;
