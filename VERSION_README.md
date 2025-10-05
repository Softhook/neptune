# Version Information

The game's title screen displays version information from the latest git commit.

## How it works

The version information is stored in `version.js`, which is auto-generated from git commit data. This file contains:
- Commit hash (short form)
- Commit message
- Last updated timestamp

## Updating Version Information

After making commits, run the update script to refresh the version info:

```bash
./update-version.sh
```

This will regenerate `version.js` with the latest commit information.

## Note

`version.js` is listed in `.gitignore` and should not be committed to the repository. Each developer or deployment should generate their own version file based on their local git state.

When deploying or sharing the game, make sure to run `update-version.sh` first to ensure the version reflects the current commit.
