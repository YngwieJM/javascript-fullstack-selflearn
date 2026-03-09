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
    auth_login_baseline: {
      executor: "constant-vus",
      exec: "authLoginScenario",
      vus: 2,
      duration: "90s"
    },
    menu_list_baseline: {
      executor: "constant-vus",
      exec: "menuListScenario",
      vus: 4,
      duration: "120s"
    },
    order_workflow_baseline: {
      executor: "constant-vus",
      exec: "orderWorkflowScenario",
      vus: 2,
      duration: "90s"
    },
    protected_route_baseline: {
      executor: "constant-vus",
      exec: "protectedRouteScenario",
      vus: 2,
      duration: "120s"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.98"],
    http_req_duration: ["p(95)<700"],
    "http_req_duration{scenario:auth_login_baseline}": ["p(95)<500"],
    "http_req_duration{scenario:menu_list_baseline}": ["p(95)<450"],
    "http_req_duration{scenario:order_workflow_baseline}": ["p(95)<900"],
    "http_req_duration{scenario:protected_route_baseline}": ["p(95)<450"]
  }
};

export function setup() {
  return setupTestData();
}

export function authLoginScenario(data) {
  runAuthLogin(data, "baseline");
  sleep(0.3);
}

export function menuListScenario(data) {
  runMenuList(data, "baseline");
  sleep(0.3);
}

export function orderWorkflowScenario(data) {
  runOrderWorkflow(data, "baseline");
  sleep(0.5);
}

export function protectedRouteScenario(data) {
  runProtectedRoute(data, "baseline");
  sleep(0.3);
}
