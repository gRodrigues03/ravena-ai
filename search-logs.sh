#!/bin/bash

# Obrigado gemini

# --- Configuration ---
# Base directory for all logs
LOG_BASE_DIR="logs"

# --- Input Validation ---
if [ "$#" -ne 2 ]; then
	echo "Usage:   $0 YYYY-MM-DD HH:MM"
	echo "Example: $0 2025-10-20 14:00"
	exit 1
fi

INPUT_DATE="$1"
INPUT_TIME="$2"
START_DATETIME_STR="$INPUT_DATE $INPUT_TIME"

# --- Time Calculation (Handling UTC) ---
# We assume the user is inputting the time in UTC, to match the log files.
# We explicitly add "UTC" to the string to prevent 'date' from
# applying a local timezone conversion.

# Create strings that look exactly like the log's timestamp.
START_UTC_STR="["$(date -u -d "$START_DATETIME_STR UTC" +"%Y-%m-%dT%H:%M:%S")"Z"
END_UTC_STR="["$(date -u -d "$START_DATETIME_STR UTC + 5 minutes" +"%Y-%m-%dT%H:%M:%S")"Z"

# Check if 'date' command worked (detects invalid input)
if [[ "$START_UTC_STR" == "[Z" || "$END_UTC_STR" == "[Z" ]]; then
	echo "Error: Invalid date/time format. Use 'YYYY-MM-DD HH:MM'"
	exit 1
fi

echo "--- Searching logs for UTC range: $START_UTC_STR to $END_UTC_STR ---"

# --- File Location Logic ---
# Determine if we're looking at today's logs or history
TODAY_DATE=$(date +"%Y-%m-%d")
TARGET_DIR=""

if [ "$INPUT_DATE" == "$TODAY_DATE" ]; then
	TARGET_DIR="$LOG_BASE_DIR"
	echo "--- Searching in today's log directory: $TARGET_DIR"
else
	TARGET_DIR="$LOG_BASE_DIR/history/$INPUT_DATE"
	echo "--- Searching in history directory: $TARGET_DIR"
fi

# Check if the target log directory exists
if [ ! -d "$TARGET_DIR" ]; then
	echo "Error: Log directory not found: $TARGET_DIR"
	exit 1
fi

# --- Search, Filter, and Sort ---
# 1. 'find' all .log files in the target directory (maxdepth 1 stops it from going deeper).
# 2. 'xargs -0 cat' safely concatenates all found files into one stream.
# 3. 'awk' filters this stream by comparing the timestamp ($1)
#	against the UTC start and end times.
# 4. 'sort' ensures the final combined output is in chronological order.

find "$TARGET_DIR" -maxdepth 1 -name "*.log" -print0 | xargs -0 cat | \
awk -v start="$START_UTC_STR" -v end="$END_UTC_STR" '
{
	# $1 is the first field (e.g., [2025-10-20T10:55:15.720Z])
	# We use string comparison:
	if ($1 >= start && $1 < end) {
		print $0;
	}
}
' | sort

echo "--- Search complete ---"