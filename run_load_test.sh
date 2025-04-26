#!/bin/bash

# Create a timestamp for the results directory
timestamp=$(date +%Y%m%d_%H%M%S)
results_dir="results/${timestamp}"

# Create the results directory
mkdir -p $results_dir

# Display the starting message
echo "Starting load test at $(date)"
echo "Results will be saved to: $results_dir"

# Run k6 with the specified test file
k6 run --out json=$results_dir/raw_results.json k6_test.js

# Display completion message
echo "Load test completed at $(date)"
