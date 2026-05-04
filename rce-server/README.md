# rce server poc

This is a proof of concept for a rce server that can be used with the runner container hooks. It is based on the [rce-agent](https://github.com/wd-hopkins/rce-agent) project.

To test this on a local k8s cluster, run the following:

```bash
# Create Kind cluster
kind create cluster

# Build the rce-server image
cd rce-server
docker build -t rce-server:test .

# Load the image into the kind cluster
kind load docker-image rce-server:test

# Run the test
cd ../packages/k8s
ACTIONS_RUNNER_IMAGE=rce-server:test ./node_modules/jest/bin/jest.js --testNamePattern="^Run script step with RCE should not throw an exception$" --runTestsByPath tests/run-script-step-test.ts
```
