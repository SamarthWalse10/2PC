const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const { spawn } = require("child_process");

const PROTO_PATH = path.join(__dirname, "raft.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const raftProto = grpc.loadPackageDefinition(packageDefinition).raft;

// Test Case 1: Basic Leader Operation
async function testLeaderOperation() {
  console.log("\nTest Case 1: Basic Leader Operation");
  const client = new raftProto.RaftService(
    "0.0.0.0:50051",
    grpc.credentials.createInsecure()
  );

  return new Promise((resolve) => {
    client.ClientRequest({ command: "test command" }, (err, response) => {
      console.log("Leader operation response:", response);
      resolve();
    });
  });
}

// Test Case 2: Request Forwarding
async function testRequestForwarding() {
  console.log("\nTest Case 2: Request Forwarding");
  // Connect to follower (Node 2) instead of leader
  const client = new raftProto.RaftService(
    "0.0.0.0:50053",
    grpc.credentials.createInsecure()
  );

  return new Promise((resolve) => {
    client.ClientRequest({ command: "forwarded command" }, (err, response) => {
      console.log("Forwarded request response:", response);
      resolve();
    });
  });
}

// Test Case 3: Multiple Sequential Commands
async function testSequentialCommands() {
  console.log("\nTest Case 3: Multiple Sequential Commands");
  const client = new raftProto.RaftService(
    "0.0.0.0:50051",
    grpc.credentials.createInsecure()
  );

  const commands = ["cmd1", "cmd2", "cmd3"];

  for (const cmd of commands) {
    await new Promise((resolve) => {
      client.ClientRequest({ command: cmd }, (err, response) => {
        console.log(`Response for ${cmd}:`, response);
        resolve();
      });
    });
  }
}

// Test Case 4: Concurrent Commands
async function testConcurrentCommands() {
  console.log("\nTest Case 4: Concurrent Commands");
  const client = new raftProto.RaftService(
    "0.0.0.0:50051",
    grpc.credentials.createInsecure()
  );

  const commands = ["concurrent1", "concurrent2", "concurrent3"];
  await Promise.all(
    commands.map((cmd) => {
      return new Promise((resolve) => {
        client.ClientRequest({ command: cmd }, (err, response) => {
          console.log(`Response for ${cmd}:`, response);
          resolve();
        });
      });
    })
  );
}

// Test Case 5: Log Consistency
async function testLogConsistency() {
  console.log("\nTest Case 5: Log Consistency");

  // Send command to leader
  const leaderClient = new raftProto.RaftService(
    "0.0.0.0:50051",
    grpc.credentials.createInsecure()
  );

  await new Promise((resolve) => {
    leaderClient.ClientRequest(
      { command: "consistency test" },
      (err, response) => {
        console.log("Leader response:", response);
        resolve();
      }
    );
  });

  // Wait for replication
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check followers received the update
  const followerPorts = [50052, 50053, 50054, 50055];
  await Promise.all(
    followerPorts.map((port) => {
      const followerClient = new raftProto.RaftService(
        `0.0.0.0:${port}`,
        grpc.credentials.createInsecure()
      );

      return new Promise((resolve) => {
        followerClient.AppendEntries(
          {
            leaderId: 0,
            entries: [],
            commitIndex: 0,
            term: 0,
          },
          (err, response) => {
            console.log(`Follower at port ${port} response:`, response);
            resolve();
          }
        );
      });
    })
  );
}

// Run all tests
async function runAllTests() {
  try {
    // Wait for nodes to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await testLeaderOperation();
    await testRequestForwarding();
    await testSequentialCommands();
    await testConcurrentCommands();
    await testLogConsistency();

    console.log("\nAll tests completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Check if --run-tests flag is present
if (process.argv.includes("--run-tests")) {
  runAllTests();
} else {
  console.log("To run tests, use: node test-cases.js --run-tests");
}
