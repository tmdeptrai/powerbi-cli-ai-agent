const jmespath = require("/home/tmd/.nvm/versions/node/v22.17.1/lib/node_modules/@powerbi-cli/powerbi-cli/node_modules/jmespath");

const data = {"results":[{"tables":[{"rows":[{"CoffeSales[hour_of_day]":7,"CoffeSales[cash_type]":"card"}]}]}]};

const path1 = "[results[0].tables[0].rows]";
const path2 = "results[0].tables[0].rows";

console.log("Path 1:", JSON.stringify(jmespath.search(data, path1)));
console.log("Path 2:", JSON.stringify(jmespath.search(data, path2)));
