export function createDomLifecycle({ onDomChange, delay = 120 }) {
  let timer = null;

  const run = () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      onDomChange();
    }, delay);
  };

  const observer = new MutationObserver(run);

  return {
    start(root = document.body) {
      if (!root) return;
      observer.observe(root, {
        childList: true,
        subtree: true
      });
    },
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      observer.disconnect();
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      onDomChange();
    }
  };
}
