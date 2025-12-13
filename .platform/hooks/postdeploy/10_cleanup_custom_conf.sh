#!/bin/bash
set -e

# AWS Elastic Beanstalk compatible script
# This script ensures proper nginx configuration for file uploads

# Check if we're running in Elastic Beanstalk environment
if [ -d "/etc/nginx/conf.d" ]; then
  TARGET="/etc/nginx/conf.d/custom.conf"

  if [ -f "$TARGET" ]; then
    echo "Removing legacy $TARGET"
    sudo rm -f "$TARGET"
  fi

  # Test nginx configuration and reload if successful
  if sudo nginx -t 2>/dev/null; then
    echo "Reloading nginx with updated configuration"
    sudo systemctl reload nginx || sudo service nginx reload
  else
    echo "Nginx configuration test failed, skipping reload"
    exit 1
  fi
else
  echo "Not in a standard nginx environment, skipping configuration"
fi
