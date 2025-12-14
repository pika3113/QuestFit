# Archive

This folder contains old scripts and test data that are no longer actively used but kept for reference.

## Old Scripts

Located in `old-scripts/`:

- **fetch-real-user-activities.js** - Original script that fetched Polar data and saved to local JSON files (replaced by sync-polar-data-to-firebase.js)
- **preview-firebase-structure.js** - Mock preview script for Firebase structure

These have been replaced by the production scripts in `/scripts/`:
- `sync-polar-data-to-firebase.js` - Combined fetch + insert
- `query-firebase-data.js` - Query Firebase data
- `insert-sample-data-to-firebase.js` - Insert sample data

## Old Sample Data

Located in `old-sample-data/`:

Sample JSON files used for testing:
- activities/
- cardioLoad/
- contHR/
- exercise/
- insertdata/
- sleep/

The current production data is stored in `/sampleJson/realData/` with real user data from Polar API.
