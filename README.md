# RAG Chat Application Load Testing

This repository contains a k6 script for load testing the RAG chat application located at `https://dev.worldcc.dandilion.ai/`.

## Prerequisites

- [k6](https://k6.io/docs/getting-started/installation/) installed on your machine

## Configuration

The load test script (`k6_test.js`) is configured to:

1. Log in to the application using provided credentials
2. Perform chat searches with randomly selected queries
3. Scale up to 50 virtual users (VUs) over time
4. Collect and report metrics on login latency, search latency, and success rates

## Running the Load Test

To run the load test:

```bash
k6 run k6_test.js
```

### Advanced Usage

To adjust the number of virtual users or test duration, you can modify the options in the `k6_test.js` file or override them with command-line arguments:

```bash
# Run with a specific number of VUs
k6 run --vus 25 --duration 2m k6_test.js

# Export results to a JSON file
k6 run --out json=results.json k6_test.js
```

## Metrics Collected

The test collects the following metrics:

- `login_latency`: Time taken to complete the login process
- `search_latency`: Time taken to complete a search query
- `search_success_rate`: Percentage of successful search requests
- `failed_requests`: Count of failed requests (login or search)

## Customizing Test Behavior

To modify the test behavior:

1. Update the credentials in the script if needed
2. Add/modify the search queries in the `queries` array
3. Adjust the test stages in the `options` configuration
4. Modify thresholds based on your performance requirements

## Troubleshooting

If the test fails to login:
- Verify that the credentials are correct
- Inspect the network traffic to ensure the login endpoint is correctly configured
- Check if CSRF token extraction is needed

If search requests fail:
- Verify that the search API endpoint is correct
- Check the format of the search payload
- Ensure the authentication is preserved between requests 