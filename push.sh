#!/bin/bash

# A simple script to add, commit, and push changes to GitHub.
# Usage: ./push.sh "Your commit message here"

if [ -z "$1" ]; then
    echo "❌ Error: Please provide a commit message."
    echo "Usage: ./push.sh \"Your commit message\""
    exit 1
fi

COMMIT_MSG="$1"

echo "📦 Staging changes..."
git add .

echo "📝 Committing changes..."
git commit -m "$COMMIT_MSG"

echo "🚀 Pushing to origin..."
git push origin HEAD

echo "✅ Done!"
