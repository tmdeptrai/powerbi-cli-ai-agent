const { validateDatasetId, validateGroupId } = require("/home/tmd/.nvm/versions/node/v22.17.1/lib/node_modules/@powerbi-cli/powerbi-cli/bin/lib/parameters.js");

async function run() {
  try {
    const groupId = await validateGroupId(undefined, false);
    console.log("GroupId:", groupId);
    const datasetId = await validateDatasetId(groupId, "CoffeeSales", true);
    console.log("DatasetId resolved:", datasetId);
  } catch (e) {
    console.error("Validation failed with error:", e);
  }
}

run();
