/**
 * LazyModule — defer loading heavy imports until first use.
 *
 * Wraps a dynamic import() so the module is never loaded at pi startup.
 * The module is loaded only when .get() is first called.
 * Errors are cached so repeated calls don't retry.
 *
 * Use this for any adopted package with heavy dependencies
 * (native binaries, WASM, TypeScript compiler, etc.) to keep
 * pi startup time fast.
 */

export class LazyModule<TModule = unknown> {
  private _module: TModule | undefined;
  private _error: Error | undefined;
  private _loading: Promise<TModule> | undefined;

  /**
   * @param importFn  Async function that returns the module (typically `() => import("name")`)
   * @param name      Human-readable name for error messages
   */
  constructor(
    private readonly importFn: () => Promise<TModule>,
    private readonly name: string,
  ) {}

  /**
   * Get the module, loading it on first call.
   * Subsequent calls return the cached module (or re-throw the cached error).
   */
  async get(): Promise<TModule> {
    if (this._module) return this._module;
    if (this._error) throw this._error;

    if (!this._loading) {
      this._loading = this.importFn()
        .then((mod) => {
          this._module = mod;
          return mod;
        })
        .catch((err: unknown) => {
          this._error = err instanceof Error ? err : new Error(String(err));
          throw this._error;
        });
    }

    return this._loading;
  }

  /** True if the module has been loaded (successfully or not) */
  isLoaded(): boolean {
    return this._module !== undefined;
  }

  /** Reset cached module/error so next get() re-imports */
  reset(): void {
    this._module = undefined;
    this._error = undefined;
    this._loading = undefined;
  }
}
