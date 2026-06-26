const { queryAction } = require("/home/tmd/.nvm/versions/node/v22.17.1/lib/node_modules/@powerbi-cli/powerbi-cli/bin/dataset/query.js");

async function run() {
  const options = {
    D: "CoffeeSales",
    dax: "EVALUATE TOPN(10, 'CoffeSales')"
  };
  const cmd = {
    outputFormat: "json",
    jmsePath: undefined
  };

  try {
    console.log("Calling queryAction...");
    const result = await queryAction(options, cmd);
    console.log("queryAction resolved successfully. Result:", result);
  } catch (e) {
    console.error("queryAction rejected with error:", e);
  }
}

run();
