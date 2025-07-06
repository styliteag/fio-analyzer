#!/bin/bash

# This script is used to run fio in subdirectories of the current directory.

# Get the current directory
current_dir=$(pwd)

# Get all subdirectories of the current directory
subdirs=$(find $current_dir -type d)

# Run fio in each subdirectory
for subdir in $subdirs; do
    echo "Running fio in $subdir"
    # check if a .env file exists in the subdirectory   
    if [ -f "$subdir/.env" ]; then
        echo "Running fio in $subdir"
        cd $subdir
        ../fio-analyzer-tests.sh --yes
        cd $current_dir
    else
        echo "No .env file found in $subdir, skipping"
    fi
done

echo "Done"