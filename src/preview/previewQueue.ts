type PreviewTask = () => Promise<void>;

let currentTask: Promise<void> | undefined;

export function enqueuePreviewRender(task: PreviewTask) {
  currentTask = (currentTask ?? Promise.resolve()).then(task).catch(() => undefined);
  return currentTask;
}

// TODO: add debounce, cancellation and incremental compilation once the Rust PDF command exists.
