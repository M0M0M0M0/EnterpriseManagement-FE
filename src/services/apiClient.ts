import type { ApiListResponse } from "../types/domain";

export interface ApiClientOptions {
  accessToken?: string;
  baseUrl?: string;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly accessToken?: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "/api";
    this.accessToken = options.accessToken;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

export function toListResponse<T>(
  items: T[],
  page = 1,
  pageSize = 20,
): ApiListResponse<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}
