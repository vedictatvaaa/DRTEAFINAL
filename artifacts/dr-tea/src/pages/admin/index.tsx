import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAdminMe, useAdminLogout, getAdminMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  BookOpen,
  Sparkles,
  ShoppingCart,
  CreditCard,
  HardDriveDownload,
  Search,
  Megaphone,
  Rocket,
  BarChart3,
  Users,
  Wand2,
  Palette,
  Menu,
  X,
  LogOut,
  ExternalLink,
  ChevronDown,
  Command,
  Activity as ActivityIcon,
  Users as UsersIcon,
  UserCog,
  Truck as TruckIcon,
  Repeat,
  Building2,
  MessageSquare,
  Star,
  RotateCcw,
  Award,
  Gift,
  ChefHat,
  Bell as BellIcon,
  Settings,
} from "lucide-react";
import CopilotPalette from "./CopilotPalette";
import AlertsBell from "./AlertsBell";
import MissionControlTab from "./tabs/mission-control";
import ProductsTab from "./tabs/products";
import ArticlesTab from "./tabs/articles";
import OrdersTab from "./tabs/orders";
import ExperienceTab from "./tabs/experience";
import BackupTab from "./tabs/backup";
import SeoTab from "./tabs/seo";
import ContentStudioTab from "./tabs/content-studio";
import AnalyticsTab from "./tabs/analytics";
import MarketingTab from "./tabs/marketing";
import CampaignsTab from "./tabs/campaigns";
import PaymentsTab from "./tabs/payments";
import CommunityTab from "./tabs/community";
import TeapediaTab from "./tabs/teapedia";
import ActivityTab from "./tabs/activity";
import CustomersTab from "./tabs/customers";
import TeamTab from "./tabs/team";
import ShippingTab from "./tabs/shipping";
import InventoryTab from "./tabs/inventory";
import SubscriptionsTab from "./tabs/subscriptions";
import WholesaleTab from "./tabs/wholesale";
import MessagesTab from "./tabs/messages";
import ReviewsTab from "./tabs/reviews";
import ReturnsTab from "./tabs/returns";
import LoyaltyTab from "./tabs/loyalty";
import GiftCardsTab from "./tabs/gift-cards";
import RecipesTab from "./tabs/recipes";
import ContentHubTab from "./tabs/content-hub";
import FranchiseTab from "./tabs/franchise";
import PushTab from "./tabs/push";
import BusinessTab from "./tabs/business";
import TrendsTab from "./tabs/trends";
import SocialTab from "./tabs/social";
import IntegrationsTab from "./tabs/integrations";
import DeployTab from "./tabs/deploy";
import SeoDashboardTab from "./tabs/seo-dashboard";
import SeoEditorTab from "./tabs/seo-editor";
import SeoKeywordsTab from "./tabs/seo-keywords";
import NudgesTab from "./tabs/nudges";
import SeoBacklinksTab from "./tabs/seo-backlinks";
import SeoOutreachTab from "./tabs/seo-outreach";
import SeoBriefTab from "./tabs/seo-brief";
import Logo from "@/components/brand/Logo";

type TabId =
  | "overview"
  | "products"
  | "articles"
  | "teapedia"
  | "orders"
  | "payments"
  | "backup"
  | "seo"
  | "marketing"
  | "campaigns"
  | "analytics"
  | "community"
  | "content"
  | "experience"
  | "activity"
  | "customers"
  | "team"
  | "shipping"
  | "inventory"
  | "subscriptions"
  | "wholesale"
  | "messages"
  | "reviews"
  | "returns"
  | "loyalty"
  | "gift-cards"
  | "recipes"
  | "content-hub"
  | "franchise"
  | "push"
  | "business"
  | "trends"
  | "social"
  | "integrations"
  | "deploy"
  | "seo-dashboard"
  | "seo-editor"
  | "seo-keywords"
  | "seo-backlinks"
  | "seo-outreach"
  | "seo-brief"
  | "nudges";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Storefront",
    items: [
      { id: "overview", label: "Mission Control", icon: LayoutDashboard },
      { id: "products", label: "Products", icon: Package },
      { id: "articles", label: "Journal", icon: BookOpen },
      { id: "teapedia", label: "Teapedia", icon: Sparkles },
      { id: "recipes", label: "Recipes", icon: ChefHat },
      { id: "content-hub", label: "Content Hub", icon: Wand2 },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "orders", label: "Orders", icon: ShoppingCart },
      { id: "shipping", label: "Shipping", icon: TruckIcon },
      { id: "returns", label: "Returns", icon: RotateCcw },
      { id: "inventory", label: "Inventory", icon: Package },
      { id: "subscriptions", label: "Subscriptions", icon: Repeat },
      { id: "wholesale", label: "Wholesale", icon: Building2 },
      { id: "franchise", label: "Franchise", icon: Building2 },
      { id: "messages", label: "Messages", icon: MessageSquare },
      { id: "push", label: "Push", icon: BellIcon },
      { id: "reviews", label: "Reviews", icon: Star },
      { id: "loyalty", label: "Loyalty", icon: Award },
      { id: "gift-cards", label: "Gift cards", icon: Gift },
      { id: "customers", label: "Customers", icon: UsersIcon },
      { id: "payments", label: "Payments", icon: CreditCard },
      { id: "backup", label: "Backup", icon: HardDriveDownload },
      { id: "activity", label: "Activity", icon: ActivityIcon },
      { id: "team", label: "Team & roles", icon: UserCog },
      { id: "business", label: "Business & GST", icon: Building2 },
    ],
  },
  {
    label: "Growth",
    items: [
      { id: "seo-dashboard", label: "SEO command", icon: Search },
      { id: "seo-editor", label: "SEO editor", icon: Wand2 },
      { id: "seo-keywords", label: "Keywords", icon: Search },
      { id: "seo-backlinks", label: "Backlinks", icon: Search },
      { id: "seo-outreach", label: "Outreach", icon: Megaphone },
      { id: "seo-brief", label: "Content brief", icon: Sparkles },
      { id: "seo", label: "SEO health (legacy)", icon: Search },
      { id: "marketing", label: "Marketing", icon: Megaphone },
      { id: "campaigns", label: "Campaigns", icon: Rocket },
      { id: "nudges", label: "Witty Nudges", icon: BellIcon },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "community", label: "Community", icon: Users },
    ],
  },
  {
    label: "Studio",
    items: [
      { id: "content", label: "Content Studio", icon: Wand2 },
      { id: "trends", label: "Trends", icon: Sparkles },
      { id: "social", label: "Auto-Tweet", icon: Sparkles },
      { id: "integrations", label: "Integrations", icon: Settings },
      { id: "deploy", label: "Deploy to VPS", icon: Rocket },
      { id: "experience", label: "Experience", icon: Palette },
    ],
  },
];

const TAB_RENDERERS: Record<TabId, React.ComponentType> = {
  overview: MissionControlTab,
  products: ProductsTab,
  articles: ArticlesTab,
  teapedia: TeapediaTab,
  orders: OrdersTab,
  payments: PaymentsTab,
  backup: BackupTab,
  seo: SeoTab,
  marketing: MarketingTab,
  campaigns: CampaignsTab,
  analytics: AnalyticsTab,
  community: CommunityTab,
  content: ContentStudioTab,
  experience: ExperienceTab,
  activity: ActivityTab,
  customers: CustomersTab,
  team: TeamTab,
  shipping: ShippingTab,
  inventory: InventoryTab,
  subscriptions: SubscriptionsTab,
  wholesale: WholesaleTab,
  messages: MessagesTab,
  reviews: ReviewsTab,
  returns: ReturnsTab,
  loyalty: LoyaltyTab,
  "gift-cards": GiftCardsTab,
  recipes: RecipesTab,
  "content-hub": ContentHubTab,
  franchise: FranchiseTab,
  push: PushTab,
  business: BusinessTab,
  trends: TrendsTab,
  social: SocialTab,
  integrations: IntegrationsTab,
  deploy: DeployTab,
  "seo-dashboard": SeoDashboardTab,
  "seo-editor": SeoEditorTab,
  "seo-keywords": SeoKeywordsTab,
  "seo-backlinks": SeoBacklinksTab,
  "seo-outreach": SeoOutreachTab,
  "seo-brief": SeoBriefTab,
  nudges: NudgesTab,
};

const VALID_TABS = new Set<string>(Object.keys(TAB_RENDERERS));

function isValidTab(s: string): s is TabId {
  return VALID_TABS.has(s);
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const me = useAdminMe();
  const logout = useAdminLogout();

  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "overview";
    const h = window.location.hash.replace(/^#/, "");
    return isValidTab(h) ? h : "overview";
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // Cmd/Ctrl-K opens the co-pilot from anywhere in the admin
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onHash() {
      const h = window.location.hash.replace(/^#/, "");
      if (isValidTab(h)) setTab(h);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = window.location.hash.replace(/^#/, "");
    if (current !== tab) {
      window.history.replaceState(null, "", `#${tab}`);
    }
  }, [tab]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (me.isFetched && !me.data?.authenticated) {
      setLocation("/admin/login");
    }
  }, [me.isFetched, me.data?.authenticated, setLocation]);

  const activeMeta = useMemo(() => {
    for (const g of NAV_GROUPS) {
      const found = g.items.find((it) => it.id === tab);
      if (found) return { group: g.label, item: found };
    }
    return { group: "Storefront", item: NAV_GROUPS[0]!.items[0]! };
  }, [tab]);

  const ActiveTab = TAB_RENDERERS[tab];

  if (!me.isFetched) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground bg-[#f7f5f0]">
        Loading admin console…
      </div>
    );
  }
  if (!me.data?.authenticated) {
    return null;
  }

  const handleNav = (id: TabId) => {
    setTab(id);
    setDrawerOpen(false);
  };

  const handleSignOut = async () => {
    await logout.mutateAsync();
    await qc.invalidateQueries({ queryKey: getAdminMeQueryKey() });
    setLocation("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-[#1a2416]">
      {/* Top app bar — sticky on mobile, decorative on desktop */}
      <header className="sticky top-0 z-30 lg:static bg-white/95 backdrop-blur-sm border-b border-black/5 lg:border-b-0">
        <div className="flex items-center gap-2 px-3 sm:px-5 lg:px-8 h-14 lg:h-16">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 -ml-2 rounded-md text-[#1a2416]/70 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
            aria-label="Open admin menu"
            data-testid="button-admin-menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo className="h-7 w-auto" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a2416]/55">
              Admin
            </span>
          </div>
          <div className="hidden lg:flex flex-col">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a2416]/45">
              <span>{activeMeta.group}</span>
              <ChevronDown className="w-3 h-3 -rotate-90" />
              <span className="text-[#1a2416]/85">{activeMeta.item.label}</span>
            </div>
            <h1 className="text-[18px] font-serif leading-tight">{activeMeta.item.label}</h1>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <AlertsBell onNavigate={(id) => setTab(id)} />
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-md text-[12px] font-medium text-[#1a2416]/70 hover:text-[#1a2416] hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
              data-testid="button-open-copilot"
              aria-label="Open AI co-pilot"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" strokeWidth={2} />
              <span className="hidden sm:inline">Ask co-pilot</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-black/5 border border-black/10 font-mono text-[10px] text-[#1a2416]/60">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-md text-[12px] font-medium text-[#1a2416]/70 hover:text-[#1a2416] hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
              data-testid="button-view-store"
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">View store</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-md text-[12px] font-medium text-[#1a2416]/70 hover:text-[#1a2416] hover:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a5a2c]"
              data-testid="button-admin-signout"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:flex lg:items-start lg:gap-0">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen w-[260px] flex-shrink-0 bg-[#0e1810] text-white/85 border-r border-white/5"
          aria-label="Admin sections"
        >
          <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
            <div className="bg-white rounded-md px-2 py-1.5">
              <Logo className="h-6 w-auto" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Admin
              </p>
              <p className="text-[13px] font-medium text-white">Console</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
            {NAV_GROUPS.map((group) => (
              <NavGroupBlock
                key={group.label}
                group={group}
                activeTab={tab}
                onSelect={handleNav}
                tone="dark"
              />
            ))}
          </nav>
          <div className="p-4 border-t border-white/10 text-[11px] text-white/35">
            Single-operator console
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Close admin menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              data-testid="overlay-admin-drawer"
            />
            <div className="relative w-[88%] max-w-[320px] bg-[#0e1810] text-white/85 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white rounded-md px-2 py-1">
                    <Logo className="h-5 w-auto" />
                  </div>
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Admin
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-md text-white/55 hover:text-white hover:bg-white/5"
                  aria-label="Close menu"
                  data-testid="button-close-admin-drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
                {NAV_GROUPS.map((group) => (
                  <NavGroupBlock
                    key={group.label}
                    group={group}
                    activeTab={tab}
                    onSelect={handleNav}
                    tone="dark"
                  />
                ))}
              </nav>
              <div className="p-3 border-t border-white/10 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setLocation("/");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[12px] font-medium bg-white/[0.06] text-white/85 hover:bg-white/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Store
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-[12px] font-medium bg-emerald-500 text-[#0e1810] hover:bg-emerald-400"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Mobile section breadcrumb */}
          <div className="lg:hidden px-4 pt-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a2416]/45">
              <span>{activeMeta.group}</span>
              <ChevronDown className="w-3 h-3 -rotate-90" />
              <span className="text-[#1a2416]/85">{activeMeta.item.label}</span>
            </div>
            <h1 className="mt-1 text-[20px] font-serif leading-tight text-[#1a2416]">
              {activeMeta.item.label}
            </h1>
          </div>
          <div className="px-3 sm:px-5 lg:px-8 py-4 sm:py-6 lg:py-8">
            <ActiveTab />
          </div>
        </main>
      </div>

      {/* AI Co-pilot palette (Cmd/Ctrl+K) */}
      <CopilotPalette
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onNavigate={(id) => setTab(id)}
      />
    </div>
  );
}

function NavGroupBlock({
  group,
  activeTab,
  onSelect,
  tone,
}: {
  group: NavGroup;
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  tone: "dark" | "light";
}) {
  const headingClass =
    tone === "dark"
      ? "px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35"
      : "px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1a2416]/45";
  return (
    <div>
      <p className={headingClass}>{group.label}</p>
      <div className="mt-1.5 space-y-0.5">
        {group.items.map((it) => {
          const Icon = it.icon;
          const active = it.id === activeTab;
          const base =
            "w-full flex items-center gap-3 px-3 h-10 rounded-md text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50";
          const cls =
            tone === "dark"
              ? active
                ? `${base} bg-emerald-500/15 text-emerald-200 font-semibold`
                : `${base} text-white/65 hover:text-white hover:bg-white/[0.06]`
              : active
              ? `${base} bg-[#1a2416] text-white font-semibold`
              : `${base} text-[#1a2416]/70 hover:text-[#1a2416] hover:bg-black/[0.04]`;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              className={cls}
              data-testid={`nav-admin-${it.id}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
              <span className="truncate">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
