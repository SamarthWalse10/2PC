const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "raft.proto");
const NODE_COUNT = 5;
const HEARTBEAT_INTERVAL = 1000;

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const raftProto = grpc.loadPackageDefinition(packageDefinition).raft;

class RaftNode {
  constructor(id, peers) {
    this.id = id;
    this.peers = peers;
    this.term = 0;
    this.log = [];
    this.commitIndex = -1;
    this.lastExecuted = -1;
    this.isLeader = id === 0; // Node 0 starts as leader for simplicity
    this.peerClients = {};

    // Initialize peer connections
    this.peers.forEach((peer) => {
      if (peer.id !== this.id) {
        this.peerClients[peer.id] = new raftProto.RaftService(
          `0.0.0.0:${peer.port}`,
          grpc.credentials.createInsecure()
        );
      }
    });
  }

  start() {
    const server = new grpc.Server();
    server.addService(raftProto.RaftService.service, {
      AppendEntries: this.handleAppendEntries.bind(this),
      RequestVote: this.handleRequestVote.bind(this),
      ClientRequest: this.handleClientRequest.bind(this),
    });

    server.bindAsync(
      `0.0.0.0:${this.peers[this.id].port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          console.error(`Failed to start node ${this.id}:`, err);
          return;
        }
        console.log(`Node ${this.id} started on port ${port}`);

        if (this.isLeader) {
          this.startHeartbeat();
        }
      }
    );
  }

  startHeartbeat() {
    setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  async sendHeartbeat() {
    const request = {
      leaderId: this.id,
      entries: this.log,
      commitIndex: this.commitIndex,
      term: this.term,
    };

    for (const peerId in this.peerClients) {
      console.log(`Node ${this.id} sends RPC AppendEntries to Node ${peerId}`);
      this.peerClients[peerId].AppendEntries(request, (err, response) => {
        if (err) {
          console.error(`Failed to send heartbeat to node ${peerId}:`, err);
          return;
        }
      });
    }
  }

  handleAppendEntries(call, callback) {
    console.log(
      `Node ${this.id} runs RPC AppendEntries called by Node ${call.request.leaderId}`
    );

    // Update log with leader's entries
    this.log = call.request.entries;

    // Execute any newly committed operations
    while (this.lastExecuted < call.request.commitIndex) {
      this.lastExecuted++;
      const entry = this.log[this.lastExecuted];
      if (entry) {
        console.log(`Node ${this.id} executing operation:`, entry.operation);
      }
    }

    callback(null, { success: true, term: this.term });
  }

  handleRequestVote(call, callback) {
    console.log(
      `Node ${this.id} runs RPC RequestVote called by Node ${call.request.candidateId}`
    );
    callback(null, { voteGranted: true, term: this.term });
  }

  handleClientRequest(call, callback) {
    console.log(`Node ${this.id} received client request`);

    if (!this.isLeader) {
      // Forward to leader
      this.peerClients[0].ClientRequest(call.request, callback);
      return;
    }

    // Leader handling
    const entry = {
      operation: call.request.command,
      term: this.term,
      index: this.log.length,
    };

    this.log.push(entry);
    this.sendHeartbeat();

    // Wait for majority acknowledgment
    setTimeout(() => {
      this.commitIndex = this.log.length - 1;
      callback(null, {
        success: true,
        result: `Operation executed: ${call.request.command}`,
      });
    }, 500);
  }
}

// Create and start nodes
const peers = Array.from({ length: NODE_COUNT }, (_, i) => ({
  id: i,
  port: 50051 + i,
}));

const nodeId = parseInt(process.env.NODE_ID || "0");
const node = new RaftNode(nodeId, peers);
node.start();
