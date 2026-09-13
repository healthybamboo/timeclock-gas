// サーバー API の呼び出し。GAS 上では google.script.run、ローカル開発時はモックを使う
import type { ServerApi } from "../shared/types";
import { createMockServer } from "./mockServer";

type Fn = (...args: never[]) => unknown;
type Promisify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<R> : never;
};
export type Api = Promisify<ServerApi>;

interface GoogleScriptRun {
  withSuccessHandler(cb: (value: unknown) => void): GoogleScriptRun;
  withFailureHandler(cb: (err: Error) => void): GoogleScriptRun;
  [fn: string]: unknown;
}
declare global {
  interface Window {
    google?: { script?: { run?: GoogleScriptRun } };
  }
}

function callGas<T>(name: string, args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const runner = window.google!.script!.run!.withSuccessHandler((v) => resolve(v as T)).withFailureHandler(
      (e) => reject(e instanceof Error ? e : new Error(String(e))),
    );
    (runner[name] as (...a: unknown[]) => void)(...args);
  });
}

const NAMES: (keyof ServerApi)[] = [
  "getStatus",
  "clockIn",
  "clockOut",
  "listRecords",
  "saveRecord",
  "deleteRecord",
  "listLogs",
  "getYearlySummary",
  "saveSettings",
  "listHolidays",
  "saveHoliday",
  "deleteHoliday",
];

function createApi(): Api {
  const isGas = typeof window !== "undefined" && !!window.google?.script?.run;
  if (!isGas) {
    console.info("[timeclock] google.script.run が無いためモックサーバーを使用します (localStorage)");
    const mock = createMockServer();
    return Object.fromEntries(
      NAMES.map((n) => [
        n,
        async (...args: unknown[]) => {
          await new Promise((r) => setTimeout(r, 150));
          return (mock[n] as Fn)(...(args as never[]));
        },
      ]),
    ) as Api;
  }
  return Object.fromEntries(NAMES.map((n) => [n, (...args: unknown[]) => callGas(n, args)])) as Api;
}

export const api: Api = createApi();
export const isMock = !(typeof window !== "undefined" && !!window.google?.script?.run);
