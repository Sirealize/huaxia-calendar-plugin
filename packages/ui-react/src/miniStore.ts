/**
 * 左下角月历的偏好存储：一个极小的可订阅 store，落在 `localStorage`。
 *
 * 为什么需要 store：卡片（`shell.overlay`）和设置卡片（`settings.section`）是两个
 * 独立的 React 挂载点，但共享同一份状态（显示开关、收起、拖拽位置）。用一个
 * 模块级的 store 让两边都能读能写，且都不依赖宿主 API（ui-react 仍然与 DSH 解耦）。
 *
 * 没有 `localStorage`（Node / verify / 隐私模式）时自动退化为纯内存：功能照常，
 * 只是刷新后不持久化。
 */
import { useEffect, useState } from 'react'
import {
  MINI_PREFS_DEFAULT,
  MINI_PREFS_KEY,
  parseMiniPrefs,
  patchMiniPrefs,
  serializeMiniPrefs,
  type MiniPrefs,
} from './pure/mini.ts'

/** 只依赖 `Storage` 的三个方法，便于测试注入假的实现。 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 偏好 store 的读 / 写 / 订阅三个方法。 */
export interface MiniCalendarStore {
  /** 当前偏好（同步读，用于渲染首帧）。 */
  get(): MiniPrefs
  /**
   * 合并写入：只改传入的字段；无实际变化时既不通知也不落盘。
   * @param patch - 偏好的局部更新。
   */
  set(patch: Partial<MiniPrefs>): void
  /**
   * 订阅变化。
   * @param listener - 变化回调。
   * @returns 取消订阅函数。
   */
  subscribe(listener: () => void): () => void
}

export interface CreateMiniCalendarStoreOptions {
  /** localStorage 键名，默认 {@link MINI_PREFS_KEY}。 */
  key?: string
  /** 注入存储实现（测试用）；传 `null` 表示强制纯内存。 */
  storage?: StorageLike | null
}

function resolveStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // 隐私模式下访问 localStorage 可能直接抛错。
    return null
  }
}

function readStorage(storage: StorageLike | null, key: string): string | null {
  if (storage === null) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: StorageLike | null, key: string, value: string): void {
  if (storage === null) return
  try {
    storage.setItem(key, value)
  } catch {
    // 配额满 / 隐私模式：偏好不持久化不影响本次会话。
  }
}

/**
 * 建一个偏好 store。
 *
 * @param options - 键名与存储实现覆盖（默认读 `globalThis.localStorage`）。
 * @returns 可订阅的 store；首次读取时用 {@link parseMiniPrefs} 做防御式解析。
 */
export function createMiniCalendarStore(
  options: CreateMiniCalendarStoreOptions = {},
): MiniCalendarStore {
  const key = options.key ?? MINI_PREFS_KEY
  const storage = options.storage === undefined ? resolveStorage() : options.storage
  let state = parseMiniPrefs(readStorage(storage, key))
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set(patch) {
      const next = patchMiniPrefs(state, patch)
      if (next === state) return
      state = next
      writeStorage(storage, key, serializeMiniPrefs(next))
      // 复制一份再遍历：监听器里可能反手退订。
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** 默认 store（宿主半侧不传自定义 store 时使用；也可由宿主注入）。 */
export function defaultMiniPrefs(): MiniPrefs {
  return {
    position: MINI_PREFS_DEFAULT.position,
    collapsed: MINI_PREFS_DEFAULT.collapsed,
    visible: MINI_PREFS_DEFAULT.visible,
  }
}

/**
 * 订阅 store 的 React hook。
 *
 * 不用 `useSyncExternalStore` 是为了让没有 React 真实实现的离线校验
 * （`verify.mjs` 的 React 替身）也能渲染首帧结构。
 *
 * @param store - 偏好 store。
 * @returns 当前偏好；store 变化时重渲染。
 */
export function useMiniCalendarPrefs(store: MiniCalendarStore): MiniPrefs {
  const [prefs, setPrefs] = useState<MiniPrefs>(() => store.get())
  useEffect(() => {
    const sync = (): void => setPrefs(store.get())
    // 两次渲染之间 store 可能已被另一个挂载点改过，先对齐一次。
    sync()
    return store.subscribe(sync)
  }, [store])
  return prefs
}
