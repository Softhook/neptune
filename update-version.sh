#!/bin/bash
# Script to update version.js with latest git commit information

# Get the short commit hash
COMMIT_HASH=$(git log -1 --pretty=format:"%h")

# Get the commit message
COMMIT_MESSAGE=$(git log -1 --pretty=format:"%s")

# Create version.js file
cat > version.js << EOF
// Auto-generated file - DO NOT EDIT MANUALLY
// Run update-version.sh to regenerate this file

const VERSION_INFO = {
  commitHash: "${COMMIT_HASH}",
  commitMessage: "${COMMIT_MESSAGE}",
  lastUpdated: "$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
};
EOF

echo "Version information updated successfully!"
echo "Commit: ${COMMIT_HASH} - ${COMMIT_MESSAGE}"
