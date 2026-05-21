#!/bin/bash
PORT=3005
PID=$(lsof -t -i:$PORT)

if [ ! -z "$PID" ]; then
    echo "⚠️ Port $PORT is already in use by process $PID. Stopping it first..."
    kill -9 $PID
    sleep 1
fi

echo "🚀 Starting Visualizer Server on port $PORT..."
nohup npm start > server.log 2>&1 &
sleep 2

# Check if started successfully
PID=$(lsof -t -i:$PORT)
if [ ! -z "$PID" ]; then
    echo "✅ Server started successfully!"
    echo "🔗 Local Visualizer: http://localhost:$PORT"
    echo "📝 Logs are being written to server.log"
else
    echo "❌ Failed to start the server. Check server.log for errors."
fi
