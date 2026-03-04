import {
  ENDPOINTS_BY_GROUP,
  type EndpointGroup,
  type WeworkEndpoint,
} from "./endpoints.js";

export type WeworkRequestMode = "direct" | "guid_request";

export interface GuidRequestOptions {
  appKey: string;
  appSecret: string;
  /**
   * Wrapper path on gateway.
   * Defaults to "/open/GuidRequest".
   */
  endpoint?: string;
}

export interface WeworkClientOptions {
  baseUrl: string;
  mode?: WeworkRequestMode;
  guidRequest?: GuidRequestOptions;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /**
   * Throw error when response has non-zero error_code.
   * Defaults to true.
   */
  throwOnBusinessError?: boolean;
}

export interface WeworkRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface WeworkApiResponse<T = unknown> {
  error_code: number;
  error_message: string;
  data: T;
  [key: string]: unknown;
}

export class WeworkApiError extends Error {
  status: number | undefined;
  endpoint: string | undefined;
  code: number | undefined;
  payload: unknown;

  constructor(
    message: string,
    details: {
      status?: number;
      endpoint?: string;
      code?: number;
      payload?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "WeworkApiError";
    this.status = details.status;
    this.endpoint = details.endpoint;
    this.code = details.code;
    this.payload = details.payload;
  }
}

export type ApiMethod = (
  body?: Record<string, unknown>,
  options?: WeworkRequestOptions,
) => Promise<WeworkApiResponse>;

export type WeworkApiTree = Record<EndpointGroup, Record<string, ApiMethod>>;

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBusinessResponse(value: unknown): value is WeworkApiResponse {
  return (
    isObject(value) &&
    typeof value.error_code === "number" &&
    typeof value.error_message === "string"
  );
}

function getBusinessError(
  value: unknown,
): { code: number; message: string } | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  if (
    typeof value.error_code === "number" &&
    typeof value.error_message === "string" &&
    value.error_code !== 0
  ) {
    return { code: value.error_code, message: value.error_message };
  }

  if (typeof value.code === "number" && value.code !== 0) {
    const message =
      (typeof value.msg === "string" && value.msg) ||
      (typeof value.message === "string" && value.message) ||
      (typeof value.error_message === "string" && value.error_message) ||
      "unknown business error";

    return { code: value.code, message };
  }

  return undefined;
}

function createApiTree(client: WeworkClient): WeworkApiTree {
  const api: Partial<WeworkApiTree> = {};

  for (const [group, endpoints] of Object.entries(
    ENDPOINTS_BY_GROUP,
  ) as Array<[EndpointGroup, readonly WeworkEndpoint[]]>) {
    const methods: Record<string, ApiMethod> = {};
    for (const endpoint of endpoints) {
      const action = endpoint.split("/")[2];
      if (!action) {
        continue;
      }

      const methodName = snakeToCamel(action);
      if (methods[methodName]) {
        throw new Error(
          `Duplicate method name "${group}.${methodName}" from endpoint "${endpoint}"`,
        );
      }

      methods[methodName] = (body = {}, options) =>
        client.post(endpoint, body, options);
    }

    api[group] = methods;
  }

  return api as WeworkApiTree;
}

export class WeworkClient {
  readonly baseUrl: string;
  readonly mode: WeworkRequestMode;
  readonly guidRequest: {
    appKey: string;
    appSecret: string;
    endpoint: string;
  } | null;
  readonly timeoutMs: number;
  readonly defaultHeaders: Record<string, string>;
  readonly throwOnBusinessError: boolean;
  readonly api: WeworkApiTree;

  constructor(options: WeworkClientOptions) {
    const normalizedBase = options.baseUrl.endsWith("/")
      ? options.baseUrl
      : `${options.baseUrl}/`;

    // Validate URL early.
    new URL(normalizedBase);

    const mode =
      options.mode ?? (options.guidRequest ? "guid_request" : "direct");
    if (mode === "guid_request" && !options.guidRequest) {
      throw new Error(
        'WeworkClient mode "guid_request" requires options.guidRequest.',
      );
    }

    this.baseUrl = normalizedBase;
    this.mode = mode;
    this.guidRequest =
      mode === "guid_request"
        ? {
            appKey: options.guidRequest!.appKey,
            appSecret: options.guidRequest!.appSecret,
            endpoint: options.guidRequest!.endpoint ?? "/open/GuidRequest",
          }
        : null;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.defaultHeaders = options.headers ?? {};
    this.throwOnBusinessError = options.throwOnBusinessError ?? true;
    this.api = createApiTree(this);
  }

  async post<T = unknown>(
    endpoint: WeworkEndpoint,
    body: unknown = {},
    options: WeworkRequestOptions = {},
  ): Promise<WeworkApiResponse<T>> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const timeoutController = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutController.signal])
      : timeoutController.signal;

    const timer = setTimeout(() => {
      timeoutController.abort(
        new Error(`Request timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);

    try {
      const requestUrl =
        this.mode === "guid_request"
          ? new URL(this.guidRequest!.endpoint, this.baseUrl)
          : new URL(endpoint, this.baseUrl);

      const requestBody =
        this.mode === "guid_request"
          ? {
              app_key: this.guidRequest!.appKey,
              app_secret: this.guidRequest!.appSecret,
              path: endpoint,
              data: body ?? {},
            }
          : (body ?? {});

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...this.defaultHeaders,
          ...options.headers,
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      const responseText = await response.text();
      let payload: unknown = {};

      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new WeworkApiError("Response is not valid JSON", {
            status: response.status,
            endpoint,
            payload: responseText,
          });
        }
      }

      if (!response.ok) {
        throw new WeworkApiError(
          `HTTP ${response.status} calling ${endpoint}`,
          {
            status: response.status,
            endpoint,
            payload,
          },
        );
      }

      if (
        this.throwOnBusinessError &&
        isBusinessResponse(payload) &&
        payload.error_code !== 0
      ) {
        throw new WeworkApiError(
          `Business error ${payload.error_code}: ${payload.error_message}`,
          {
            status: response.status,
            endpoint,
            code: payload.error_code,
            payload,
          },
        );
      }

      if (this.throwOnBusinessError) {
        const businessError = getBusinessError(payload);
        if (businessError) {
          throw new WeworkApiError(
            `Business error ${businessError.code}: ${businessError.message}`,
            {
              status: response.status,
              endpoint,
              code: businessError.code,
              payload,
            },
          );
        }
      }

      return payload as WeworkApiResponse<T>;
    } catch (error) {
      if (error instanceof WeworkApiError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new WeworkApiError(error.message, { endpoint });
      }

      throw new WeworkApiError("Unknown request error", { endpoint });
    } finally {
      clearTimeout(timer);
    }
  }
}
