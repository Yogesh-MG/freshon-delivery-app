// packages/freshon-api/src/index.ts
// Barrel export — the single entry point for @freshon/api.
//
// Usage:
//   import { initClient, auth, inventory, orders } from "@freshon/api";
//   initClient({ baseURL: "https://yogesh843120.pythonanywhere.com" });
//   const user = await auth.me();
// ─── Core ─────────────────────────────────────────────────────────────
export { initClient, getClient, getClientConfig, setAuthTokens, getAccessToken, getRefreshToken, clearAuthTokens, 
// The reason the SERVER gave for a failure, not axios's "status code 400".
// The interceptor already folds this into `error.message`, so most callers get it
// for free; export these for call sites that want their own fallback wording, and
// for the apps whose HTTP client isn't axios (Fpick's fetch wrapper).
apiErrorMessage, errorMessageFromBody, } from "./client";
// ─── Types ────────────────────────────────────────────────────────────
export * from "./types";
// ─── API Modules (namespaced) ─────────────────────────────────────────
import * as auth from "./modules/auth";
import * as inventory from "./modules/inventory";
import * as orders from "./modules/orders";
import * as delivery from "./modules/delivery";
import * as wallet from "./modules/wallet";
import * as payment from "./modules/payment";
import * as unifiedPayment from "./modules/payment-unified";
import * as icici from "./modules/icici";
import * as profile from "./modules/profile";
import * as picker from "./modules/picker";
import * as deliveryPartner from "./modules/delivery-partner";
import * as farmer from "./modules/farmer";
import * as supplier from "./modules/supplier";
import * as b2b from "./modules/b2b";
import * as pos from "./modules/pos";
import * as hr from "./modules/hr";
import * as ws from "./modules/ws";
import * as agents from "./modules/agents";
import * as fos from "./modules/fos";
import * as printJobs from "./modules/printjobs";
import * as locations from "./modules/locations";
import * as packaging from "./modules/packaging";
import * as cashTrail from "./modules/cashtrail";
import * as analytics from "./modules/analytics";
import * as cost from "./modules/cost";
import * as pricing from "./modules/pricing";
import * as support from "./modules/support";
import * as vision from "./modules/vision";
import * as appConfig from "./modules/app-config";
import { notifications, NotificationService } from "./modules/notifications";
export { auth, inventory, orders, delivery, wallet, payment, unifiedPayment, icici, profile, picker, deliveryPartner, farmer, supplier, b2b, pos, hr, ws, agents, fos, printJobs, locations, packaging, cashTrail, analytics, cost, pricing, support, vision, appConfig, notifications, NotificationService, };
//# sourceMappingURL=index.js.map