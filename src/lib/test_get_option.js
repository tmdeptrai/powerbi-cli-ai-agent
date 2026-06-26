const { getOptionContent } = require("/home/tmd/.nvm/versions/node/v22.17.1/lib/node_modules/@powerbi-cli/powerbi-cli/bin/lib/options.js");

try {
  const query = getOptionContent("EVALUATE TOPN(10, 'CoffeSales')");
  console.log("Query content:", query);
} catch (e) {
  console.error("Failed with error:", e);
}
