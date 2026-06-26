const { getAccessToken } = require("/home/tmd/.nvm/versions/node/v22.17.1/lib/node_modules/@powerbi-cli/powerbi-cli/bin/lib/token.js");
const { TokenType } = require("/home/tmd/.nvm/versions/node/v22.17.1/lib/node_modules/@powerbi-cli/powerbi-cli/bin/lib/auth.js");

async function run() {
  try {
    const token = await getAccessToken(TokenType.POWERBI);
    if (!token) {
      console.log("No token found. Please sign in.");
      return;
    }
    
    console.log("Token acquired (first 20 chars):", token.substring(0, 20));

    const datasetId = "3b3a7354-b79a-4ce5-942e-904cb11d0a15";
    const url = `https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/executeQueries`;
    
    const dax = "EVALUATE TOPN(10, 'CoffeSales')";
    const body = JSON.stringify({
      queries: [{ query: dax }],
      serializerSettings: { includeNulls: true }
    });

    console.log("Sending query:", dax);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: body
    });

    console.log("Status:", response.status, response.statusText);
    const responseText = await response.text();
    console.log("Raw Response:\n", responseText);
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
