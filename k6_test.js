import { sleep, check, group } from "k6";
import http from "k6/http";
import { SharedArray } from "k6/data";
import { Counter, Rate, Trend } from "k6/metrics";

// Define custom metrics
const searchSuccessRate = new Rate("search_success_rate");
const searchLatency = new Trend("search_latency");
const loginLatency = new Trend("login_latency");
const failedRequests = new Counter("failed_requests");

// Add metrics for each API endpoint
const createInteractionLatency = new Trend("create_interaction_latency");
const citationsLatency = new Trend("citations_latency");
const followupLatency = new Trend("followup_latency");
const responseLatency = new Trend("response_latency");

// Sample search queries that the virtual users will use
const queries = new SharedArray("search queries", function () {
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
    api_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10m", target: 100 }, // Ramp up to 100 users over 10 minutes
        { duration: "30m", target: 50 }, // Maintain 50 concurrent users for 30 minutes
        { duration: "5m", target: 0 }, // Ramp down to 0 users over 5 minutes
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    search_success_rate: ["rate>0.9"], // 90% of searches should be successful
    http_req_duration: ["p(95)<30000"], // 95% of requests should be below 30s
    login_latency: ["p(95)<3000"], // 95% of logins should be below 3s
  },
};

// Main function that k6 calls for each VU
export default function () {
  const baseUrl = "http://prod.worldcc.dandilion.ai";
  const username = "admin"; // Replace with actual username
  const password = "adminreg!"; // Replace with actual password
  let csrfToken = "";

  group("Login Flow", function () {
    // Visit the main page first
    const homeResponse = http.get(`${baseUrl}/`);
    check(homeResponse, {
      "home page loaded": (r) => r.status === 200,
    });

    // Now visit the login page
    let loginPageResponse = http.get(`${baseUrl}/login`);
    if (loginPageResponse.status !== 200) {
      // If direct /login doesn't work, use the home page response
      loginPageResponse = homeResponse;
    }

    // Extract CSRF token if present
    const html = loginPageResponse.body;
    const metaCsrfMatch = html.match(
      /<meta name="csrf-token" content="([^"]+)"/i
    );
    if (metaCsrfMatch && metaCsrfMatch.length > 1) {
      csrfToken = metaCsrfMatch[1];
    } else {
      const inputCsrfMatch = html.match(
        /<input[^>]*name=["']_csrf[^>]*value=["']([^"']+)["']/i
      );
      if (inputCsrfMatch && inputCsrfMatch.length > 1) {
        csrfToken = inputCsrfMatch[1];
      }
    }

    // Prepare login data
    let loginPayload = {
      username: username,
      password: password,
    };

    if (csrfToken) {
      loginPayload._csrf = csrfToken;
    }

    // Prepare headers
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Upgrade-Insecure-Requests": "1",
      Referer: `${baseUrl}/login`,
      Origin: baseUrl,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    };

    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    // Track login start time for latency measurement
    const loginStart = new Date().getTime();

    // Attempt login
    let loginResponse = http.post(`${baseUrl}/login`, loginPayload, {
      headers: headers,
      redirects: 5,
      tags: { name: "login" },
    });

    // If the first attempt fails, try with JSON
    if (loginResponse.status !== 200 && loginResponse.status !== 302) {
      headers["Content-Type"] = "application/json";
      loginResponse = http.post(
        `${baseUrl}/login`,
        JSON.stringify(loginPayload),
        {
          headers: headers,
          redirects: 5,
          tags: { name: "login_json" },
        }
      );
    }

    // Calculate login latency
    const loginEnd = new Date().getTime();
    loginLatency.add(loginEnd - loginStart);

    // Check if login was successful
    const loginSuccess = check(loginResponse, {
      "login successful": (r) => r.status === 200 || r.status === 302,
    });

    // If login failed, exit the test
    if (!loginSuccess) {
      failedRequests.add(1);
      return; // Skip the rest of the test for this VU
    }

    // Sleep between 1-2 seconds to simulate human behavior
    sleep(Math.random() + 1);
  });

  // Only proceed to search if login was successful
  group("Search Flow", function () {
    // Get a random search query from our list
    const query = queries[Math.floor(Math.random() * queries.length)];
    console.log(`Performing search with query: "${query.substring(0, 30)}..."`);

    // Common headers for all API requests
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Referer: `${baseUrl}/chat`,
      Origin: baseUrl,
    };

    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    // User ID - in a real application, you'd extract this from the session
    const userId = 1;
    let interactionId;

    // Track search start time for latency measurement
    const searchStart = new Date().getTime();

    // Step 1: Get previous interactions
    http.get(`${baseUrl}/api/interactions/by_user/${userId}`, {
      headers: headers,
      tags: { name: "get_previous_interactions" },
    });

    // Step 2: Create a new interaction
    console.log("Creating new interaction");
    const createInteractionPayload = JSON.stringify({
      user_id: userId,
      question: query,
    });

    const createInteractionStart = new Date().getTime();
    const createInteractionResponse = http.post(
      `${baseUrl}/api/interactions/`,
      createInteractionPayload,
      {
        headers: headers,
        tags: { name: "create_interaction" },
      }
    );
    const createInteractionEnd = new Date().getTime();
    createInteractionLatency.add(createInteractionEnd - createInteractionStart);

    // Extract the interaction ID from the response
    try {
      const responseData = JSON.parse(createInteractionResponse.body);
      interactionId = responseData.id;
      console.log(`Got interaction ID: ${interactionId}`);

      const apiPayload = JSON.stringify({
        interaction_id: interactionId,
        user_id: userId,
      });

      // Step 3: Generate citations
      console.log("Generating citations");
      const citationsStart = new Date().getTime();
      const citationsResponse = http.post(
        `${baseUrl}/api/interactions/generate_citations`,
        apiPayload,
        {
          headers: headers,
          tags: { name: "generate_citations" },
        }
      );
      const citationsEnd = new Date().getTime();
      citationsLatency.add(citationsEnd - citationsStart);

      // Step 4: Generate followup questions
      console.log("Generating followup questions");
      const followupStart = new Date().getTime();
      const followupResponse = http.post(
        `${baseUrl}/api/interactions/generate_followup`,
        apiPayload,
        {
          headers: headers,
          tags: { name: "generate_followup" },
        }
      );
      const followupEnd = new Date().getTime();
      followupLatency.add(followupEnd - followupStart);

      // Step 5: Get final response
      console.log("Getting final response");
      const responseStart = new Date().getTime();
      const finalResponse = http.post(
        `${baseUrl}/api/interactions/generate_response`,
        apiPayload,
        {
          headers: headers,
          tags: { name: "generate_response" },
        }
      );
      const responseEnd = new Date().getTime();
      responseLatency.add(responseEnd - responseStart);

      // Calculate search latency (total time for all API calls)
      const searchEnd = new Date().getTime();
      searchLatency.add(searchEnd - searchStart);

      // For Server-Sent Events (SSE), success is indicated by a 201 status
      const searchSuccess = check(finalResponse, {
        "search successful": (r) => r.status === 200 || r.status === 201,
      });

      // Try to validate response data (handling SSE format)
      let hasValidData = false;
      try {
        // Check if response is SSE format
        if (
          finalResponse.body.includes("event:") &&
          finalResponse.body.includes("data:")
        ) {
          // Extract data from SSE format by parsing the 'data:' lines
          const dataLines = finalResponse.body
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.substring(5).trim());

          if (dataLines.length > 0) {
            // Try to parse the first data line as JSON
            try {
              const firstDataEvent = JSON.parse(dataLines[0]);
              hasValidData = true;
            } catch (e) {
              console.log(`Error parsing SSE data: ${e.message}`);
            }
          }
        } else {
          // Try regular JSON parsing if not SSE
          const data = JSON.parse(finalResponse.body);
          hasValidData = data && Object.keys(data).length > 0;
        }
      } catch (e) {
        console.log(`Error parsing final response: ${e.message}`);
      }

      check(finalResponse, {
        "search returned valid data": () => hasValidData,
      });

      // Record search success rate
      searchSuccessRate.add(searchSuccess && hasValidData);

      // If search failed, increment failed requests counter
      if (!searchSuccess) {
        failedRequests.add(1);
      }
    } catch (e) {
      // If we couldn't get an interaction ID, record failure
      console.log(`Error in search process: ${e.message}`);
      failedRequests.add(1);
      searchSuccessRate.add(false);
    }

    // Sleep between 2-5 seconds before ending
    sleep(Math.random() * 3 + 2);
  });
}
