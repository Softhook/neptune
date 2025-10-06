# Version Information

The game's title screen displays version information fetched directly from the GitHub API.

## How it works

The version information is fetched in real-time from GitHub's public API when the game loads:
- API endpoint: `https://api.github.com/repos/Softhook/neptune/commits/main`
- Displays: Commit hash (first 7 characters) and commit message (first line)

The `VersionManager` class in `sketch.js` handles three states:
1. **Loading** - Shows "Version - Loading..." while fetching
2. **Success** - Shows "Version abc1234 - Commit message" when loaded
3. **Error** - Shows "Version - Unavailable" if the API is unreachable

## Benefits

- ✅ No local files to maintain or update
- ✅ Always shows the latest commit information from GitHub
- ✅ No need to run scripts before deploying
- ✅ Graceful degradation when offline or API unavailable
- ✅ Works automatically on any deployment

## Legacy Files (No Longer Used)

The following files are no longer used and can be ignored:
- `update-version.sh` - Previously used to generate version.js
- `version.js` - No longer referenced in the code

These files are kept for reference but are not part of the current implementation.
