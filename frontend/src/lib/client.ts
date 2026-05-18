import { client } from "@/api/services.gen";

// The generated SDK already includes the `/api` prefix in each path, so the
// base URL is just the API origin.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

client.setConfig({
  baseUrl,
});
