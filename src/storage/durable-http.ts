import type { DurableHttpStorageConfig } from "./config.js";
import type { PutArtifactBodyInput, StoredArtifactBody } from "./types.js";
import { randomUUID } from "node:crypto";

export interface StorageSqlStatement {
  sql: string;
  params?: unknown[];
}

export interface StorageSqlResult<T = unknown> {
  results?: T[];
  success?: boolean;
}

export interface DurableHttpStorageClientOptions {
  config: DurableHttpStorageConfig;
  fetchImpl?: typeof fetch;
}

export class DurableHttpStorageClient {
  private readonly config: DurableHttpStorageConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DurableHttpStorageClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async executeSql<T = unknown>(statements: StorageSqlStatement[]): Promise<Array<StorageSqlResult<T>>> {
    const response = await this.request("/internal/storage/sql", {
      method: "POST",
      body: JSON.stringify({ statements }),
    });
    const body = (await response.json()) as { results?: Array<StorageSqlResult<T>> };
    return body.results ?? [];
  }

  async putArtifactBody(input: PutArtifactBodyInput): Promise<StoredArtifactBody> {
    const byteSize = Buffer.byteLength(input.contentText, "utf8");
    if (byteSize <= this.config.artifactInlineByteThreshold) {
      return {
        storage: "inline",
        contentText: input.contentText,
        byteSize,
        contentType: input.contentType,
      };
    }

    const objectKey = buildArtifactObjectKey(input);
    await this.request("/internal/storage/artifacts", {
      method: "POST",
      body: JSON.stringify({
        key: objectKey,
        contentText: input.contentText,
        contentType: input.contentType,
      }),
    });
    return {
      storage: "object",
      objectKey,
      byteSize,
      contentType: input.contentType,
    };
  }

  async getArtifactBody(reference: StoredArtifactBody): Promise<string | null> {
    if (reference.storage === "inline") return reference.contentText;

    const response = await this.request(`/internal/storage/artifacts/${encodeURIComponent(reference.objectKey)}`, {
      method: "GET",
    });
    if (response.status === 404) return null;
    return response.text();
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(new URL(path, this.config.baseUrl), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.token}`,
        ...init.headers,
      },
    });
    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => "");
      throw new Error(`Durable storage request failed: ${response.status} ${text}`);
    }
    return response;
  }
}

export function buildArtifactObjectKey(input: PutArtifactBodyInput): string {
  const label = input.label
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "artifact";
  const id = randomUUID();

  if (input.runId) {
    return `agent-runs/${input.runId}/${id}-${label}`;
  }

  if (input.siteId) {
    return `sites/${input.siteId}/artifacts/${id}-${label}`;
  }

  return `artifacts/${id}-${label}`;
}
