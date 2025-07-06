#!/bin/bash

# This script is used to run fio in subdirectories of the current directory.

# Get the current directory
current_dir=$(pwd)

# Get all subdirectories of the current directory
subdirs=$(find "$current_dir" -type d -mindepth 1 -maxdepth 1)

# Run fio in each subdirectory
for subdir in $subdirs; do
    echo "Processing: $(basename "$subdir")"
    
    # Check if a .env file exists in the subdirectory   
    if [ -f "$subdir/.env" ]; then
        cd "$subdir" && ../fio-analyzer-tests.sh --yes && cd "$current_dir"
        if [ $? -eq 0 ]; then
            echo "✓ Success"
        else
            echo "✗ Failed"
        fi
    else
        echo "⚠ Skipped (no .env)"
    fi
done

echo "Done"