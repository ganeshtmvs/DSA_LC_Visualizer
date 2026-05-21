#!/bin/bash
PORT=3005
PID=$(lsof -t -i:$PORT)

if [ ! -z "$PID" ]; then
    echo "🛑 Stopping Visualizer Server running on port $PORT (PID: $PID)..."
    kill -9 $PID
    echo "✅ Server stopped successfully!"
else
    echo "ℹ️ No server was running on port $PORT."
fi
