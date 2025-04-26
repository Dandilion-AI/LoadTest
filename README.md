# Load Testing Framework for Dandilion AI

This project contains a K6-based load testing framework for the Dandilion AI application.

## Structure

- `k6_config.js` - Configuration for K6 metrics, options, and shared data
- `k6_test.js` - Main test script with user management testing
- `run_load_test.sh` - Shell script to execute the load test and save results

## Test Iterations

The load test is designed to be executed in iterations, focusing on different aspects of the application:

### Iteration 1: User Management
- Register a new user with a unique `loadtest_` prefix
- Map the new user to role_id 1
- Login with the newly created user
- Delete the user

### Iteration 2: Interaction Workflow
- Register a new user with a unique `loadtest_` prefix
- Map the new user to role_id 1
- Login with the newly created user
- Create a new interaction with a random query
- Generate citations (using Server-Sent Events)
- Generate response (using Server-Sent Events)
- Get interactions to verify interaction creation
- Generate followup questions
- Delete the interaction
- Delete associated sources
- Delete the user

## API Endpoints Tested

The load test covers the following API endpoints:

### User Management
- `POST /api/users/` - Register a new user
- `POST /api/users/{user_id}/roles` - Map user to role
- `POST /api/users/authenticate` - User login
- `DELETE /api/users/{id}` - Delete user

### Interaction Management
- `POST /api/interactions/` - Create a new interaction
- `POST /api/interactions/generate_citations` - Generate citations (Server-Sent Events)
- `POST /api/interactions/generate_response` - Generate response (Server-Sent Events)
- `GET /api/interactions/by_user/{user_id}` - Get user's interactions
- `POST /api/interactions/generate_followup` - Generate followup questions
- `DELETE /api/interactions/{interaction_id}` - Delete an interaction
- `DELETE /api/sources/{source_id}` - Delete associated sources

## Running the Tests

To run the load tests:

```bash
# Make the shell script executable if needed
chmod +x run_load_test.sh

# Run the load test
./run_load_test.sh
```

The results will be stored in a timestamped directory under the `results/` folder.

## Switching Iterations

To switch between test iterations, edit the `k6_test.js` file and change the `iterationToRun` value:

```javascript
// Choose which iteration to run
const iterationToRun = 1; // Change to 2 for Iteration 2
```

## Configuration

You can modify the load test parameters in `k6_config.js`:

- VU (Virtual User) count and ramp-up periods
- Duration of each test stage
- Performance thresholds
- Base URL for the application

## Prerequisites

- [K6](https://k6.io/docs/getting-started/installation/) must be installed
- Network access to the target environment 