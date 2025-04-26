import { Counter, Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

// Define custom metrics
export const searchSuccessRate = new Rate("search_success_rate");
export const searchLatency = new Trend("search_latency");
export const loginLatency = new Trend("login_latency");
export const failedRequests = new Counter("failed_requests");

// Add metrics for each API endpoint
export const createInteractionLatency = new Trend("create_interaction_latency");
export const citationsLatency = new Trend("citations_latency");
export const followupLatency = new Trend("followup_latency");
export const responseLatency = new Trend("response_latency");
export const getInteractionsLatency = new Trend("get_interactions_latency");

// User management metrics
export const registerUserLatency = new Trend("register_user_latency");
export const deleteUserLatency = new Trend("delete_user_latency");
export const roleMapLatency = new Trend("role_map_latency");

// Interaction management metrics
export const deleteInteractionLatency = new Trend("delete_interaction_latency");
export const deleteSourceLatency = new Trend("delete_source_latency");

// Sample search queries that the virtual users will use
export const queries = new SharedArray("search queries", function () {
  return [
    "Why is there a significantly lower proportion of dedicated CCM resources on the buy side compared to the sell side?",
    "How might the organizational structure for CCM resources differ between buy-side and sell-side?",
    "What are the key challenges in implementing effective contract management systems?",
    "Can you explain the best practices for contract lifecycle management?",
    "What metrics should be tracked for effective contract performance?",
    "How can AI improve contract management processes?",
    "What are the common pitfalls in contract negotiations?",
    "How do regulatory changes impact contract management strategies?",
    "What's the difference between contract management and contract administration?",
    "How should contract management teams collaborate with legal departments?",
  ];
});

// K6 test configuration
export const options = {
  scenarios: {
    user_management_flow: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "1m", target: 1 }, // Ramp up from 1 to 10 users over 5 minutes
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<30000"], // 95% of requests should be below 5s
    login_latency: ["p(95)<3000"], // 95% of logins should be below 3s
    register_user_latency: ["p(95)<3000"], // 95% of user registrations should be below 3s
  },
};

// Base URL for the application
export const baseUrl = "https://development.worldcc.dandilion.ai";
