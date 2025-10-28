declare module 'node:path' {
  export function resolve(...paths: string[]): string;
}

declare const __dirname: string;
