import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../backend/openapi.json",
  output: {
    path: "src/api",
    format: "prettier",
  },
  client: "@hey-api/client-fetch",
});
