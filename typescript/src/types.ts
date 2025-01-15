export interface JsRequest {
  method: string;
  uri: string;
  headers: Record<string, string>;
  body: any;
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface JsResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
} 