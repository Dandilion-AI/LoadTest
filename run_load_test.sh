#!/bin/bash

# Create output directory
mkdir -p results

# Get current timestamp for the results file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_DIR="results/${TIMESTAMP}"
mkdir -p $OUTPUT_DIR

echo "Starting load test at $(date)"
echo "Results will be saved to $OUTPUT_DIR"

# Run k6 with multiple output options:
# 1. HTML summary report
# 2. CSV files for detailed analysis
# 3. JSON for raw data if needed
k6 run k6_test.js \
    --out csv=$OUTPUT_DIR/metrics.csv \
    --summary-export=$OUTPUT_DIR/summary.json \
    --summary-trend-stats="avg,min,med,max,p(90),p(95)"

# Check if the test completed successfully
if [ $? -ne 0 ]; then
    echo "Error: k6 test failed to complete successfully"
    exit 1
fi

echo "Load test completed at $(date)"
echo "Results saved to $OUTPUT_DIR directory"
echo "- Summary data: $OUTPUT_DIR/summary.json"
echo "- CSV metrics: $OUTPUT_DIR/metrics.csv"
echo "Done!"
