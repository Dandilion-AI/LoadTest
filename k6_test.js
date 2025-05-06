import { sleep, check, group } from "k6";
import http from "k6/http";
import {
  searchSuccessRate,
  searchLatency,
  loginLatency,
  failedRequests,
  createInteractionLatency,
  citationsLatency,
  followupLatency,
  responseLatency,
  registerUserLatency,
  deleteUserLatency,
  deleteInteractionLatency,
  deleteSourceLatency,
  roleMapLatency,
  getInteractionsLatency,
  queries,
  options,
  baseUrl,
} from "./k6_config.js";

export { options };

// Main function that k6 calls for each VU
export default function () {
  let csrfToken = "";
  let userId = null;
  let interactionId = null;
  let sourceIds = [];

  // Generate unique user for this virtual user
  const vuId = __VU;
  const timestamp = new Date().getTime();
  const uniqueId = `${vuId}_${timestamp}`;
  const email = `loadtest_user${uniqueId}`;
  const name = `LoadTest User ${uniqueId}`;
  const password = "securePassword123";

  // Choose which iteration to run
  const iterationToRun = 2;

  group("Setup: Register User & Login", function () {
    // Step 1: Get the main page to extract CSRF token if needed
    const homeResponse = http.get(`${baseUrl}/`);
    check(homeResponse, {
      "home page loaded": (r) => r.status === 200,
    });

    if (homeResponse.status !== 200) {
      console.log(`Failed to load home page: ${homeResponse.status}`);
      failedRequests.add(1);
      return; // Exit early if home page doesn't load
    }

    // Extract CSRF token if present
    const html = homeResponse.body;
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

    // Common headers for all API requests
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: baseUrl,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    };

    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    // Register a new user
    console.log(`Creating user with email: ${email}`);
    const registerPayload = JSON.stringify({
      name: name,
      email: email,
      password: password,
      user_type: "DANDILION_STAFF",
      membership_type: "NOT_APPLICABLE",
    });

    const registerStart = new Date().getTime();
    const registerResponse = http.post(
      `${baseUrl}/api/users/`,
      registerPayload,
      {
        headers: headers,
        tags: { name: "register_user" },
      }
    );
    const registerEnd = new Date().getTime();
    registerUserLatency.add(registerEnd - registerStart);

    // Check if registration was successful
    const registerSuccess = check(registerResponse, {
      "user registration successful": (r) =>
        r.status === 200 || r.status === 201,
    });

    if (!registerSuccess) {
      console.log(`Failed to register user: ${registerResponse.status}`);
      failedRequests.add(1);
      return; // Exit early if registration fails
    }

    try {
      const responseData = JSON.parse(registerResponse.body);
      userId = responseData.id;
      console.log(`Successfully registered user with ID: ${userId}`);
    } catch (e) {
      console.log(`Error parsing registration response: ${e.message}`);
      failedRequests.add(1);
      return; // Exit early if parsing fails
    }

    // Sleep briefly to ensure registration is processed
    sleep(1);

    // Map user to role_id 1
    console.log(`Mapping user ${userId} to role_id 1`);
    const roleMapPayload = JSON.stringify({
      user_id: userId,
      role_ids: [1],
    });

    const roleMapStart = new Date().getTime();
    const roleMapResponse = http.post(
      `${baseUrl}/api/users/${userId}/roles`,
      roleMapPayload,
      {
        headers: headers,
        tags: { name: "map_user_role" },
      }
    );
    const roleMapEnd = new Date().getTime();
    roleMapLatency.add(roleMapEnd - roleMapStart);

    const roleMapSuccess = check(roleMapResponse, {
      "user role mapping successful": (r) =>
        r.status === 200 || r.status === 201,
    });

    if (!roleMapSuccess) {
      console.log(`Failed to map user to role: ${roleMapResponse.status}`);
      failedRequests.add(1);
      // Continue despite role mapping failure, as we might still be able to login
    } else {
      console.log(`Successfully mapped user ${userId} to role_id 1`);
    }

    // Sleep to ensure role mapping is processed
    sleep(1);

    // Login with the new user
    const loginPayload = JSON.stringify({
      email: email,
      password: password,
    });

    const loginStart = new Date().getTime();
    const loginResponse = http.post(
      `${baseUrl}/api/users/authenticate`,
      loginPayload,
      {
        headers: headers,
        tags: { name: "login" },
      }
    );
    const loginEnd = new Date().getTime();
    loginLatency.add(loginEnd - loginStart);

    // Check if login was successful
    const loginSuccess = check(loginResponse, {
      "login successful": (r) => r.status === 200,
    });

    if (!loginSuccess) {
      console.log(`Failed to login: ${loginResponse.status}`);
      failedRequests.add(1);
      return; // Exit early if login fails
    }

    console.log(`Successfully logged in as user: ${email}`);

    // Extract auth token if present in response
    try {
      const loginData = JSON.parse(loginResponse.body);
      if (loginData.token) {
        headers["Authorization"] = `Bearer ${loginData.token}`;
      }
      // If we didn't get the userId from registration, try to get it from login response
      if (!userId && loginData.user && loginData.user.id) {
        userId = loginData.user.id;
      }
    } catch (e) {
      console.log(`Error parsing login response: ${e.message}`);
      failedRequests.add(1);
      return; // Exit early if parsing fails
    }

    // Sleep to ensure login is processed completely before proceeding
    sleep(2);
  });

  if (iterationToRun === 1) {
    group("Iteration 1: User Management", function () {
      // Delete the user
      if (userId) {
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        console.log(`Deleting user with ID: ${userId}`);

        const deleteStart = new Date().getTime();
        const deleteResponse = http.del(
          `${baseUrl}/api/users/${userId}`,
          null,
          {
            headers: headers,
            tags: { name: "delete_user" },
          }
        );
        const deleteEnd = new Date().getTime();
        deleteUserLatency.add(deleteEnd - deleteStart);

        // Check if deletion was successful
        check(deleteResponse, {
          "user deletion successful": (r) =>
            r.status === 200 || r.status === 204,
        });

        if (deleteResponse.status === 200 || deleteResponse.status === 204) {
          console.log(`Successfully deleted user: ${email}`);
        } else {
          console.log(`Failed to delete user: ${deleteResponse.status}`);
          failedRequests.add(1);
        }
      } else {
        console.log("Cannot delete user: No user ID available");
        failedRequests.add(1);
      }
    });
  } else if (iterationToRun === 2) {
    group("Iteration 2: Interaction Workflow", function () {
      // Setup headers for all API requests in this group
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream", // Accept event streams
      };

      // If there's an auth token from login, use it
      const loginData = http.get(`${baseUrl}/api/users/session`, {
        headers: headers,
      });

      if (loginData.status !== 200) {
        console.log(`Failed to get session data: ${loginData.status}`);
        failedRequests.add(1);
        return; // Exit early if session validation fails
      }

      try {
        const sessionData = JSON.parse(loginData.body);
        if (sessionData && sessionData.token) {
          headers["Authorization"] = `Bearer ${sessionData.token}`;
        }
      } catch (e) {
        console.log("Could not extract session token");
        failedRequests.add(1);
        return; // Exit if we can't get session token
      }

      // Get a random query from the queries array
      const query = queries[Math.floor(Math.random() * queries.length)];
      console.log(`Using query: ${query.substring(0, 30)}...`);

      // Step 1: Create a new interaction
      const interactionPayload = JSON.stringify({
        user_id: userId,
        question: query,
      });

      const createInteractionStart = new Date().getTime();
      const interactionResponse = http.post(
        `${baseUrl}/api/interactions/`,
        interactionPayload,
        {
          headers: headers,
          tags: { name: "create_interaction" },
        }
      );
      const createInteractionEnd = new Date().getTime();
      createInteractionLatency.add(
        createInteractionEnd - createInteractionStart
      );

      // Wait to ensure interaction is created in the database
      sleep(2);

      // Check if interaction creation was successful
      const interactionSuccess = check(interactionResponse, {
        "interaction creation successful": (r) =>
          r.status === 200 || r.status === 201,
      });

      if (!interactionSuccess) {
        console.log(
          `Failed to create interaction: ${interactionResponse.status}`
        );
        failedRequests.add(1);
        return; // Exit early if interaction creation fails
      }

      let interactionId;
      try {
        const responseData = JSON.parse(interactionResponse.body);
        interactionId = responseData.id;
        console.log(`Created interaction with ID: ${interactionId}`);
      } catch (e) {
        console.log(`Error parsing interaction response: ${e.message}`);
        failedRequests.add(1);
        return; // Exit early if parsing fails
      }

      // Step 2: Generate citations
      const citationsPayload = JSON.stringify({
        interaction_id: interactionId,
        user_id: userId,
      });

      const citationsStart = new Date().getTime();
      const citationsResponse = http.post(
        `${baseUrl}/api/interactions/generate_citations`,
        citationsPayload,
        {
          headers: {
            ...headers,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          tags: { name: "generate_citations" },
          responseType: "text",
          timeout: "300s", // Increased timeout for event streams
        }
      );
      const citationsEnd = new Date().getTime();
      citationsLatency.add(citationsEnd - citationsStart);

      // Check if citations generation produced a valid response
      const hasCitationsEventStream = check(citationsResponse, {
        "citations response is 201": (r) => r.status === 201,
        "citations has valid content type": (r) =>
          r.headers["Content-Type"] &&
          r.headers["Content-Type"].includes("text/event-stream"),
      });

      if (!hasCitationsEventStream) {
        console.log(`Citations generation failed: ${citationsResponse.status}`);
        failedRequests.add(1);
        // Continue despite citation failure, as we can still try to generate a response
      } else {
        console.log("Citations generation started successfully");
      }

      // Process event stream data
      let citationsEventData = [];
      let hasMessageStart = false;
      let hasContentStart = false;
      let hasContentEnd = false;
      let hasMessageEnd = false;

      if (citationsResponse.body) {
        try {
          // Check if we have an event stream format
          if (citationsResponse.body.includes("event:")) {
            // Split the response into individual events
            const eventLines = citationsResponse.body.split("\n");
            let currentEvent = {};

            for (let i = 0; i < eventLines.length; i++) {
              const line = eventLines[i].trim();

              // Check for event type
              if (line.startsWith("event:")) {
                const eventType = line.substring(6).trim();
                currentEvent.type = eventType;

                // Track specific event types
                if (eventType === "message_start") hasMessageStart = true;
                if (eventType === "content_start") hasContentStart = true;
                if (eventType === "content_end") hasContentEnd = true;
                if (eventType === "message_end") hasMessageEnd = true;
              }

              // Check for data
              if (line.startsWith("data:")) {
                const data = line.substring(5).trim();
                try {
                  currentEvent.data = JSON.parse(data);
                } catch (e) {
                  // If not JSON, store as string
                  currentEvent.data = data;
                }

                // End of event, store it and reset
                citationsEventData.push(currentEvent);
                currentEvent = {};
              }
            }

            console.log(
              `Citations event types - message_start: ${hasMessageStart}, content_start: ${hasContentStart}, content_end: ${hasContentEnd}, message_end: ${hasMessageEnd}`
            );
            console.log(
              `Processed ${citationsEventData.length} citation events`
            );
          } else {
            // Try to parse as direct JSON
            citationsEventData = JSON.parse(citationsResponse.body);
            console.log(`Parsed citations data as JSON (not an event stream)`);
          }
        } catch (e) {
          console.log(`Error parsing citations response: ${e.message}`);
          failedRequests.add(1);
          // Continue despite parsing error
        }
      }

      // Wait for citations to be processed completely
      sleep(5);

      // Step 3: Generate response
      const responsePayload = JSON.stringify({
        interaction_id: interactionId,
        user_id: userId,
      });

      const responseStart = new Date().getTime();
      const genResponseResult = http.post(
        `${baseUrl}/api/interactions/generate_response`,
        responsePayload,
        {
          headers: {
            ...headers,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          tags: { name: "generate_response" },
          responseType: "text",
          timeout: "300s", // Increased timeout for response generation
        }
      );
      const responseEnd = new Date().getTime();
      responseLatency.add(responseEnd - responseStart);

      // Check if response generation was successful
      const hasResponseEventStream = check(genResponseResult, {
        "response is 201": (r) => r.status === 201,
        "response has valid content type": (r) =>
          r.headers["Content-Type"] &&
          (r.headers["Content-Type"].includes("text/event-stream") ||
            r.headers["Content-Type"].includes("application/json")),
      });

      if (!hasResponseEventStream) {
        console.log(`Response generation failed: ${genResponseResult.status}`);
        failedRequests.add(1);
        // Continue despite response failure, we still need to complete the workflow
      } else {
        console.log("Response generation started successfully");
      }

      // Wait for response to complete
      sleep(20);

      // Process event stream data
      let responseEventData = [];
      let responseHasMessageStart = false;
      let responseHasContentStart = false;
      let responseHasContentEnd = false;
      let responseHasMessageEnd = false;

      if (genResponseResult.body) {
        try {
          // Check if we have an event stream format
          if (genResponseResult.body.includes("event:")) {
            // Split the response into individual events
            const eventLines = genResponseResult.body.split("\n");
            let currentEvent = {};

            for (let i = 0; i < eventLines.length; i++) {
              const line = eventLines[i].trim();

              // Check for event type
              if (line.startsWith("event:")) {
                const eventType = line.substring(6).trim();
                currentEvent.type = eventType;

                // Track specific event types
                if (eventType === "message_start")
                  responseHasMessageStart = true;
                if (eventType === "content_start")
                  responseHasContentStart = true;
                if (eventType === "content_end") responseHasContentEnd = true;
                if (eventType === "message_end") responseHasMessageEnd = true;
              }

              // Check for data
              if (line.startsWith("data:")) {
                const data = line.substring(5).trim();
                try {
                  currentEvent.data = JSON.parse(data);
                } catch (e) {
                  // If not JSON, store as string
                  currentEvent.data = data;
                }

                // End of event, store it and reset
                responseEventData.push(currentEvent);
                currentEvent = {};
              }
            }

            console.log(
              `Response event types - message_start: ${responseHasMessageStart}, content_start: ${responseHasContentStart}, content_end: ${responseHasContentEnd}, message_end: ${responseHasMessageEnd}`
            );
            console.log(
              `Processed ${responseEventData.length} response events`
            );
          } else {
            // Try to parse as direct JSON
            responseEventData = JSON.parse(genResponseResult.body);
            console.log(`Parsed response data as JSON (not an event stream)`);
          }
        } catch (e) {
          console.log(`Error parsing response stream: ${e.message}`);
          failedRequests.add(1);
          // Continue despite parsing error
        }
      }

      // Wait to ensure the response was fully registered
      sleep(3);

      // Step 4: Get user interactions to verify the interaction was registered
      console.log(`Getting interactions for user ${userId}`);
      const getInteractionsStart = new Date().getTime();
      const getInteractionsResponse = http.get(
        `${baseUrl}/api/interactions/by_user/${userId}`,
        {
          headers: headers,
          tags: { name: "get_user_interactions" },
        }
      );
      const getInteractionsEnd = new Date().getTime();
      getInteractionsLatency.add(getInteractionsEnd - getInteractionsStart);

      // Check if getting interactions was successful
      const hasInteractions = check(getInteractionsResponse, {
        "get interactions response is 200": (r) => r.status === 200,
        "get interactions returns JSON": (r) =>
          r.headers["Content-Type"] &&
          r.headers["Content-Type"].includes("application/json"),
      });

      let interactionFound = false;
      if (hasInteractions) {
        try {
          const interactionsData = JSON.parse(getInteractionsResponse.body);

          // Check if we have today's interactions
          if (
            interactionsData.today &&
            Array.isArray(interactionsData.today) &&
            interactionsData.today.length > 0
          ) {
            console.log(
              `Found ${interactionsData.today.length} interactions for today`
            );

            // Check that our specific interaction is in the list
            const foundInteraction = interactionsData.today.find(
              (interaction) => interaction.interaction_id === interactionId
            );

            if (foundInteraction) {
              interactionFound = true;
              console.log(
                `Verified interaction ${interactionId} is registered for user ${userId}`
              );
            } else {
              console.log(
                `Our interaction ${interactionId} was not found in the user's interactions`
              );
              failedRequests.add(1);
            }
          } else {
            console.log(`No interactions found for today`);
            failedRequests.add(1);
          }
        } catch (e) {
          console.log(`Error parsing get interactions response: ${e.message}`);
          failedRequests.add(1);
        }
      } else {
        console.log(
          `Failed to get user interactions: ${getInteractionsResponse.status}`
        );
        failedRequests.add(1);
      }

      // Wait to ensure interactions were fully fetched
      sleep(2);

      // Step 5: Generate followup questions
      const followupPayload = JSON.stringify({
        user_id: userId,
        interaction_id: interactionId,
      });

      const followupStart = new Date().getTime();
      const followupResponse = http.post(
        `${baseUrl}/api/interactions/generate_followup`,
        followupPayload,
        {
          headers: headers,
          tags: { name: "generate_followup" },
        }
      );
      const followupEnd = new Date().getTime();
      followupLatency.add(followupEnd - followupStart);

      const followupSuccess = check(followupResponse, {
        "followup generation successful": (r) =>
          r.status === 200 || r.status === 201,
      });

      if (!followupSuccess) {
        console.log(`Followup generation failed: ${followupResponse.status}`);
        failedRequests.add(1);
      } else {
        console.log("Followup generation completed successfully");
      }

      // Wait for followup generation to complete
      sleep(5);

      // Step 6: Delete the interaction and associated sources
      console.log(`Deleting interaction with ID: ${interactionId}`);
      const deleteInteractionStart = new Date().getTime();
      const deleteInteractionResponse = http.del(
        `${baseUrl}/api/interactions/${interactionId}`,
        null,
        {
          headers: headers,
          tags: { name: "delete_interaction" },
        }
      );
      const deleteInteractionEnd = new Date().getTime();
      deleteInteractionLatency.add(
        deleteInteractionEnd - deleteInteractionStart
      );

      // Check if deletion was successful
      const deleteSuccess = check(deleteInteractionResponse, {
        "interaction deletion successful": (r) =>
          r.status === 200 || r.status === 204,
      });

      if (deleteSuccess) {
        console.log(`Successfully deleted interaction: ${interactionId}`);

        // Extract source IDs from the response to delete them
        try {
          const deleteData = JSON.parse(deleteInteractionResponse.body);
          if (
            deleteData.source_associations &&
            deleteData.source_associations.length > 0
          ) {
            // Skipping source deletion as requested
            console.log(
              `Found ${deleteData.source_associations.length} sources to delete, but skipping deletion step.`
            );
          } else {
            console.log("No source associations found to delete");
          }
        } catch (e) {
          console.log(
            `Error processing interaction deletion response: ${e.message}`
          );
          failedRequests.add(1);
        }
      } else {
        console.log(
          `Failed to delete interaction: ${deleteInteractionResponse.status}`
        );
        failedRequests.add(1);
      }

      // Wait to ensure interaction was fully deleted
      sleep(2);
    });
  }

  // Always delete the user at the end for cleanup
  group("Cleanup: Delete User", function () {
    if (!userId) {
      console.log("Cannot delete user: No user ID available");
      failedRequests.add(1);
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    console.log(`Performing final cleanup: Deleting user with ID: ${userId}`);

    const deleteStart = new Date().getTime();
    const deleteResponse = http.del(`${baseUrl}/api/users/${userId}`, null, {
      headers: headers,
      tags: { name: "delete_user" },
    });
    const deleteEnd = new Date().getTime();
    deleteUserLatency.add(deleteEnd - deleteStart);

    const deleteSuccess = check(deleteResponse, {
      "user deletion successful": (r) => r.status === 200 || r.status === 204,
    });

    if (deleteSuccess) {
      console.log(`Successfully deleted user: ${email}`);
    } else {
      console.log(`Failed to delete user: ${deleteResponse.status}`);
      failedRequests.add(1);
    }

    // Ensure deletion is processed before ending the test
    sleep(2);
  });

  // Final sleep before ending
  sleep(1);
}
