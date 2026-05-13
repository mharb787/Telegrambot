import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createStore(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, "state.json");
  const state = await loadState(file);

  return {
    state,
    file,
    async save() {
      await atomicWrite(file, JSON.stringify(state, null, 2));
    },
    upsertToken(token) {
      const key = tokenKey(token.chainId, token.tokenAddress);
      state.tokens[key] = {
        ...(state.tokens[key] || {}),
        ...token,
        updatedAt: new Date().toISOString()
      };
      return state.tokens[key];
    },
    addSnapshot(snapshot) {
      const key = tokenKey(snapshot.chainId, snapshot.tokenAddress);
      state.snapshots[key] ||= [];
      state.snapshots[key].push(snapshot);
      state.snapshots[key] = state.snapshots[key].slice(-500);
    },
    getSnapshots(chainId, tokenAddress) {
      return state.snapshots[tokenKey(chainId, tokenAddress)] || [];
    },
    canAlert(chainId, tokenAddress, kind, cooldownMinutes) {
      const key = `${tokenKey(chainId, tokenAddress)}:${kind}`;
      const last = state.alerts[key];
      if (!last) return true;
      return Date.now() - Date.parse(last) > cooldownMinutes * 60_000;
    },
    markAlert(chainId, tokenAddress, kind) {
      state.alerts[`${tokenKey(chainId, tokenAddress)}:${kind}`] = new Date().toISOString();
    }
  };
}

export function tokenKey(chainId, tokenAddress) {
  return `${chainId}:${String(tokenAddress).toLowerCase()}`;
}

async function loadState(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return { tokens: {}, snapshots: {}, alerts: {} };
  }
}

async function atomicWrite(file, content) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, file);
}
