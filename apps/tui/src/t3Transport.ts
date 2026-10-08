import type { WsTransport } from "@t3tools/client-core";
import type {
  OrchestrationReadModel,
  WsPush,
  WsPushChannel,
  WsPushMessage,
} from "@t3tools/contracts";

type Wire = Record<string, any>;
type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
  stream?: (value: Wire) => void;
};

export function adaptT3Thread(thread: Wire, detail?: Wire): Wire {
  detail = detail?.thread;
  return {
    ...thread,
    ...detail,
    model: thread.modelSelection?.model ?? thread.model,
    deletedAt: null,
    // Replayed async-answer records can share an ID. Keep the latest version
    // so React and native renderables have exactly one child for each message.
    messages: [
      ...new Map((detail?.messages ?? []).map((message: Wire) => [message.id, message])).values(),
    ],
    proposedPlans: detail?.proposedPlans ?? [],
    activities: detail?.activities ?? [],
    checkpoints: detail?.checkpoints ?? [],
  };
}

export function adaptT3Config(config: Wire): Wire {
  return {
    ...config,
    providerInstances: config.providers,
    providers: config.providers
      .filter((p: Wire) => p.driver === "codex" || p.driver === "claudeAgent")
      .map((p: Wire) => Object.assign({}, p, { provider: p.driver })),
  };
}

// This is a client-side protocol adapter. All requests and mutations go to T3;
// it neither opens a database nor starts a provider process.
export class T3Transport implements Pick<
  WsTransport,
  "request" | "subscribe" | "getLatestPush" | "dispose"
> {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<string, Pending>();
  private listeners = new Map<string, Set<(message: WsPush) => void>>();
  private latest = new Map<string, WsPush>();
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private connectPromise: Promise<void> | undefined;
  private activeThreadId: string | undefined;
  private threadSubscription: string | undefined;
  private shellSubscription: string | undefined;
  private revision = 0;
  private changeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly origin: string,
    private readonly token: string,
    private readonly selectedThread: () => string | undefined,
    private readonly selectedModel: () => Wire = () => {
      throw new Error("A model selection is required for thread mutations");
    },
  ) {}

  private connect(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("Transport disposed"));
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const ws = new (WebSocket as unknown as new (
        url: string,
        options: { headers: Record<string, string> },
      ) => WebSocket)(this.origin.replace(/^http/, "ws") + "/ws", {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      this.ws = ws;
      ws.addEventListener("open", () => {
        resolve();
        this.connectPromise = undefined;
        this.startSubscriptions();
      });
      ws.addEventListener("message", (event) => {
        const envelope = JSON.parse(String(event.data));
        for (const message of Array.isArray(envelope) ? envelope : [envelope])
          this.receive(message);
      });
      ws.addEventListener("error", () =>
        reject(new Error("Could not connect to T3. Check t3code-backend.service and try again.")),
      );
      ws.addEventListener("close", () => {
        reject(new Error("T3 connection closed"));
        this.ws = null;
        this.connectPromise = undefined;
        for (const entry of this.pending.values()) {
          if (entry.timer) clearTimeout(entry.timer);
          entry.reject(new Error("T3 connection closed"));
        }
        this.pending.clear();
        this.shellSubscription = undefined;
        this.threadSubscription = undefined;
        if (!this.disposed)
          this.reconnectTimer = setTimeout(() => {
            void this.connect().catch(() => {});
          }, 1500);
      });
    });
    return this.connectPromise;
  }

  private receive(message: Wire): void {
    if (message._tag === "Defect") {
      for (const entry of this.pending.values()) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.reject(new Error(JSON.stringify(message.defect)));
      }
      this.pending.clear();
      return;
    }
    if (message._tag === "Ping") {
      this.ws?.send(JSON.stringify({ _tag: "Pong" }));
      return;
    }
    const id = String(message.requestId);
    const pending = this.pending.get(id);
    if (!pending) return;
    if (message._tag === "Chunk") {
      this.ws?.send(JSON.stringify({ _tag: "Ack", requestId: id }));
      for (const value of message.values) pending.stream?.(value);
      return;
    }
    if (message._tag === "Exit") {
      this.pending.delete(id);
      if (pending.timer) clearTimeout(pending.timer);
      if (message.exit._tag === "Success") pending.resolve(message.exit.value);
      else pending.reject(new Error(JSON.stringify(message.exit.cause)));
    }
  }

  private async rpc<T>(
    tag: string,
    payload: unknown = {},
    timeoutMs: number | null = 60000,
  ): Promise<T> {
    await this.connect();
    const id = String(this.nextId++);
    return new Promise<T>((resolve, reject) => {
      const timer =
        timeoutMs === null
          ? null
          : setTimeout(() => {
              this.pending.delete(id);
              this.interrupt(id);
              reject(new Error(`T3 request timed out: ${tag}`));
            }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ _tag: "Request", id, tag, payload, headers: [] }));
    });
  }

  private interrupt(id: string): void {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ _tag: "Interrupt", requestId: id }));
  }

  private stream(
    tag: string,
    payload: unknown,
    onValue: (value: Wire) => void,
    onError: (error: Error) => void = () => {},
  ): string {
    const id = String(this.nextId++);
    this.pending.set(id, { resolve: () => {}, reject: onError, timer: null, stream: onValue });
    this.ws!.send(JSON.stringify({ _tag: "Request", id, tag, payload, headers: [] }));
    return id;
  }

  private async firstSnapshot(tag: string, payload: unknown): Promise<Wire> {
    await this.connect();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.interrupt(id);
        reject(new Error(`T3 snapshot timed out: ${tag}`));
      }, 15000);
      const id = this.stream(
        tag,
        payload,
        (item) => {
          if (item.kind !== "snapshot") return;
          clearTimeout(timer);
          this.pending.delete(id);
          this.interrupt(id);
          resolve(item.snapshot);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private emit(channel: string, data: unknown): void {
    const message = { type: "push", channel, data } as WsPush;
    this.latest.set(channel, message);
    for (const listener of this.listeners.get(channel) ?? []) listener(message);
  }

  private changed(): void {
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = undefined;
      this.revision++;
      this.emit("orchestration.domainEvent", { sequence: this.revision });
    }, 200);
  }

  private startSubscriptions(): void {
    this.shellSubscription = this.stream("orchestration.subscribeShell", {}, () => this.changed());
    this.stream("subscribeServerConfig", {}, (item) => {
      if (item.type === "settingsUpdated")
        this.emit("server.configUpdated", { settings: item.payload.settings });
      if (item.type === "snapshot") this.emit("server.configUpdated", adaptT3Config(item.config));
      if (item.type === "providerStatuses")
        this.emit("server.configUpdated", {
          issues: [],
          ...adaptT3Config({ providers: item.payload.providers }),
        });
    });
    this.stream("subscribeTerminalEvents", {}, (item) => this.emit("terminal.event", item));
    this.watchThread(this.activeThreadId);
  }

  private watchThread(threadId: string | undefined): void {
    if (this.threadSubscription) {
      this.pending.delete(this.threadSubscription);
      this.interrupt(this.threadSubscription);
    }
    this.activeThreadId = threadId;
    this.threadSubscription = threadId
      ? this.stream("orchestration.subscribeThread", { threadId }, (item) => {
          if (item.kind !== "snapshot") this.changed();
        })
      : undefined;
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: { timeoutMs?: number | null },
  ): Promise<T> {
    if (method === "orchestration.getSnapshot") {
      const shell = await this.firstSnapshot("orchestration.subscribeShell", {});
      const archived = await this.rpc<Wire>("orchestration.getArchivedShellSnapshot", {});
      const threads: Wire[] = [...shell.threads, ...archived.threads];
      const selected = this.selectedThread();
      const threadId = threads.some((t) => t.id === selected) ? selected : threads[0]?.id;
      if (threadId !== this.activeThreadId || !this.threadSubscription) this.watchThread(threadId);
      const detail = threadId
        ? await this.firstSnapshot("orchestration.subscribeThread", { threadId })
        : undefined;
      return {
        ...shell,
        projects: [
          ...new Map(
            [...shell.projects, ...archived.projects].map((p: Wire) => [
              p.id,
              { ...p, defaultModel: p.defaultModelSelection?.model ?? null, deletedAt: null },
            ]),
          ).values(),
        ],
        threads: threads.map((thread) =>
          adaptT3Thread(thread, thread.id === threadId ? detail : undefined),
        ),
      } as unknown as OrchestrationReadModel as T;
    }
    let payload = params;
    const input = (params ?? {}) as Wire;
    const gitMethods: Record<string, string> = {
      "git.status": "vcs.refreshStatus",
      "git.pull": "vcs.pull",
      "git.listBranches": "vcs.listRefs",
      "git.createWorktree": "vcs.createWorktree",
      "git.removeWorktree": "vcs.removeWorktree",
      "git.createBranch": "vcs.createRef",
      "git.checkout": "vcs.switchRef",
      "git.init": "vcs.init",
    };
    const rpcMethod = gitMethods[method] ?? method;
    if (method === "git.createWorktree")
      payload = { ...input, refName: input.branch, newRefName: input.newBranch };
    if (method === "git.createBranch")
      payload = { ...input, refName: input.branch, switchRef: input.checkout };
    if (method === "git.checkout") payload = { ...input, refName: input.branch };
    if (method === "orchestration.dispatchCommand") {
      payload = (params as Wire).command;
      const command = payload as Wire;
      if (
        (command.type === "thread.create" || command.type === "thread.meta.update") &&
        command.model
      )
        payload = { ...command, modelSelection: { ...this.selectedModel(), model: command.model } };
      if (command.modelSelection?.provider)
        payload = {
          ...command,
          modelSelection: {
            ...command.modelSelection,
            instanceId: command.modelSelection.instanceId ?? command.modelSelection.provider,
          },
        };
    }
    const result = await this.rpc<Wire>(rpcMethod, payload ?? {}, options?.timeoutMs);
    if (method === "git.status") return { ...result, branch: result.refName } as T;
    if (method === "git.listBranches")
      return {
        ...result,
        hasOriginRemote: result.hasPrimaryRemote,
        branches: result.refs.map((ref: Wire) => ({ ...ref, name: ref.name ?? ref.refName })),
      } as T;
    if (method === "git.createWorktree")
      return { ...result, worktree: { ...result.worktree, branch: result.worktree.refName } } as T;
    return (method === "server.getConfig" ? adaptT3Config(result) : result) as T;
  }

  subscribe<C extends WsPushChannel>(
    channel: C,
    listener: (message: WsPushMessage<C>) => void,
    options?: { replayLatest?: boolean },
  ): () => void {
    const set = this.listeners.get(channel) ?? new Set();
    this.listeners.set(channel, set);
    const callback = listener as (message: WsPush) => void;
    set.add(callback);
    const latest = this.latest.get(channel);
    if (latest && options?.replayLatest) callback(latest);
    return () => {
      set.delete(callback);
    };
  }

  getLatestPush<C extends WsPushChannel>(channel: C): WsPushMessage<C> | null {
    return (this.latest.get(channel) as WsPushMessage<C>) ?? null;
  }

  dispose(): void {
    this.disposed = true;
    if (this.changeTimer) clearTimeout(this.changeTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
