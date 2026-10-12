const root = document.documentElement;
const $ = (s) => document.querySelector(s);

export class Hud {
  constructor() {
    this.capEl = $('#caption');
    this.capWho = this.capEl.querySelector('b');
    this.capText = this.capEl.querySelector('p');
    this.promptEl = $('#prompt');
    this.hintEl = $('#hint');
    this.m = {
      load: $('#m-load'),
      desp: $('#m-desp'),
      resolve: $('#m-resolve'),
      anom: $('#m-anom'),
    };
    this.bars = {
      load: $('#m-load .bar i'),
      desp: $('#m-desp .bar i'),
      anom: $('#m-anom .bar i'),
    };
    this.anomLbl = $('#m-anom .lbl');
    this.pips = [...document.querySelectorAll('#m-resolve .pips i')];
    this._capTimer = null;
  }

  css(name, value) { root.style.setProperty(name, value); }

  darkness(v) { this.css('--dark', v.toFixed(3)); }
  blur(px) { this.css('--blur', px.toFixed(2) + 'px'); }
  dmg(v) { this.css('--dmg', v.toFixed(3)); }
  flash(v) { this.css('--flash', v.toFixed(3)); }

  caption(who, text, { think = false, hold = 4 } = {}) {
    this.capEl.classList.toggle('think', think);
    this.capWho.textContent = who;
    this.capText.textContent = text;
    this.capEl.classList.remove('hidden');
    clearTimeout(this._capTimer);
    if (hold > 0) this._capTimer = setTimeout(() => this.capEl.classList.add('hidden'), hold * 1000);
  }
  clearCaption() { this.capEl.classList.add('hidden'); }

  /** html string; pass null to hide */
  prompt(html) {
    if (!html) { this.promptEl.classList.add('hidden'); this._html = null; return; }
    if (html === this._html) return;          // don't restart the animation every frame
    this._html = html;
    this.promptEl.innerHTML = html;
    this.promptEl.classList.remove('hidden');
  }

  brace(on) { this.m.load.classList.toggle('braced', on); }

  meter(which, v01, hot = false) {
    const el = this.bars[which];
    if (!el) return;
    el.style.width = `${Math.round(Math.max(0, Math.min(1, v01)) * 100)}%`;
    this.m[which].classList.toggle('hot', hot);
    if (which === 'desp') this.m.desp.classList.toggle('full', v01 >= 0.999);
  }

  resolve(n) {
    this.pips.forEach((p, i) => p.classList.toggle('off', i >= n));
  }

  /** the anomaly meter only exists once the rift has been through you */
  anomalyLabel(def) {
    if (!def) {
      this.m.anom.classList.add('hidden');
      this.anomLbl.textContent = 'ANOMALY';
      return;
    }
    this.m.anom.classList.remove('hidden');
    this.anomLbl.textContent = `${def.tier} · ${def.name}`;
    this.css('--anom', def.hex);
  }

  anomaly(charge01, ready) {
    this.meter('anom', charge01, ready);
    this.m.anom.classList.toggle('full', ready);
  }

  hint(html) { this.hintEl.innerHTML = html || ''; }
  get hintText() { return this.hintEl.innerHTML; }
}
