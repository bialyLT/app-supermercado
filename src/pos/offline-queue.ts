export type OfflineCommand = {
  commandId: string;
  kind: "SALE" | "ANNULMENT" | "PRODUCT_CREATE";
  endpoint: string;
  payload: unknown;
  createdAt: number;
};

const databaseName = "supermercado-pos";
const storeName = "commands";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "commandId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("OFFLINE_STORAGE_UNAVAILABLE"));
  });
}

export async function enqueue(command: OfflineCommand): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).put(command);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("OFFLINE_QUEUE_WRITE_FAILED"));
  });
  database.close();
}

export async function pendingCommands(): Promise<OfflineCommand[]> {
  const database = await openDatabase();
  const commands = await new Promise<OfflineCommand[]>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as OfflineCommand[]);
    request.onerror = () => reject(request.error ?? new Error("OFFLINE_QUEUE_READ_FAILED"));
  });
  database.close();
  return commands.sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(commandId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).delete(commandId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("OFFLINE_QUEUE_DELETE_FAILED"));
  });
  database.close();
}
