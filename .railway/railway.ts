import { defineRailway, project, service } from "railway/iac";

// One service: Express serves the static page in public/ and /api/health.
export default defineRailway(() => {
  const web = service("web", {
    build: { buildEnvironment: "V3", builder: "RAILPACK" },
    start: "npm start",
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    replicas: { "us-west2": 1 },
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 },
  });

  return project("sleeper-fantasy-report", {
    variables: { managed: false },
    resources: [web],
  });
});
