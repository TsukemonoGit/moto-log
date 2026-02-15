/** グローバルトースト通知ストア */

let message = $state("");
let timeout: ReturnType<typeof setTimeout> | undefined;

export const toastStore = {
  get message() {
    return message;
  },

  show(msg: string, duration = 2000) {
    message = msg;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      message = "";
    }, duration);
  },

  clear() {
    message = "";
    if (timeout) clearTimeout(timeout);
  },
};
