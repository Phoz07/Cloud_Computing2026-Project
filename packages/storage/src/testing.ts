import { Files } from "files-sdk";
import { memory } from "files-sdk/memory";
import { setStorageAdapter } from "./store";

/** Points @app/storage at a fresh in-memory store and returns it, so tests can assert on objects. */
export function useMemoryStorage() {
  const adapter = memory();
  setStorageAdapter(adapter);
  return new Files({ adapter });
}
