export type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  cookies?: Record<string, string>;
} & Record<string, unknown>;

export type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
  redirect: ((url: string) => void) & ((status: number, url: string) => void);
  setHeader: (name: string, value: string | string[]) => void;
  end: (body?: unknown) => void;
} & Record<string, unknown>;
