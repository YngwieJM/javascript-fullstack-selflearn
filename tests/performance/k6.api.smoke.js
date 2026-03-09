import { sleep } from "k6";
import {
  setupTestData,
  runAuthLogin,
  runMenuList,
  runOrderWorkflow,
  runProtectedRoute
} from "./k6.common.js";

export const options = {
  scenarios: {
    auth_login_smoke: {
      executor: "shared-iterations",
      exec: "authLoginScenario",
      vus: 1,
      iterations: 3,
      maxDuration: "20s"
    },
    menu_list_smoke: {
      executor: "shared-iterations",
      exec: "menuListScenario",
      vus: 1,
      iterations: 5,
      maxDuration: "20s"
    },
    order_workflow_smoke: {
      executor: "shared-iterations",
      exec: "orderWorkflowScenario",
      vus: 1,
      iterations: 3,
      maxDuration: "30s"
    },
    protected_route_smoke: {
      executor: "shared-iterations",
      exec: "protectedRouteScenario",
      vus: 1,
      iterations: 5,
      maxDuration: "20s"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    checks: ["rate>0.98"],
    http_req_duration: ["p(95)<800"],
    "http_req_duration{scenario:auth_login_smoke}": ["p(95)<600"],
    "http_req_duration{scenario:menu_list_smoke}": ["p(95)<500"],
    "http_req_duration{scenario:order_workflow_smoke}": ["p(95)<900"],
    "http_req_duration{scenario:protected_route_smoke}": ["p(95)<500"]
  }
};

export function setup() {
  return setupTestData();
}

export function authLoginScenario(data) {
  runAuthLogin(data, "smoke");
  sleep(0.2);
}

export function menuListScenario(data) {
  runMenuList(data, "smoke");
  sleep(0.2);
}

export function orderWorkflowScenario(data) {
  runOrderWorkflow(data, "smoke");
  sleep(0.3);
}

export function protectedRouteScenario(data) {
  runProtectedRoute(data, "smoke");
  sleep(0.2);
}
