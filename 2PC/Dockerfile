FROM node:18-bullseye

RUN apt-get update && apt-get install -y python3 python3-pip

WORKDIR /app

COPY proto/twophase.proto ./proto/

# Generate protobufs
RUN npm install -g grpc-tools
RUN grpc_tools_node_protoc --proto_path=proto --js_out=import_style=commonjs,binary:./ --grpc_out=grpc_js:./ proto/twophase.proto

RUN pip install grpcio grpcio-tools
RUN python3 -m grpc_tools.protoc --proto_path=proto --python_out=. --grpc_python_out=. proto/twophase.proto

# Copy appropriate code based on role
COPY coordinator/vote_phase.js .
COPY coordinator/decision_phase.py .
COPY participant/vote_phase.js participant/
COPY participant/decision_phase.py participant/

CMD if [ "$NODE_ID" = "coordinator" ]; then \
        python3 decision_phase.py >> /var/log/decision.log 2>&1 & \
        node vote_phase.js >> /var/log/vote.log 2>&1 & \
        tail -f /var/log/*.log; \
    else \
        python3 participant/decision_phase.py >> /var/log/decision.log 2>&1 & \
        node participant/vote_phase.js >> /var/log/vote.log 2>&1 & \
        tail -f /var/log/*.log; \
    fi

