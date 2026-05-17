import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { useHomepageSeo } from "@/hooks/use-homepage-seo";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/layout/CartDrawer";
import SignInDialog from "@/components/account/SignInDialog";
import BottomNav from "@/components/layout/BottomNav";
import SearchOverlay from "@/components/layout/SearchOverlay";
import NudgePopup from "@/components/NudgePopup";
import PageTransition from "@/components/PageTransition";
import CartAbandonNudge from "@/components/CartAbandonNudge";
import CurrencyAutoDetect from "@/components/CurrencyAutoDetect";
import OfflineBanner from "@/components/OfflineBanner";
import CartSync from "@/components/CartSync";
import CartRestore from "@/components/CartRestore";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import UpdatePrompt from "@/components/UpdatePrompt";
import ReleaseNotes from "@/components/ReleaseNotes";
import ThemeApplier from "@/components/ThemeApplier";
import ExperienceBanner from "@/components/experience/ExperienceBanner";
import ExperienceParticles from "@/components/experience/ExperienceParticles";

import Home from "@/pages/home";
import Shop from "@/pages/shop";
import ProductDetail from "@/pages/product";
import Account from "@/pages/account";
import About from "@/pages/about";
import Quiz from "@/pages/quiz";
import TeaPass from "@/pages/tea-pass";
import Partners from "@/pages/partners";
import Journal from "@/pages/journal";
import JournalArticle from "@/pages/journal-article";
import Teapedia from "@/pages/teapedia";
import TeapediaEntry from "@/pages/teapedia-entry";
import JournalTagPage from "@/pages/journal-tag";
import TeapediaTagPage from "@/pages/teapedia-tag";
import Recipes from "@/pages/recipes";
import RecipePage from "@/pages/recipe";
import Pairings from "@/pages/pairings";
import Wellness from "@/pages/wellness";
import TeaCulture from "@/pages/tea-culture";
import ContentEntry from "@/pages/content-entry";
import WinTrip from "@/pages/win-trip";
import Staycation from "@/pages/staycation";
import Checkout from "@/pages/checkout";
import OrderConfirmed from "@/pages/order-confirmed";
import PrivacyPolicy from "@/pages/policies/privacy";
import TermsAndConditions from "@/pages/policies/terms";
import ShippingPolicy from "@/pages/policies/shipping";
import RefundPolicy from "@/pages/policies/refunds";
import ContactPage from "@/pages/policies/contact";
import Franchise from "@/pages/franchise";
import Wholesale from "@/pages/wholesale";
import Rewards from "@/pages/rewards";
import GiftCards from "@/pages/gift-cards";
import PrintCard from "@/pages/print-card";
const AdminLogin = lazy(() => import("@/pages/admin/login"));
const AdminDashboard = lazy(() => import("@/pages/admin/index"));
const AdminAcceptInvite = lazy(() => import("@/pages/admin/AcceptInvite"));
import PushOptIn from "@/components/PushOptIn";
import { useEffect } from "react";
import { Redirect } from "wouter";

const queryClient = new QueryClient();

function LegacyRedirect({ to }: { to: string }) {
  return <Redirect to={to} />;
}

function WishlistRoute() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/account#wishlist', { replace: true });
  }, [setLocation]);
  return null;
}

// Default robots policy for all indexable pages. Re-applied on every SPA
// navigation so that noindex pages (cart, checkout, account, order-confirmed)
// can never leak their <meta name="robots" content="noindex"> into the next
// route — even if that next route forgets to mount <Seo>.
const DEFAULT_ROBOTS =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

function Router() {
  const [location] = useLocation();
  const homeSeo = useHomepageSeo();
  useEffect(() => {
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "robots");
      document.head.appendChild(el);
    }
    el.setAttribute("content", DEFAULT_ROBOTS);
  }, [location]);
  // Apply admin-controlled meta keywords site-wide. Per-page Seo components
  // override this for product/article pages, which is desired — those have
  // long-tail keywords specific to the entity.
  useEffect(() => {
    const kws = homeSeo.metaKeywords.filter(Boolean).join(", ");
    if (!kws) return;
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="keywords"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "keywords");
      document.head.appendChild(el);
    }
    el.setAttribute("content", kws);
  }, [homeSeo.metaKeywords]);
  if (location.startsWith("/admin")) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
        <Switch>
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin/accept-invite" component={AdminAcceptInvite} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/:rest*">{() => <LegacyRedirect to="/admin" />}</Route>
        </Switch>
      </Suspense>
    );
  }
  return (
    <div className="flex flex-col min-h-screen">
      <OfflineBanner />
      <Header />
      <ExperienceBanner />
      <ExperienceParticles />
      <CartDrawer />
      <SearchOverlay />
      <SignInDialog />
      <NudgePopup />
      <main className="flex-1">
        <PageTransition>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/shop" component={Shop} />
            <Route path="/shop/:category" component={Shop} />
            <Route path="/product/:slug" component={ProductDetail} />
            <Route path="/account" component={Account} />
            <Route path="/about" component={About} />
            <Route path="/quiz" component={Quiz} />
            <Route path="/tea-pass" component={TeaPass} />
            <Route path="/partners" component={Partners} />
            <Route path="/invest" component={Partners} />
            <Route path="/kickstarter" component={Partners} />
            <Route path="/journal" component={Journal} />
            <Route path="/journal/tag/:tag" component={JournalTagPage} />
            <Route path="/journal/:slug" component={JournalArticle} />
            <Route path="/teapedia" component={Teapedia} />
            <Route path="/teapedia/tag/:tag" component={TeapediaTagPage} />
            <Route path="/teapedia/:slug" component={TeapediaEntry} />
            <Route path="/recipes" component={Recipes} />
            <Route path="/recipes/:slug" component={RecipePage} />
            <Route path="/pairings" component={Pairings} />
            <Route path="/pairings/:slug">
              {() => <ContentEntry hub="pairing" />}
            </Route>
            <Route path="/wellness" component={Wellness} />
            <Route path="/wellness/:slug">
              {() => <ContentEntry hub="wellness" />}
            </Route>
            <Route path="/tea-culture" component={TeaCulture} />
            <Route path="/tea-culture/:slug">
              {() => <ContentEntry hub="regional" />}
            </Route>
            <Route path="/staycation" component={Staycation} />
            <Route path="/jorhat-staycation" component={Staycation} />
            <Route path="/win-a-trip" component={WinTrip} />
            <Route path="/franchise" component={Franchise} />
            <Route path="/wholesale" component={Wholesale} />
            <Route path="/b2b">{() => <LegacyRedirect to="/wholesale" />}</Route>
            <Route path="/rewards" component={Rewards} />
            <Route path="/gift-cards" component={GiftCards} />
            <Route path="/print-card/:code" component={PrintCard} />
            <Route path="/checkout" component={Checkout} />
            <Route path="/order-confirmed/:id" component={OrderConfirmed} />
            <Route path="/privacy" component={PrivacyPolicy} />
            <Route path="/terms" component={TermsAndConditions} />
            <Route path="/shipping" component={ShippingPolicy} />
            <Route path="/refunds" component={RefundPolicy} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/wishlist" component={WishlistRoute} />
            <Route path="/products">{() => <LegacyRedirect to="/shop" />}</Route>
            <Route path="/products/:rest*">{() => <LegacyRedirect to="/shop" />}</Route>
            <Route path="/blog">{() => <LegacyRedirect to="/" />}</Route>
            <Route path="/blog/:rest*">{() => <LegacyRedirect to="/" />}</Route>
            <Route component={NotFound} />
          </Switch>
        </PageTransition>
      </main>
      <CartAbandonNudge />
      <CurrencyAutoDetect />
      <CartSync />
      <CartRestore />
      <AnalyticsTracker />
      <Footer />
      <div className="h-16 sm:hidden" aria-hidden="true" />
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <UpdatePrompt />
        <ReleaseNotes />
        <PushOptIn />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;