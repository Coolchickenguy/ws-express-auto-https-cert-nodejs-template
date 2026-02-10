import http from "http";
export type routeTypes = "post" | "get" | "use";
export type exists<
  V,
  Key extends string | number | symbol,
  fallback extends any,
> = ({ [key in keyof V]: V[key] } & { [key in any]: fallback })[Key];
export interface request extends http.IncomingMessage {}
export interface response extends http.ServerResponse {}

export type entries<
  T,
  K extends T extends any ? keyof T : never = T extends any ? keyof T : never,
> = K extends any
  ? T extends any
    ? K extends keyof T
      ? [K, T[K]]
      : never
    : never
  : never;
