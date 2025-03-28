const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "raft.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const raftProto = grpc.loadPackageDefinition(packageDefinition).raft;

function testSystem() {
  const client = new raftProto.RaftService(
    "0.0.0.0:50051",
    grpc.credentials.createInsecure()
  );

  client.ClientRequest({ command: "test operation" }, (err, response) => {
    if (err) {
      console.error("Error:", err);
      return;
    }
    console.log("Response:", response);
  });
}

testSystem();
