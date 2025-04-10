#!/bin/bash

API_SOCKET="/tmp/firecracker.socket"
TAP_DEV="tap0"

echo "Attempting to shut down Firecracker VM..."

FC_PIDS=$(pgrep -f "firecracker --api-sock")

if [ -n "$FC_PIDS" ]; then
  echo "Found Firecracker process(es): $FC_PIDS. 
  Sending SIGTERM..."

  echo "$FC_PIDS" | xargs -r sudo kill -TERM
  sleep 2

  for PID in $FC_PIDS; do
    if ps -p "$PID" > /dev/null; then
      echo "Process $PID still running. Sending SIGKILL..."
      sudo kill -KILL "$PID"
    else
      echo "Firecracker process $PID terminated gracefully."
    fi
  done
else
  echo "No running Firecracker processes found."
fi

# Clean up the API socket file
echo "Removing API socket ${API_SOCKET}..."
sudo rm -f "$API_SOCKET"

# Clean up the network interface
echo "Deleting network interface ${TAP_DEV}..."
sudo ip link del "$TAP_DEV" 2> /dev/null || echo "Tap device ${TAP_DEV} already deleted or never existed."

echo "Shutdown script finished."
