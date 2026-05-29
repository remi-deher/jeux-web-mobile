#!/bin/sh

# Start the Node.js backend in the background
echo "Starting Node.js backend..."
cd /app/backend
node dist/server.js &

# Start Nginx in the foreground
echo "Starting Nginx frontend..."
exec nginx -g "daemon off;"
