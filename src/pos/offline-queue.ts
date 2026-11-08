import { ApiError, apiFetch } from "../client/api-fetch";

export type OfflineCommand = {
  commandId: string;
  kind: "SALE" | "ANNULMENT" | "PRODUCT_CREATE";
  endpoint: string;
  payload: unknown;
  createdAt: number;
  state?: "pending" | "processing" | "completed" | "conflict" | "error";
  lastError?: string;
};

export type QueueState = NonNullable<OfflineCommand["state"]>;
export function getQueueStateLabel(state: QueueState): string {
  return ({ pending: "Pendientes", processing: "Procesando", completed: "Completados", conflict: "Conflictos", error: "Requieren reintento" })[state];
}

type Requester = typeof apiFetch;

export async function replayOfflineCommand(
  command: OfflineCommand,
  request: Requester = apiFetch,
): Promise<Pick<OfflineCommand, "state" | "lastError">> {
  try {
    await request(command.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": command.commandId,
      },
      body: JSON.stringify(command.payload),
    });
    return { state: "completed", lastError: undefined };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { state: "error", lastError: "Sesión vencida. Volvé a ingresar." };
    }
    if (error instanceof ApiError && error.status === 409) {
      return { state: "conflict", lastError: "Revisión requerida" };
    }
    if (error instanceof ApiError && error.status === 0) {
      return { state: "error", lastError: "Sin conexión. Reintentá cuando vuelva la red." };
    }
    return { state: "error", lastError: "No se pudo completar. Reintentá." };
  }
}

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

export async function update(commandId: string, patch: Pick<OfflineCommand, "state" | "lastError">): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).get(commandId);
    request.onsuccess = () => {
      const command = request.result as OfflineCommand | undefined;
      if (!command) { resolve(); return; }
      const write = database.transaction(storeName, "readwrite").objectStore(storeName).put({ ...command, ...patch });
      write.onsuccess = () => resolve();
      write.onerror = () => reject(write.error ?? new Error("OFFLINE_QUEUE_UPDATE_FAILED"));
    };
    request.onerror = () => reject(request.error ?? new Error("OFFLINE_QUEUE_READ_FAILED"));
  });
  database.close();
}
