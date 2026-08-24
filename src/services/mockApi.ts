import { createSeedData } from "../data/seed";
import { toListResponse } from "./apiClient";

const latencyMs = 180;

function wait() {
  return new Promise((resolve) => window.setTimeout(resolve, latencyMs));
}

export const mockApi = {
  async list<T>(items: T[], page = 1, pageSize = 20) {
    await wait();
    return toListResponse(items, page, pageSize);
  },
  async health() {
    await wait();
    return {
      status: "healthy",
      mode: "mock",
      checkedAt: new Date().toISOString(),
    };
  },
  async seed() {
    await wait();
    return createSeedData();
  },
};
