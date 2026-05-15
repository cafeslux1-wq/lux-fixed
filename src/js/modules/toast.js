/**
 * toast.js — Reusable toast notification component.
 */

const Toast = {
  _el: null,
  _timer: null,

  _ensure() {
    if (!this._el) {
      this._el = document.getElementById('lux-toast');
    }
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.id = 'lux-toast';
      document.body.appendChild(this._el);
    }
    return this._el;
  },

  show(msg, type = '') {
    const el = this._ensure();
    el.textContent = msg;
    el.className = `show ${type ? 'toast-' + type : ''}`;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { el.className = ''; }, 3000);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  gold:    (msg) => Toast.show(msg, 'gold'),
};

export default Toast;
