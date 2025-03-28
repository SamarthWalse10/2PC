const { spawn } = require("child_process");

const NODE_COUNT = 5;

for (let i = 0; i < NODE_COUNT; i++) {
  const node = spawn("node", ["index.js"], {
    env: { ...process.env, NODE_ID: i.toString() },
  });

  node.stdout.on("data", (data) => {
    console.log(`Node ${i}:`, data.toString());
  });

  node.stderr.on("data", (data) => {
    console.error(`Node ${i} Error:`, data.toString());
  });
}
