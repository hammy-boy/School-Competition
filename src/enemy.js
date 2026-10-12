import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
V.lerpVectors = (a, b, t) => new THREE.Vector3().lerpVectors(a, b, t);
const UP = V(0, 1, 0);

function limb(parent, mat, r1, r2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 1, 7), mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function place(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length() || 0.001;
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
}

/** walking speeds for the modes that use the generic "go to a point" locomotion */
const WALK_SPEED = { enter: 1.15, rush: 2.6, wall: 0.66, flee: 3.4 };

/**
 * A brute built out of boxes. Posed procedurally, tumbles on a rigid
 * ragdoll curve when the lights go out.
 */
export class Guard {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.tall = opts.tall ?? 1;
    this.canvasColor = opts.canvas ?? 0x6b5a3f;
    this.mode = 'offscreen';
    this.t = 0;
    this.stagger = 0;
    this.ko = false;
    this.koT = 0;
    this.swingSide = 1;
    this.landed = false;
    this.onEvent = null;      // (name, payload) => {}

    const skin = new THREE.MeshStandardMaterial({ color: 0xb08063, roughness: 0.8 });
    const jacket = new THREE.MeshStandardMaterial({ color: this.canvasColor, roughness: 0.98 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x24232a, roughness: 0.95 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 1 });

    this.root = new THREE.Group();
    scene.add(this.root);
    this.hips = new THREE.Group();
    this.hips.position.y = 0.92 * this.tall;
    this.root.add(this.hips);

    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), jacket);
    chest.position.y = 0.3; chest.castShadow = true;
    this.torso.add(chest);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.28), jacket);
    belly.position.y = -0.06; this.torso.add(belly);

    this.headG = new THREE.Group();
    this.headG.position.y = 0.68;
    this.torso.add(this.headG);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.25, 0.22), skin);
    skull.castShadow = true;
    this.headG.add(skull);
    this.headG.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.23), hair).translateY(0.11));
    // eyes and a brow line — you need to be able to tell which way the face is
    for (const ex of [-0.045, 0.045]) {
      this.headG.add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x120d0b, roughness: 1 })).translateX(ex).translateY(0.04).translateZ(-0.115));
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x2a1e1a, roughness: 1 }));
    mouth.position.set(0, -0.06, -0.115);
    this.headG.add(mouth);

    this.limbs = {};
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? -1 : 1;
      this.limbs[s] = {
        upper: limb(this.torso, jacket, 0.075, 0.062),
        fore: limb(this.torso, skin, 0.062, 0.05),
        hand: new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.16), skin),
        thigh: limb(this.hips, pants, 0.1, 0.085),
        shin: limb(this.hips, pants, 0.085, 0.07),
        foot: new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.28), boot),
        sx,
      };
      this.torso.add(this.limbs[s].hand);
      this.hips.add(this.limbs[s].foot);
      this.limbs[s].hand.castShadow = true;
      this.limbs[s].foot.castShadow = true;
    }

    this.baton = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x5c3f24, roughness: 0.85 }));
    this.baton.castShadow = true;
    this.baton.visible = false;
    this.torso.add(this.baton);
    this.hasBaton = !!opts.baton;

    this.lighter = null;
    if (opts.lighter) {
      this.lighter = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.075, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.85 }));
      this.torso.add(this.lighter);
    }

    this.enforcer = !!opts.enforcer;
    this.shield = null;
    this.scout = !!opts.scout;
    this.officer = !!opts.officer;
    this.vulnerable = false;
    this.exo = 0;
    this.strafe = 1;
    this.holdOff = false;         // someone else is already committed: keep circling
    this.groundY = 0;            // -90 on a catwalk with no deck under it
    if (this.enforcer) this.dressAsEnforcer();
    if (this.scout) this.dressAsScout();
    if (this.officer) this.dressAsOfficer();

    this.v = new THREE.Vector3();
    this.spin = new THREE.Vector3();
    this.targetPos = new THREE.Vector3();
    this.walk = 0;
  }

  /**
   * Riot kit: a slab of polycarbonate you cannot punch through, dense ballistic
   * armour, and a helmet with no jaw to hit. The whole point of Section Two is
   * that your fists stop working here.
   */
  dressAsEnforcer() {
    const vest = new THREE.MeshStandardMaterial({ color: 0x1d2833, roughness: 0.85 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x39424c, roughness: 0.55, metalness: 0.5 });
    this.torso.children[0].material = vest;
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.1), plate).translateY(0.34).translateZ(-0.19));
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.14), plate).translateY(0.52).translateZ(-0.2));
    for (const sx of [-1, 1]) {
      this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.26), plate)
        .translateX(sx * 0.32).translateY(0.52));
    }
    this.headG.children[0].material = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.6 });
    this.headG.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.27), plate).translateY(0.06));
    this.headG.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.2, metalness: 0.4 })).translateY(0.02).translateZ(-0.14));

    const polycarb = new THREE.MeshStandardMaterial({
      color: 0xbfe3ea, roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.32,
      side: THREE.DoubleSide,
    });
    this.shield = new THREE.Group();
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.52, 0.05), polycarb);
    this.shield.add(face);
    for (const [w, h, x, y] of [[0.98, 0.07, 0, 0.76], [0.98, 0.07, 0, -0.76], [0.07, 1.52, 0.47, 0], [0.07, 1.52, -0.47, 0]]) {
      this.shield.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), plate).translateX(x).translateY(y));
    }
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x081114, roughness: 0.3 }));
    slit.position.set(0, 0.44, 0.01);
    this.shield.add(slit);
    for (const sx of [-0.24, 0.24]) {
      this.shield.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), plate)
        .translateX(sx).translateY(-0.1).translateZ(0.09));
    }
    this.shield.position.set(0, 0.42, -0.56);
    this.shield.rotation.x = 0.1;
    this.torso.add(this.shield);
    this.shieldUp = true;
  }

  /**
   * Scout kit: no shield, no baton, nothing to hide behind. Compressed-air
   * exo-boots and weighted steel knuckles — everything about them is built to
   * close distance fast, which is also exactly what makes them throwable.
   */
  dressAsScout() {
    const suit = new THREE.MeshStandardMaterial({ color: 0x171d22, roughness: 0.92 });
    const shell = new THREE.MeshStandardMaterial({ color: 0x3a444c, roughness: 0.42, metalness: 0.62 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x9ba3aa, roughness: 0.22, metalness: 0.94 });
    this.exoCell = new THREE.MeshStandardMaterial({ color: 0x0c2730, emissive: 0x38ccf5, emissiveIntensity: 0.6, roughness: 0.3 });

    this.torso.children[0].material = suit;
    this.torso.children[1].material = suit;
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.08), shell).translateY(0.34).translateZ(-0.19));
    // the drop harness on the back, and the hook the line clips to
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.2), shell).translateY(0.34).translateZ(0.19));
    this.torso.add(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.024, 5, 10), steel).translateY(0.56).translateZ(0.3));
    for (const sx of [-1, 1]) {
      this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.25), shell).translateX(sx * 0.3).translateY(0.53));
      this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.06), suit).translateX(sx * 0.15).translateY(0.3).translateZ(-0.17));
    }
    for (const s of ['L', 'R']) this.limbs[s].upper.material = suit;
    // recon helmet: a hot lens strip and an ear cup, but the jaw is still bare
    this.headG.children[0].material = new THREE.MeshStandardMaterial({ color: 0x303b43, roughness: 0.5, metalness: 0.34 });
    this.headG.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.26), shell).translateY(0.1));
    this.headG.add(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.045, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x120a08, emissive: 0xff3a1c, emissiveIntensity: 1.2, roughness: 0.25 }))
      .translateY(0.04).translateZ(-0.135));
    this.headG.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.1), shell).translateX(0.135));
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 5), steel);
    boom.position.set(0.07, -0.06, -0.08);
    boom.rotation.z = 1.0;
    this.headG.add(boom);

    // weighted knuckles: the reason a hit from one of these is not a shove
    for (const s of ['L', 'R']) {
      const h = this.limbs[s].hand;
      h.material = steel;
      h.scale.set(1.12, 1.06, 1.02);
      h.add(new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.05, 0.1), shell).translateY(0.065));
      for (let i = 0; i < 3; i++) {
        h.add(new THREE.Mesh(new THREE.SphereGeometry(0.023, 6, 5), steel)
          .translateX(-0.042 + i * 0.042).translateZ(-0.082));
      }
    }
    // exo-boots: a piston over the shin, a heel strut, and a cell that lights up.
    // The cell faces forward — the coil telegraph has to be readable head-on.
    for (const s of ['L', 'R']) {
      const f = this.limbs[s].foot;
      f.material = shell;
      f.scale.set(1.3, 1.6, 1.2);
      f.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 6), steel).translateY(0.15).translateZ(0.05));
      f.add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.13), this.exoCell).translateY(0.05).translateZ(-0.11));
      f.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.12), steel).translateY(-0.06).translateZ(0.13));
    }
    this.baton.visible = false;
    this.hasBaton = false;
  }

  /** the man who was using the console: a clean suit, a tablet, and no weapon */
  dressAsOfficer() {
    const suit = new THREE.MeshStandardMaterial({ color: 0xd9ceb4, roughness: 0.96 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xc07a24, roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b1a1e, emissive: 0x2f8290, emissiveIntensity: 0.85, roughness: 0.2 });
    this.torso.children[0].material = suit;
    this.torso.children[1].material = suit;
    for (const s of ['L', 'R']) this.limbs[s].upper.material = suit;
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.31), trim).translateY(0.14));
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.02), trim).translateX(0.09).translateY(0.34).translateZ(-0.16));
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 })).translateY(0.42).translateZ(-0.16));
    this.torso.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.012), glass).translateY(0.24).translateZ(-0.17));
    this.tablet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.33, 0.02), glass);
    this.tablet.position.set(0, 0.02, -0.15);
    this.tablet.rotation.x = -0.55;
    this.limbs.L.hand.add(this.tablet);
    this.headG.children[1].material = new THREE.MeshStandardMaterial({ color: 0x77664c, roughness: 1 });
    this.baton.visible = false;
    this.hasBaton = false;
  }

  point(part, out = new THREE.Vector3()) {
    const map = { head: this.headG, chest: this.torso, knee: this.root, hand: this.limbs.R.hand, shield: this.shield };
    const o = map[part] || this.root;
    o.getWorldPosition(out);
    if (part === 'head') out.y += 0.02;
    if (part === 'chest') out.y += 0.28;
    if (part === 'knee') out.y += 0.45;
    return out;
  }

  /** a raised riot shield eats any strike aimed at the head or the chest */
  blocksHit(part) {
    return !!this.shield && this.shieldUp && !this.ko && (part === 'head' || part === 'chest');
  }

  /** a scout that is still on its feet is simply not where your fist arrives.
   *  The only window is the one its own momentum opens for you. */
  evadesHit() {
    return this.scout && !this.ko && !this.vulnerable && this.mode !== 'offscreen';
  }

  distanceTo(pos) { return this.point('chest', new THREE.Vector3()).distanceTo(pos); }

  event(name, payload) { this.onEvent?.(name, payload, this); }

  setMode(m, time = 0) {
    if (this.mode === m) return;
    this.mode = m;
    this.t = time;
    if (m === 'wind') {
      this.swingSide = Math.random() < 0.5 ? -1 : 1;
      this.swingResolved = false;
      this.event('wind', { side: this.swingSide });
    }
    if (m === 'swing') this.swingResolved = false;
    if (m === 'rush' || m === 'enter' || m === 'wall') this.overextended = false;
    if (m === 'wall') this.shieldUp = true;
    if (m === 'scalded' || m === 'ko' || m === 'groan') this.shieldUp = false;
    // the scout loop: off-balance is the only state you are allowed to touch
    this.vulnerable = m === 'stagger' || m === 'slip';
    if (this.scout) this.overextended = this.vulnerable;
    if (m === 'circle') {
      this.strafe = Math.random() < 0.5 ? -1 : 1;
      this.coilAt = 0.8 + Math.random() * 1.2;
    }
    if (m === 'coil') { this.exo = 0; this.event('coil'); }
    if (m === 'drop') this.dropV = -1.5;
    if (m === 'dash') this.event('dash');
  }

  goTo(x, z) { this.targetPos.set(x, 0, z); }

  /** picks the line at the *start* of the coil: what you do in the next half
   *  second is the whole fight, and the scout has already committed to it */
  beginDash(player) {
    const p = player.root.position;
    this.dashAim = p.clone();
    const d = new THREE.Vector3(p.x - this.root.position.x, 0, p.z - this.root.position.z);
    if (d.lengthSq() < 1e-5) d.set(0, 0, -1);
    d.normalize();
    this.dashDir = d;
    const reach = Math.hypot(p.x - this.root.position.x, p.z - this.root.position.z);
    this.dashLen = Math.max(2.2, reach + 2.7);   // it does not stop on you
    this.dashT = 0;
    this.dashE = 0;
    this.dashResolved = false;
    this.lungeLanded = false;
    this.setMode('dash');
  }

  /** exo-boot traversal: a hard drop, a circling close, then a straight line.
   *  Returns the leg swing so the walk cycle matches the speed. */
  scoutMove(dt, player) {
    const m = this.mode;
    if (m === 'drop') {
      this.dropV -= 21 * dt;
      this.root.position.y += this.dropV * dt;
      if (this.root.position.y <= this.groundY) {
        this.root.position.y = this.groundY;
        this.setMode('circle');
        this.event('scoutLand');
      }
      return 0;
    }
    if (m === 'dash') {
      this.dashT += dt;
      const dur = this.dashLen / 7.8;
      const k = Math.min(1, this.dashT / dur);
      const e = 1 - Math.pow(1 - k, 2.1);        // all of the speed up front
      // integrate the line rather than re-measuring it from where he started, so
      // the rail is allowed to stop him: an exo-boot dash into a handrail is the
      // whole reason he ends up off balance
      const step = this.dashLen * (e - this.dashE);
      this.dashE = e;
      this.root.position.x += this.dashDir.x * step;
      this.root.position.z += this.dashDir.z * step;
      this.walk += dt * 17;
      if (!this.dashResolved && this.dashT >= dur * 0.58) {
        this.dashResolved = true;
        this.event('lunge', { aim: this.dashAim, dir: this.dashDir });
      }
      if (k >= 1) this.setMode(this.lungeLanded ? 'recover' : 'stagger');
      return Math.sin(this.walk) * 0.9;
    }
    if (m !== 'circle') return 0;
    const pp = player.root.position;
    const dx = pp.x - this.root.position.x, dz = pp.z - this.root.position.z;
    const dist = Math.hypot(dx, dz) || 1e-4;
    const nx = dx / dist, nz = dz / dist;
    const k = THREE.MathUtils.clamp((dist - 3.1) / 1.6, -1, 1);
    const tang = 1 - Math.abs(k) * 0.45;
    const vx = nx * k - nz * this.strafe * tang;
    const vz = nz * k + nx * this.strafe * tang;
    const mag = Math.hypot(vx, vz) || 1e-4;
    this.root.position.x += (vx / mag) * 3.3 * dt;
    this.root.position.z += (vz / mag) * 3.3 * dt;
    this.walk += dt * 9.5;
    if (Math.random() < dt * 0.55) this.strafe *= -1;
    if (!this.holdOff && this.t > this.coilAt && dist < 6.4) this.setMode('coil');
    const ph = Math.sin(this.walk) < 0;
    if (ph !== this._stepPhase) { this._stepPhase = ph; this.event('footstep'); }
    return Math.sin(this.walk) * 0.62;
  }

  knockOut(vx, vy, vz, spin) {
    this.ko = true;
    this.koT = 0;
    this.setMode('ko');
    this.v.set(vx, vy, vz);
    this.spin.set(spin ?? -7.5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 3);
    this.event('ko');
  }

  /** accumulates damage; the caller performs the collapse so it can aim it */
  damage(amount) {
    this.stagger += amount;
    this.flinch = Math.min(0.7, (this.flinch || 0) + amount * 0.18);
    if (this.stagger >= 3.2) return { ko: true };
    this.event('flinch', { amount });
    return { ko: false };
  }

  update(dt, player, ctx = {}) {
    this.t += dt;
    this.flinch = Math.max(0, (this.flinch || 0) - dt * 2.4);
    this.exo = Math.max(0, this.exo - dt * 2);
    const L = this.limbs;

    if (this.ko) {
      this.koT += dt;
      // rigid tumble: the whole body rotates backward over its heels
      this.v.y -= 13 * dt;
      this.root.position.addScaledVector(this.v, dt);
      this.root.rotation.x += this.spin.x * dt;
      this.root.rotation.y += this.spin.y * dt;
      this.root.rotation.z += this.spin.z * dt;
      this.spin.x *= 1 - dt * 0.9;
      if (this.root.position.y <= this.groundY && this.v.y < 0) {
        if (!this.landed) { this.landed = true; this.event('land'); }
        this.root.position.y = this.groundY;
        this.v.set(this.v.x * 0.25, Math.abs(this.v.y) * 0.22, this.v.z * 0.3);
        this.spin.x *= 0.15; this.spin.z *= 0.25;
      }
      // gone over a sheared catwalk: it does not stop, and then it is not there
      if (this.root.position.y < -26) this.root.visible = false;
      // settle face-up
      const target = -Math.PI / 2 * 0.94;
      this.root.rotation.x = THREE.MathUtils.damp(this.root.rotation.x, target, this.koT > 0.7 && this.groundY > -10 ? 5 : 0, dt);
      this.root.rotation.z = THREE.MathUtils.damp(this.root.rotation.z, 0, this.koT > 0.9 && this.groundY > -10 ? 3 : 0, dt);
      if (this.root.rotation.x < -1.2) this.v.multiplyScalar(0.98);
      // limbs go limp
      for (const s of ['L', 'R']) {
        const l = L[s];
        const sh = V(l.sx * 0.26, 0.5, 0), el = V(l.sx * 0.34, 0.28 - this.koT * 0.05, 0.05 + Math.sin(this.koT * 3 + l.sx) * 0.04),
          hd = V(l.sx * 0.36, 0.06, 0.16);
        place(l.upper, sh, el); place(l.fore, el, hd); l.hand.position.copy(hd);
        const hp = V(l.sx * 0.14, -0.02, 0), kn = V(l.sx * 0.16, -0.3, -0.24), an = V(l.sx * 0.18, -0.62, -0.2);
        place(l.thigh, hp, kn); place(l.shin, kn, an); l.foot.position.copy(an).add(V(0, -0.02, -0.08));
      }
      this.baton.position.copy(L.R.hand.position);
      this.baton.rotation.set(1.2, 0.4, 0.2);
      return;
    }

    // ---- face the player, walk, pose ----
    const pp = player.root.position;
    const dx = pp.x - this.root.position.x, dz = pp.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    // the model's front is its local -Z, so the yaw that points it at the
    // player is the same one the player's own aim code uses. A scout in a dash
    // and a man running away face where they are going, not where you are.
    let faceYaw = Math.atan2(-dx, -dz);
    if (this.mode === 'dash') faceYaw = Math.atan2(-this.dashDir.x, -this.dashDir.z);
    else if (this.mode === 'flee') {
      const tx = this.targetPos.x - this.root.position.x, tz = this.targetPos.z - this.root.position.z;
      if (Math.hypot(tx, tz) > 0.2) faceYaw = Math.atan2(-tx, -tz);
    }

    if (this.mode !== 'offscreen') {
      const turn = this.mode === 'dash' || this.mode === 'coil' ? 15 : 6;
      this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, faceYaw, turn, dt);
    }

    let torsoPitch = 0, headPitch = 0, armTarget = {}, walkSwing = 0;
    const idleSway = Math.sin(this.t * 1.7) * 0.03;

    switch (this.mode) {
      case 'offscreen':
        this.root.visible = false;
        return;
      default:
        this.root.visible = true;
    }

    // locomotion
    if (this.scout) {
      walkSwing = this.scoutMove(dt, player);
    } else if (WALK_SPEED[this.mode] != null) {
      const speed = WALK_SPEED[this.mode];
      const tp = this.targetPos;
      const ddx = tp.x - this.root.position.x, ddz = tp.z - this.root.position.z;
      const dd = Math.hypot(ddx, ddz);
      if (dd > 0.06) {
        const step = Math.min(speed * dt, dd);
        this.root.position.x += (ddx / dd) * step;
        this.root.position.z += (ddz / dd) * step;
        if (this.mode === 'wall') {
          // one march clock for both of them, so the wall steps as one thing
          this.walk = (ctx.march ?? 0) + (this.marchOffset ?? 0);
        } else {
          this.walk += dt * (speed * 2.6);
        }
        walkSwing = Math.sin(this.walk) * (this.mode === 'wall' ? 0.4 : 0.5);
        const stepPhase = Math.sin(this.walk) < 0;
        if (stepPhase !== this._stepPhase) { this._stepPhase = stepPhase; this.event('footstep'); }
      } else if (this.mode === 'enter') {
        this.setMode('stalk');
      } else if (this.mode === 'rush') {
        this.setMode('wind');
      } else if (this.mode === 'flee') {
        this.setMode('hatch');
      }
    }

    const batonArm = this.hasBaton ? 1 : 0;

    switch (this.mode) {
      case 'stalk':
        torsoPitch = 0.06;
        break;

      case 'lean': {                 // crouched to your face, taunting
        // high enough that his jaw sits at your eye line, not below it
        torsoPitch = 0.5;
        headPitch = -0.26;
        armTarget.L = V(-0.3, 0.16, -0.3);
        armTarget.R = V(0.3, 0.16, -0.3);
        break;
      }

      case 'grab': {                 // reaching for your jaw
        const k = Math.min(1, this.t / 0.4);
        torsoPitch = 0.55;
        headPitch = -0.3;
        const jaw = player.headWorld(new THREE.Vector3());
        const local = this.root.worldToLocal(jaw.clone());
        armTarget.L = V(-0.32, 0.1, -0.34);
        armTarget.R = V(local.x * k, 0.16 + (local.y - 0.16) * k, local.z * k);
        this.grabReach = k;
        break;
      }

      case 'shock':                  // second guard, lighter drops
        torsoPitch = -0.06;
        headPitch = 0.2;
        armTarget.R = V(0.4, 0.45 + Math.sin(this.t * 8) * 0.05, -0.1);
        if (this.t > 0.15 && this.lighter?.parent === this.torso) this.dropLighter();
        break;

      case 'wind':                   // telegraph: baton cocked up over one hip
        torsoPitch = 0.12 + this.t * 0.14;
        armTarget.R = V(this.swingSide * 0.5, 0.6 + this.t * 0.2, 0.14);
        if (this.t > 0.62) this.setMode('swing');
        break;

      case 'swing': {                // brutal downward arc, diagonally across
        const k = THREE.MathUtils.clamp(this.t / 0.22, 0, 1);
        torsoPitch = 0.3 + k * 0.45;
        armTarget.R = V(
          THREE.MathUtils.lerp(this.swingSide * 0.5, -this.swingSide * 0.45, k),
          THREE.MathUtils.lerp(0.62, -0.05, k),
          THREE.MathUtils.lerp(0.16, -0.5, k)
        );
        if (k >= 0.6 && !this.swingResolved) { this.swingResolved = true; this.event('swingHit', { side: this.swingSide }); }
        if (k >= 1) this.setMode('recover');
        break;
      }

      case 'recover':
        torsoPitch = 0.5;
        armTarget.R = V(-this.swingSide * 0.42, -0.05, -0.42);
        if (this.t > 0.6) this.setMode(this.scout ? 'circle' : this.overextended ? 'overextend' : 'rush', 0);
        break;

      case 'overextend':             // lunged past you, completely open
        torsoPitch = 0.7 + Math.sin(this.t * 2.2) * 0.04;
        headPitch = 0.3;
        armTarget.R = V(0.3, -0.2, -0.42);
        if (this.t > 1.25) this.setMode(this.scout ? 'circle' : 'rush');
        break;

      case 'groan':
        torsoPitch = 0.45 + Math.sin(this.t * 3) * 0.03;
        armTarget.L = V(-0.3, 0.1, -0.2);
        break;

      case 'wall': {                  // shields locked, walking you off the edge
        torsoPitch = 0.22;
        headPitch = 0.04;
        armTarget.L = V(-0.28, 0.3, -0.44);
        armTarget.R = V(0.26, 0.14, -0.42);
        break;
      }

      case 'scalded': {               // steam on bare skin: the shield comes down
        torsoPitch = -0.22 + Math.sin(this.t * 9) * 0.07;
        headPitch = -0.42;
        armTarget.L = V(-0.22, 0.6 + Math.sin(this.t * 11) * 0.06, -0.14);
        armTarget.R = V(0.22, 0.56 + Math.cos(this.t * 9.5) * 0.06, -0.16);
        break;
      }

      // ---- the scouts: fast, committed, and only touchable when they miss ----

      case 'drop':                   // coming down the maintenance line
        torsoPitch = 0.5;
        headPitch = 0.24;
        armTarget.L = V(-0.34, 0.62, -0.02);
        armTarget.R = V(0.34, 0.6, -0.06);
        break;

      case 'circle': {               // closing at speed, knuckles already up
        torsoPitch = 0.2;
        headPitch = -0.1;
        const b = Math.sin(this.walk) * 0.05;
        armTarget.L = V(-0.3, 0.28 + b, -0.26);
        armTarget.R = V(0.3, 0.26 - b, -0.28);
        break;
      }

      case 'coil': {                 // exo-boots charging: this is your window
        const k = Math.min(1, this.t / 0.44);
        this.exo = k;
        torsoPitch = 0.44;
        headPitch = -0.24;
        armTarget.L = V(-0.36, 0.16 + k * 0.1, 0.1 - k * 0.16);
        armTarget.R = V(0.36, 0.14 + k * 0.1, 0.08 - k * 0.14);
        if (this.t > 0.44) this.beginDash(player);
        break;
      }

      case 'dash': {                 // all of it, in one straight line
        const k = THREE.MathUtils.clamp(this.t / 0.18, 0, 1);
        this.exo = 1;
        torsoPitch = 0.62;
        headPitch = -0.4;
        armTarget.L = V(-0.24, 0.34 + k * 0.1, -0.5 - k * 0.12);
        armTarget.R = V(0.24, 0.3 - k * 0.12, -0.54 - k * 0.1);
        break;
      }

      case 'stagger':                // overran you: 1.5 s where he is yours
        torsoPitch = 0.66 + Math.sin(this.t * 7) * 0.06;
        headPitch = 0.4;
        armTarget.L = V(-0.42, 0.4 + Math.sin(this.t * 13) * 0.22, -0.2);
        armTarget.R = V(0.42, 0.44 + Math.cos(this.t * 11) * 0.22, -0.16);
        if (this.t > 1.55) this.setMode('circle');
        break;

      case 'slip':                   // skidded out at the rail, hands on it
        torsoPitch = -0.26 + Math.sin(this.t * 6) * 0.03;
        headPitch = -0.34;
        armTarget.L = V(-0.4, 0.56 + Math.sin(this.t * 8) * 0.05, -0.3);
        armTarget.R = V(0.4, 0.54 + Math.cos(this.t * 7) * 0.05, -0.32);
        if (this.t > 2.5) this.setMode('circle');
        break;

      case 'flee':                   // the officer: no training left at all
        torsoPitch = 0.18;
        headPitch = -0.3 + Math.sin(this.t * 12) * 0.05;
        armTarget.L = V(-0.4, 0.5 + Math.sin(this.walk * 2) * 0.12, -0.1);
        armTarget.R = V(0.4, 0.48 - Math.sin(this.walk * 2) * 0.12, -0.12);
        break;

      case 'hatch': {                // down the hole, and gone
        this.root.position.y -= dt * 2.7;
        torsoPitch = 0.1;
        armTarget.L = V(-0.34, 0.66, -0.06);
        armTarget.R = V(0.34, 0.64, -0.08);
        if (this.t > 0.7) this.setMode('offscreen');
        break;
      }
    }

    if (this.shield) {
      const up = this.shieldUp ? 1 : 0;
      this.shield.rotation.x = THREE.MathUtils.damp(this.shield.rotation.x, up ? 0.1 : 1.2, 7, dt);
      this.shield.position.y = THREE.MathUtils.damp(this.shield.position.y, up ? 0.42 : -0.2, 7, dt);
    }
    // one material drives both boot cells, so they charge and pulse together
    if (this.exoCell) {
      this.exoCell.emissiveIntensity = 0.35 + this.exo * 2.6 + Math.sin(this.t * 26) * 0.12 * this.exo;
    }

    torsoPitch -= this.flinch * 0.5;
    headPitch -= this.flinch * 0.9;
    // torsoPitch is forward-positive; the model tips forward on negative X
    this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, -torsoPitch, 9, dt);
    this.headG.rotation.x = THREE.MathUtils.damp(this.headG.rotation.x, -headPitch, 9, dt);
    this.hips.position.y = (0.92 - torsoPitch * 0.16) * this.tall + Math.sin(this.t * 2) * 0.008;

    // legs
    const tuck = this.mode === 'drop' ? 1 : 0;
    for (const s of ['L', 'R']) {
      const l = L[s], dir = l.sx === -1 ? 1 : -1;
      const sw = walkSwing * dir;
      const hip = V(l.sx * 0.15, 0, 0);
      const knee = V(l.sx * 0.16, -0.44 * this.tall + tuck * 0.18, -0.06 + sw * 0.16 - tuck * 0.3);
      const ankle = V(l.sx * 0.17, -0.86 * this.tall + tuck * 0.42, 0.02 + sw * 0.3 - tuck * 0.24);
      place(l.thigh, hip, knee);
      place(l.shin, knee, ankle);
      l.foot.position.set(ankle.x, ankle.y - 0.04, ankle.z - 0.06);
    }

    // arms (shoulder -> hand, elbow solved heuristically)
    for (const s of ['L', 'R']) {
      const l = L[s];
      const shoulder = V(l.sx * 0.27, 0.5, 0);
      const hand = (armTarget[s] || V(l.sx * 0.33, 0.08 + idleSway, -0.02)).clone();
      const elbow = V.lerpVectors(shoulder, hand, 0.5).add(V(l.sx * 0.05, -0.04, 0.06 + batonArm * 0.02));
      place(l.upper, shoulder, elbow);
      place(l.fore, elbow, hand);
      l.hand.position.copy(hand);
      l.hand.lookAt(elbow);
      this._handWorld = this._handWorld || {};
      l.hand.getWorldPosition(this._handWorld[s] || (this._handWorld[s] = new THREE.Vector3()));
    }

    if (this.baton.visible) {
      this.baton.position.copy(L.R.hand.position).add(V(0, 0.04, -0.16));
      this.baton.rotation.set(-1.15 - this.torso.rotation.x * 0.4, 0.25, 0.15);
    }
    if (this.lighter && this.lighter.parent === this.torso) {
      this.lighter.position.copy(L.R.hand.position).add(V(0, 0.1, 0));
      this.lighter.rotation.x = Math.sin(this.t * 3) * 0.6;
    }
  }

  dropLighter() {
    const w = this._handWorld?.R?.clone();
    if (!w) return;
    this.scene.add(this.lighter);
    this.lighter.position.copy(w);
    this.lighter.userData.fall = { v: 1.2, t: 0 };
    this.event('lighter');
  }

  dropBaton() {
    if (!this.baton.visible) return;
    const w = this.baton.getWorldPosition(new THREE.Vector3());
    this.scene.add(this.baton);
    this.baton.position.copy(w);
    this.baton.rotation.set(Math.PI / 2, Math.random() * 3, 0.4);
    this.baton.position.y = 0.035;
    this.hasBaton = false;
    this.batonDropped = true;
    this.event('baton');
    return this.baton;
  }
}
