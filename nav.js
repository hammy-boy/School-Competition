import { RARITIES } from './catalyst.js';
import { MILESTONES, bySection, beatName } from './save.js';

/**
 * The navigation hub: one panel, two doors. Either you go back into the room you
 * stopped in, or you go out to the list of rooms you have already stood in and
 * start one again. It appears on a load that finds a saved run and from the pause
 * menu — never after a knockout, because going down on the floor is a beat of the
 * story, not a failure state.
 */
export class Nav {
  constructor(handlers) {
    this.h = handlers;
    this.el = document.getElementById('nav');
    this.kicker = this.el.querySelector('.kicker');
    this.title = this.el.querySelector('h1');
    this.where = this.el.querySelector('#nav-where');
    this.actions = this.el.querySelector('#nav-actions');
    this.list = this.el.querySelector('#nav-list');
    this.origin = 'boot';        // where the panel was opened from, so BACK lands there
    this.state = null;           // 'boot' | 'menu' | 'select'
    this.shown = false;
  }

  /** @param {'boot'|'menu'} mode — boot asks to be continued, menu asks to be left */
  show(mode) {
    const s = this.h.save();
    if (!s) return false;
    this.origin = this.state = mode;
    this.el.classList.remove('hidden');
    this.shown = true;
    if (mode === 'select') this._renderSelect(s);
    else this._renderRoom(s, mode);
    return true;
  }

  hide() {
    this.el.classList.add('hidden');
    this.shown = false;
  }

  /** the one line of state that matters: where, how much of you, what you can hit with */
  _summary(s) {
    const m = bySection(s.section);
    const pips = `${'●'.repeat(s.resolve)}${'○'.repeat(Math.max(0, 3 - s.resolve))}`;
    const def = s.catalyst && RARITIES.find((d) => d.key === s.catalyst.key);
    const parts = [
      `CHAPTER ${m ? m.ch : 1} · SECTION ${s.section} — ${m ? m.name : 'FURTHER IN'}`,
      `YOU STOPPED AT ${beatName(s.phase).toUpperCase()}`,
      `RESOLVE ${pips} ${s.resolve} OF 3`,
    ];
    if (def) parts.push(`${def.tier} · ${def.name} — LOCKED IN`);
    return parts.join(' · ');
  }

  _renderRoom(s, mode) {
    const m = bySection(s.section);
    this.state = mode;
    this.kicker.textContent = mode === 'boot'
      ? 'THE BOUND ESCAPE · A RUN IS STILL STANDING'
      : 'THE BOUND ESCAPE · WHERE YOU STAND';
    this.title.innerHTML = mode === 'boot'
      ? `YOU STOPPED<br><em>${m ? m.name : 'FURTHER IN'}</em>`
      : `THE FIGHT<br><em>IS STILL ON</em>`;
    this.where.textContent = this._summary(s);
    this.list.innerHTML = '';
    this.list.classList.add('hidden');
    const specs = mode === 'boot'
      ? [{ label: 'CONTINUE CURRENT', fn: () => this.h.onContinue(s) },
         { label: 'SECTION SELECT', ghost: true, fn: () => this._toSelect() },
         { label: 'START OVER', ghost: true, fn: () => this.h.onNew() }]
      : [{ label: 'BACK TO THE FIGHT', fn: () => this.h.onClose() },
         { label: 'SECTION SELECT', ghost: true, fn: () => this._toSelect() }];
    this._buttons(specs);
    this._note();
  }

  _toSelect() { this.state = 'select'; this._renderSelect(this.h.save()); }

  _renderSelect(s) {
    this.kicker.textContent = 'THE BOUND ESCAPE · SECTION SELECT';
    this.title.innerHTML = 'CHOOSE<br><em>A ROOM</em>';
    this.where.textContent = 'Every place you have already stood in. Going back to an earlier '
      + 'room means the rift rolls your ability again — that is the only way to gamble for a '
      + 'different pull, and nothing you have already beaten gets taken off you.';
    this._buttons([{ label: 'BACK', ghost: true, fn: () => this._renderRoom(this.h.save(), this.origin) }]);
    this.list.classList.remove('hidden');
    this.list.innerHTML = '';
    const reached = new Set(s.reached || []);
    for (const m of MILESTONES) {
      if (!this.h.canPlay(m.phase)) continue;      // a room that is not built yet is not a row
      if (!reached.has(m.id)) {
        const d = document.createElement('div');
        d.className = 'ms locked';
        d.innerHTML = `<b>CHAPTER ${m.ch} · SECTION ${m.sec}</b><span class="ms-n">${m.name}</span>`
          + `<span class="ms-l">SEALED — YOU HAVE NOT REACHED IT YET</span>`;
        this.list.appendChild(d);
        continue;
      }
      const b = document.createElement('button');
      b.className = 'ms';
      b.innerHTML = `<b>CHAPTER ${m.ch} · SECTION ${m.sec}</b><span class="ms-n">${m.name}</span>`
        + `<span class="ms-l">${m.line}</span>`;
      b.addEventListener('click', () => { this.h.audio(); this.h.onJump(m); });
      this.list.appendChild(b);
    }
    this._note();
  }

  _note() {
    this.el.querySelector('#nav-note').textContent =
      'REFRESH THE PAGE OR ESC → MENU ANY TIME · A KNOCKOUT PUTS YOU BACK ON YOUR FEET IN THE SAME ROOM';
  }

  _buttons(specs) {
    this.actions.innerHTML = '';
    for (const b of specs) {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b.ghost) el.className = 'ghost';
      el.addEventListener('click', () => { this.h.audio(); b.fn(); });
      this.actions.appendChild(el);
    }
  }
}
