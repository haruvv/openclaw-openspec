export type StorageMode = "sqlite" | "durable-http";

export interface DurableHttpStorageConfig {
  baseUrl: string;
  token: string;
  artifactInlineByteThreshold: number;
}

export interface StorageConfig {
  mode: StorageMode;
  sqliteDbPath: string;
  durableHttp?: DurableHttpStorageConfig;
}

const DEFAULT_SQLITE_DB_PATH = "./data/pipeline.db";
const DEFAULT_ARTIFACT_INLINE_BYTE_THRESHOLD = 16 * 1024;

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const baseUrl = env.DURABLE_STORAGE_BASE_URL;
  const token = env.DURABLE_STORAGE_TOKEN;
  const sqliteDbPath = env.DB_PATH ?? DEFAULT_SQLITE_DB_PATH;

  if (baseUrl && token) {
    return {
      mode: "durable-http",
      sqliteDbPath,
      durableHttp: {
        baseUrl,
        token,
        artifactInlineByteThreshold: parsePositiveInteger(
          env.ARTIFACT_INLINE_BYTE_THRESHOLD,
          DEFAULT_ARTIFACT_INLINE_BYTE_THRESHOLD,
        ),
      },
    };
  }

  return {
    mode: "sqlite",
    sqliteDbPath,
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
