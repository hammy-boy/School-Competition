import * as THREE from 'three';
import { rustTex, siloWallTex, gratingTex, puffTex, concreteTex } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- the hall, in the ring's own polar terms ----------
// th = 0 is due -Z and angles run clockwise, exactly as in silo.js, because the
// shaft you fall down is the same axis and the chute leaves it at one angle.
export const HALL_R = 13;          // the shell
export const FLOOR_R = 11.2;       // as far out as the deck is solid under you
export const POD_RING = 8.4;       // the radius the containment pods stand on
export const POD_R = 1.3;          // one pod, and the kerb you walk around
export const PODS = 6;
export const CHUTE_TH = 0.0;       // the exhaust chute is the only way in
export const GATE_TH = 2.45;       // GATE 7 · CARGO GANTRY — next chapter's door
export const OBS_TH = Math.PI;     // the observation bay: across the hall, above the tear

const polar = (p) => ({ r: Math.hypot(p.x, p.z), th: Math.atan2(p.x, -p.z) });
const at = (r, th, out = V()) => out.set(Math.sin(th) * r, 0, -Math.cos(th) * r);
const podTh = (i) => (i / PODS) * Math.PI * 2;

export function buildCore(scene) {
  const rust = rustTex(), shell = siloWallTex(), grate = gratingTex(), concrete = concreteTex();
  shell.repeat.set(24, 6);
  grate.repeat.set(11, 11);
  concrete.repeat.set(6, 6);

  const matPlate = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.92, metalness: 0.22, color: 0x7d7568 });
  const matGrate = new THREE.MeshStandardMaterial({ map: grate, roughness: 0.85, metalness: 0.35, color: 0x93887a, side: THREE.DoubleSide });
  const matShell = new THREE.MeshStandardMaterial({ map: shell, roughness: 0.95, metalness: 0.15, color: 0x7f7466, side: THREE.BackSide });
  const matMetal = new THREE.MeshStandardMaterial({ map: rust, roughness: 0.6, metalness: 0.5, color: 0x9c8f7c });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9, metalness: 0.35 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.32, metalness: 0.92 });
  const matDuct = new THREE.MeshStandardMaterial({ map: rust, roughness: 0.66, metalness: 0.45, color: 0x8f8371, side: THREE.DoubleSide });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x9fd8e6, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.26, side: THREE.DoubleSide,
  });
  const matAmber = new THREE.MeshBasicMaterial({ color: 0xffa52c, transparent: true, opacity: 0.85, fog: false });

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- the shell: a machine hall with the intake bolted to its ceiling ----
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(HALL_R, HALL_R, 34, 48, 1, true), matShell);
  wall.name = 'wall';
  wall.position.y = 11;
  group.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(HALL_R, 48), matPlate);
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  // the deck you can actually stand on is a plate of bar steel: the rest of the
  // floor is poured concrete, and the difference has to read under your boots
  const plate = new THREE.Mesh(new THREE.RingGeometry(2.2, FLOOR_R + 0.5, 48), matGrate);
  plate.name = 'deck';
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = 0.012;
  group.add(plate);
  // The ceiling is where a room like this is won or lost: at eighty degrees the
  // top third of the frame is overhead engineering, so the shell has a real
  // height, girders across it, and the intake hanging down through its own hole.
  const CEIL_Y = 11.6;
  const ceil = new THREE.Mesh(new THREE.RingGeometry(3.45, HALL_R, 48), matPlate);
  ceil.name = 'ceiling';
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL_Y;
  group.add(ceil);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.24, 6, 30), matSteel);
  rim.name = 'intake-rim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = CEIL_Y;
  group.add(rim);
  // two rings of beam and eight radial ones, so the plate is carried by something
  for (const [gr, gy] of [[HALL_R - 1.1, CEIL_Y - 0.42], [HALL_R - 4.6, CEIL_Y - 0.9]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(gr, 0.17, 5, 40), matMetal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = gy;
    group.add(ring);
  }
  for (let i = 0; i < 10; i++) {
    const th = (i / 10) * Math.PI * 2 + 0.2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 1), matMetal);
    beam.scale.z = HALL_R - 4.2;
    at((3.9 + HALL_R - 1.6) / 2, th, beam.position);
    beam.position.y = CEIL_Y - 0.62;
    beam.rotation.y = -th;
    group.add(beam);
  }

  // the intake above: the mouth the shaft comes down through, still turning
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.9, 5.8, 24, 1, true), matDuct);
  housing.name = 'housing';
  housing.position.y = CEIL_Y + 2.7;
  group.add(housing);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(3.5, 24), matDark);
  throat.name = 'throat';
  throat.rotation.x = Math.PI / 2;
  throat.position.y = CEIL_Y + 5.5;
  group.add(throat);
  const fanAbove = new THREE.Group();
  fanAbove.name = 'intake-fan';
  fanAbove.position.y = CEIL_Y + 4.3;
  group.add(fanAbove);
  for (let b = 0; b < 9; b++) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.09, 0.62), matSteel);
    bl.rotation.y = (b / 9) * Math.PI * 2;
    bl.rotation.z = 0.34;
    fanAbove.add(bl);
  }

  // ---- pipes, trays, and the clutter that makes a room a room ----
  const tray = new THREE.BoxGeometry(0.5, 0.22, 1);
  for (let i = 0; i < 26; i++) {
    const th = (i / 26) * Math.PI * 2;
    const p = new THREE.Mesh(tray, matMetal);
    at(HALL_R - 0.7, th, p.position);
    p.position.y = 9.0 + (i % 3) * 0.75;
    p.rotation.y = -th;
    p.scale.z = 6 + (i % 4) * 2.5;
    group.add(p);
  }
  const downpipe = new THREE.CylinderGeometry(0.16, 0.16, 1, 7);
  for (let i = 0; i < 14; i++) {
    const th = 0.22 + (i / 14) * Math.PI * 2;
    // the bay is set into the shell: nothing runs through the wall it hangs on
    if (Math.abs(th - OBS_TH) < 0.34) continue;
    const p = new THREE.Mesh(downpipe, matMetal);
    at(HALL_R - 0.55, th, p.position);
    p.scale.y = 3.2 + Math.random() * 5;
    p.position.y = CEIL_Y - 0.5 - p.scale.y / 2;
    group.add(p);
  }
  // a broken one, leaking: the hall is not maintained, it is abandoned around
  // the thing they kept running
  const leak = new THREE.Group();
  at(HALL_R - 1.2, 4.1, leak.position);
  leak.position.y = 5.2;
  group.add(leak);
  leak.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 4.4, 8), matMetal).rotateZ(0.5));

  // ---- the exhaust chute: the only door in this room ----
  const chute = new THREE.Group();
  at(HALL_R - 1.4, CHUTE_TH, chute.position);
  chute.position.y = 6.2;
  chute.rotation.y = -CHUTE_TH;
  group.add(chute);
  const duct = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.15, 4.6, 10, 1, true), matMetal);
  duct.name = 'chute-duct';
  duct.rotation.x = Math.PI / 2;
  duct.position.z = -2.2;         // local -Z points at the middle of the hall
  chute.add(duct);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.13, 6, 14), matSteel);
  lip.name = 'chute-lip';
  lip.position.z = 0.06;
  chute.add(lip);
  // the flap it came through, still swinging on one bent hinge
  const flap = new THREE.Group();
  flap.name = 'chute-flap';
  flap.position.set(0, 1.2, 0.05);      // hinged along the top of the mouth
  chute.add(flap);
  const flapPanel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.2, 0.1), matDark);
  flapPanel.position.y = -0.6;
  flap.add(flapPanel);
  const chuteLamp = new THREE.PointLight(0xffb04a, 12, 12, 2);
  chuteLamp.position.set(0, -0.4, -1.6);
  chute.add(chuteLamp);

  // ---- the containment ring: six pods, and the rails they hang on ----
  const pods = [];
  for (let i = 0; i < PODS; i++) {
    const th = podTh(i);
    const g = new THREE.Group();
    at(POD_RING, th, g.position);
    g.rotation.y = -th + Math.PI;   // the front of the pod faces the middle
    group.add(g);

    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.34, 12), matMetal).translateY(0.17));
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.28, 3.1, 14, 1, true), matGlass);
    shell.position.y = 1.9;
    g.add(shell);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.3, 12), matMetal).translateY(3.6));
    for (let b = 0; b < 4; b++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), matSteel);
      const a = (b / 4) * Math.PI * 2 + 0.4;
      bar.position.set(Math.sin(a) * 1.24, 1.9, -Math.cos(a) * 1.24);
      g.add(bar);
    }
    // the hatch: a curved slab that blows outward on its top hinge
    const hatch = new THREE.Group();
    hatch.position.set(0, 3.4, -1.1);
    g.add(hatch);
    hatch.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.1, 10, 1, true, -0.62, 1.24), matMetal)
      .translateY(-1.55));
    const inside = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.4), matDark);
    inside.position.y = 1.4;
    g.add(inside);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.07, 5, 20), matSteel).translateY(0.5));

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), matAmber.clone());
    lamp.position.set(0, 3.85, -0.5);
    g.add(lamp);
    const light = new THREE.PointLight(0xffa52c, 3, 7, 2);
    light.position.set(0, 3.6, -0.9);
    g.add(light);

    pods.push({ g, hatch, lamp, light, th, want: 0, open: 0, burst: 0 });
  }

  // ---- the anomaly: the reason this hall is still running ----
  const riftG = new THREE.Group();
  group.add(riftG);
  const riftMat = new THREE.MeshBasicMaterial({
    color: 0xd8f4ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const blades = [];
  for (let b = 0; b < 4; b++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 5.4), riftMat);
    m.rotation.y = (b / 4) * Math.PI;
    m.position.y = 3.1;
    riftG.add(m);
    blades.push(m);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: puffTex(), color: 0x9fe6ff, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  halo.position.y = 3.1;
  halo.scale.setScalar(7);
  group.add(halo);
  // the containment gimbal: three rings of hardware trying to hold it still
  const gimbals = [];
  for (let r = 0; r < 3; r++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.9 + r * 0.55, 0.08, 6, 30), matSteel);
    m.position.y = 3.1;
    m.rotation.x = 0.4 + r * 0.9;
    m.rotation.z = r * 0.7;
    group.add(m);
    gimbals.push(m);
  }
  const emitter = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.9, 0.4, 20), matMetal);
  emitter.position.y = 0.2;
  group.add(emitter);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), matSteel)
      .translateX(Math.sin(a) * 2.6).translateY(0.35).translateZ(-Math.cos(a) * 2.6));
  }
  const riftLight = new THREE.PointLight(0xa8e6ff, 0, 40, 1.6);
  riftLight.position.y = 3.1;
  group.add(riftLight);
  const riftFloor = new THREE.Mesh(new THREE.RingGeometry(0.4, 3.1, 32), new THREE.MeshBasicMaterial({
    color: 0x7fd6ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  riftFloor.rotation.x = -Math.PI / 2;
  riftFloor.position.y = 0.03;
  group.add(riftFloor);

  // the lash: a cylinder the director points at you when the rift reaches out
  const lashMat = new THREE.MeshBasicMaterial({
    color: 0xcdf0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  const lash = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.1, 1, 8, 1, true), lashMat);
  lash.visible = false;
  group.add(lash);

  // ---- GATE 7: the way out, and the way into Chapter Two ----
  const gate = new THREE.Group();
  at(HALL_R - 0.55, GATE_TH, gate.position);
  gate.rotation.y = -GATE_TH;        // local +Z faces the middle of the hall
  gate.position.y = 0;
  group.add(gate);
  // two jambs and a lintel, so the gate is an opening rather than a wall
  for (const sx of [-1.95, 1.95]) {
    gate.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.4, 0.62), matMetal).translateX(sx).translateY(2.7));
  }
  gate.add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.8, 0.62), matMetal).translateY(5.0));
  gate.add(new THREE.Mesh(new THREE.BoxGeometry(3.34, 4.7, 0.2), matDark).translateY(2.35).translateZ(-0.22));
  // the slab, on a rail: it draws sideways into a pocket in the shell
  const gateSlab = new THREE.Mesh(new THREE.BoxGeometry(3.3, 4.5, 0.24), matMetal);
  gateSlab.position.set(0, 2.3, 0.12);
  gate.add(gateSlab);
  for (const gy of [-1.4, 0, 1.4]) {
    gateSlab.add(new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.12, 0.07), matSteel).translateY(gy).translateZ(0.13));
  }
  // and what is on the other side of it once the slab is gone: cold air, and a
  // gantry light nobody has switched off
  const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 4.5), new THREE.MeshBasicMaterial({
    color: 0x9fc0d4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  }));
  gateGlow.position.set(0, 2.35, -0.08);
  gate.add(gateGlow);
  const gateLamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.12), matAmber.clone());
  gateLamp.position.set(0, 5.5, 0.34);
  gate.add(gateLamp);
  const gateLight = new THREE.PointLight(0xff8a3c, 0, 14, 2);
  gateLight.position.set(0, 2.6, -0.5);
  gate.add(gateLight);

  // ---- THE OBSERVATION BAY: someone is watching this room on the other side of
  // a slab of laminated glass, dead across the hall from the chute and high above
  // the tear. He is never shown: a black shape with a tie on it, and when he hits
  // the desk the window rings. Local +Z faces the middle of the hall, so the bay
  // is built outward from the shell — everything in it has to stay inside r=13.
  const obs = new THREE.Group();
  obs.name = 'observation-bay';
  at(HALL_R - 0.35, OBS_TH, obs.position);
  obs.position.y = 7.4;
  obs.rotation.y = -OBS_TH;
  group.add(obs);
  // the back and the perimeter: a 1.9 m deep box cantilevered off the shell
  obs.add(new THREE.Mesh(new THREE.BoxGeometry(4.9, 2.9, 0.3), matDark).translateY(0).translateZ(0.15));
  for (const [w, h, px, py] of [[4.9, 0.42, 0, 1.3], [4.9, 0.42, 0, -1.3], [0.42, 2.6, -2.24, 0], [0.42, 2.6, 2.24, 0]]) {
    obs.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.9), matMetal).translateX(px).translateY(py).translateZ(0.98));
  }
  const obsPanel = new THREE.Mesh(new THREE.PlaneGeometry(4.05, 2.1), new THREE.MeshBasicMaterial({
    color: 0xa9cfe0, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false,
  }));
  obsPanel.name = 'obs-backlight';
  obsPanel.position.z = 0.42;
  obs.add(obsPanel);
  const obsFig = new THREE.Group();
  obsFig.name = 'obs-figure';
  obsFig.position.set(0, 0, 0.85);
  obsFig.visible = false;
  obs.add(obsFig);
  const matSil = new THREE.MeshBasicMaterial({ color: 0x04050a, fog: false });
  obsFig.add(new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.06, 0.34), matSil).translateY(0.06));
  obsFig.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.26, 0.36), matSil).translateY(0.7));
  obsFig.add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), matSil).translateY(1.0));
  // the tie: the only thing about him that says what he does for a living
  obsFig.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.06), matSil).translateY(0.28).translateZ(0.2));
  const obsArm = new THREE.Group();
  obsArm.name = 'obs-arm';
  obsArm.position.set(0.46, 0.62, 0.06);
  obsFig.add(obsArm);
  obsArm.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), matSil).translateY(-0.4));
  obsArm.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), matSil).translateY(-0.84));
  // the desk, and everything on it that he did not sweep off before he shouted
  obs.add(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.16, 0.9), matDark).translateY(-0.38).translateZ(1.3));
  obs.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), matDark).translateY(-0.14).translateZ(1.55));
  const obsGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.05, 2.1), matGlass.clone());
  obsGlass.name = 'obs-glass';
  obsGlass.position.z = 1.9;
  obs.add(obsGlass);
  const obsLight = new THREE.PointLight(0xbcd8e8, 0, 18, 2);
  obsLight.position.set(0, 0.3, 1.4);
  obs.add(obsLight);

  // ---- lamps: two sodium brackets and one cold strip over the pods ----
  group.add(new THREE.HemisphereLight(0x2a3038, 0x08070a, 0.45));
  const sodium = [];
  for (const th of [1.2, 3.9]) {
    const o = at(HALL_R - 1.6, th, V());
    o.y = 8.6;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), matMetal).translateX(o.x).translateY(o.y).translateZ(o.z));
    const l = new THREE.PointLight(0xffc27a, 26, 30, 1.7);
    l.position.copy(o);
    group.add(l);
    sodium.push(l);
  }
  const strip = new THREE.PointLight(0x7ea6c8, 14, 26, 1.8);
  at(POD_RING, podTh(2.5), strip.position);
  strip.position.y = 7.4;
  group.add(strip);
  const alarmWash = new THREE.PointLight(0xff2a18, 0, 44, 1.6);
  alarmWash.position.y = 9;
  group.add(alarmWash);

  // ---- particles: embers for the strikes, sprites for the pod gas ----
  const MAXS = 240;
  const sPos = new Float32Array(MAXS * 3), sCol = new Float32Array(MAXS * 3);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3).setUsage(THREE.DynamicDrawUsage));
  sPos.fill(-999);
  const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, depthWrite: false }));
  sparks.frustumCulled = false;
  group.add(sparks);
  const pool = [];
  for (let i = 0; i < MAXS; i++) pool.push({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 });
  let sCursor = 0;
  function burst(origin, count, color, spread = 0.9, speed = 3, up = 1, size = 0.05) {
    const [r, g, b] = color;
    for (let i = 0; i < count; i++) {
      const p = pool[sCursor];
      const j = sCursor * 3;
      sCursor = (sCursor + 1) % MAXS;
      p.life = 0.5 + Math.random() * 0.9;
      p.x = origin.x + (Math.random() - 0.5) * 0.06;
      p.y = origin.y + (Math.random() - 0.5) * 0.06;
      p.z = origin.z + (Math.random() - 0.5) * 0.06;
      const a = Math.random() * Math.PI * 2, e = Math.random() * spread;
      p.vx = Math.cos(a) * e * speed;
      p.vy = Math.random() * speed * up;
      p.vz = Math.sin(a) * e * speed;
      sCol[j] = r; sCol[j + 1] = g; sCol[j + 2] = b;
      sparks.material.size = size;
    }
  }

  const MAXP = 90;
  const puffs = [];
  for (let i = 0; i < MAXP; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTex(), transparent: true, opacity: 0, depthWrite: false,
    }));
    sp.visible = false;
    group.add(sp);
    puffs.push({ sp, life: 0, ttl: 1, v: V(), grow: 1, sink: 0, tint: 0 });
  }
  let pCursor = 0;
  function emitPuff(origin, dir, tint = 0, { ttl = 1.6, size = 0.7, grow = 2.2, sink = 0 } = {}) {
    const p = puffs[pCursor];
    pCursor = (pCursor + 1) % MAXP;
    p.life = ttl;
    p.ttl = ttl;
    p.grow = grow;
    p.sink = sink;
    p.tint = tint;
    p.sp.position.copy(origin);
    p.sp.scale.setScalar(size);
    p.sp.visible = true;
    p.v.copy(dir);
  }

  const fog = new THREE.FogExp2(0x0a0c0e, 0.018);

  const api = {
    group, pods, riftG, chute, gate,
    rift: 0,          // 0..1: how far the tear is open
    riftWant: 0,
    surge: 0,         // a spike: a lash, a pod blowing, a trooper hitting the deck
    alarm: 0,
    lashOn: 0,
    riftColor: [0.66, 0.9, 1],
    gateWant: 0,      // 1 once the hall decides to let you leave
    gateOpen: 0,
    obsWant: 0,       // the bay light: off until the man upstairs notices the readout
    obsLvl: 0,
    obsSlam: 0,       // 1 for the length of one fist hitting one desk
    obsT: 0,
    obsFlash: 0,
    obsWant: 0,       // the bay light: 0 until someone inside it decides to turn it on
    obsLvl: 0,
    obsSlam: 0,       // 1 for the length of one fist going through a desk
    obsT: 0,
    obsFlash: 0,

    /** where the chute puts you, and where the fall ends */
    chuteWorld(out = V()) { at(HALL_R - 4.3, CHUTE_TH, out); out.y = 5.6; return out; },
    floorWorld(out = V()) { return at(6.6, CHUTE_TH + 0.34, out); },
    podWorld(i, out = V()) { return at(POD_RING, podTh(i), out); },
    /** the deck in front of a pod: where its occupant lands on the way out */
    podFront(i, out = V()) { return at(POD_RING - 2.0, podTh(i), out); },
    riftWorld(out = V()) { return out.set(0, 3.1, 0); },
    gateWorld(out = V()) { return at(HALL_R - 2.2, GATE_TH, out); },
    hallAt(th, r = FLOOR_R - 1.2, out = V()) { return at(r, th, out); },

    setAlarm(v) { api.alarm = v; },
    /** GATE 7 unseals: the slab draws back and the gantry air comes in */
    openGate() { api.gateWant = 1; },
    openRift(v = 1) { api.riftWant = Math.max(api.riftWant, v); },
    surgeRift(v = 1) { api.surge = Math.max(api.surge, v); },
    /** after the pull the whole hall wears your ability's colour */
    setRiftColor([r, g, b]) {
      api.riftColor = [r, g, b];
      riftMat.color.setRGB(r, g, b);
      halo.material.color.setRGB(r, g, b);
      riftFloor.material.color.setRGB(r, g, b);
      riftLight.color.setRGB(r, g, b);
    },
    lashTo(pos) { api.lashOn = 1; api._lashTarget = pos.clone(); },
    burstPod(i) {
      const p = pods[i];
      if (!p || p.want) return;
      p.want = 1;
      p.burst = 1;
      api.surgeRift(0.5);
      const o = api.podFront(i, V());
      burst(o.setY(2.0), 30, [0.75, 0.9, 1], 1.4, 4.2, 1.1, 0.06);
      for (let k = 0; k < 5; k++) {
        emitPuff(V(o.x, 1.4 + k * 0.5, o.z), V((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8), 1,
          { ttl: 3.2, size: 0.9, grow: 2.6 });
      }
    },
    burstPods() { for (let i = 0; i < PODS; i++) api.burstPod(i); },
    /** a run that arrives here has already watched them go: open, vented, no replay */
    openPods() { for (const p of pods) { p.want = 1; p.open = 1; p.burst = 0; } },
    ember(pos, color, n = 14) { burst(pos, n, color, 1.2, 3.4, 1.1, 0.05); },
    burst(origin, count, color, spread = 0.9, speed = 3, up = 1, size = 0.05) {
      burst(origin, count, color, spread, speed, up, size);
    },

    /** the hall has one floor and it is solid: the pods are the only thing in it */
    clamp(pos) {
      const { r, th } = polar(pos);
      if (r > FLOOR_R) at(FLOOR_R, th, pos);
      // the emitter base is a column too, and standing inside the tear is not
      // a thing anyone should be able to do
      else if (r < 2.4) at(2.4, th, pos);
      for (const p of pods) {
        const dx = pos.x - p.g.position.x, dz = pos.z - p.g.position.z;
        const d = Math.hypot(dx, dz);
        if (d > POD_R - 1e-4) continue;
        // the pod body is a column: slide along its face rather than through it
        if (d < 1e-4) pos.x = p.g.position.x + (POD_R + 0.01);
        else pos.set(p.g.position.x + (dx / d) * POD_R, 0, p.g.position.z + (dz / d) * POD_R);
      }
      return pos;
    },

    onDeck(pos) { return Math.hypot(pos.x, pos.z) < FLOOR_R + 1.2; },

    setVisible(v) { group.visible = v; },

    update(dt, t) {
      api.surge = Math.max(0, api.surge - dt * 0.8);
      api.rift = THREE.MathUtils.damp(api.rift, api.riftWant, 1.8, dt);
      const k = api.rift * (1 + api.surge * 0.28);

      // the tear: four crossed planes, and the whole hall brightening with them
      for (const b of blades) {
        b.scale.set(0.2 + k * 1.05, 0.1 + k, 1);
        b.rotation.y += dt * (0.16 + k * 0.2);
      }
      riftMat.opacity = 0.12 + k * 0.75;
      halo.scale.setScalar(2.4 + k * 8 + Math.sin(t * 2.3) * k * 0.5);
      halo.material.opacity = 0.05 + k * 0.42;
      riftLight.intensity = k * (260 + Math.sin(t * 3.7) * 40 + api.surge * 320);
      riftFloor.material.opacity = 0.04 + k * 0.34;
      riftFloor.rotation.z += dt * 0.28;
      for (let i = 0; i < gimbals.length; i++) {
        gimbals[i].rotation.y += dt * (0.5 + i * 0.22) * (k > 0.02 ? 1 + k * 1.6 : 0.2);
        gimbals[i].rotation.z += dt * 0.18 * (i % 2 ? -1 : 1);
      }
      // the intake keeps turning whether or not anyone is down here
      fanAbove.rotation.y += dt * (1.5 + api.surge * 2);

      // the lash, pointed at whatever the director last aimed it at
      lash.visible = api.lashOn > 0.02;
      if (lash.visible && api._lashTarget) {
        const a = api.riftWorld(V()), b = api._lashTarget.clone().setY(1.35);
        const d = b.clone().sub(a);
        const len = d.length();
        lash.position.copy(a).addScaledVector(d, 0.5);
        lash.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
        lash.scale.set(1 + api.surge * 0.5, len, 1 + api.surge * 0.5);
        lashMat.opacity = 0.35 + 0.55 * api.lashOn;
        api.lashOn = Math.max(0, api.lashOn - dt * 1.5);
      }

      // containment pods: amber while sealed, then the hatch goes and stays gone
      for (const p of pods) {
        p.open = THREE.MathUtils.damp(p.open, p.want, 4.2, dt);
        p.hatch.rotation.x = -p.open * 1.25;
        p.hatch.position.z = -1.1 - p.open * 0.16;
        if (p.burst > 0) {
          p.burst = Math.max(0, p.burst - dt * 1.4);
          if (Math.random() < dt * 12) emitPuff(V(p.g.position.x, 2 + Math.random() * 1.4, p.g.position.z),
            V((Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6), 1,
            { ttl: 2.4, size: 0.7, grow: 2.2 });
        }
        const pulse = p.want ? 0.15 : 0.5 + 0.5 * Math.abs(Math.sin(t * 2.2 + p.th * 3));
        p.lamp.material.opacity = 0.2 + pulse * (p.want ? 0.3 : 0.8);
        p.lamp.material.color.setRGB(1, p.want ? 0.35 : 0.65, p.want ? 0.2 : 0.17);
        p.light.intensity = (p.want ? 2.5 : 7) * pulse;
        p.light.color.setRGB(1, p.want ? 0.4 : 0.65, p.want ? 0.25 : 0.17);
      }

      // the flap the came through, still ticking on its bent hinge
      flap.rotation.x = -0.5 - Math.sin(t * 1.3) * 0.14 - api.surge * 0.4;
      chuteLamp.intensity = 10 + Math.sin(t * 8.7) * 3;
      // GATE 7: sealed and amber, then the slab draws back and the lamp goes green
      api.gateOpen = THREE.MathUtils.damp(api.gateOpen, api.gateWant, 1.05, dt);
      const go = api.gateOpen;
      gateSlab.position.x = -go * 3.0;
      gateSlab.position.z = 0.12 - go * 0.1;
      gateGlow.material.opacity = Math.max(0, go - 0.25) * 0.62;
      gateLight.color.setRGB(1 - go * 0.55, 0.54 + go * 0.36, 0.23 + go * 0.5);
      gateLight.intensity = (2 + api.alarm * 12) * (0.55 + 0.45 * Math.sin(t * 1.9)) + go * 70;
      gateLamp.material.color.setRGB(1 - go * 0.86, 0.65 + go * 0.3, 0.17 + go * 0.35);
      gateLamp.material.opacity = 0.35 + 0.45 * Math.abs(Math.sin(t * (go > 0.4 ? 0.8 : 1.9)));
      for (const l of sodium) l.intensity = 24 + Math.sin(t * 5.2 + l.position.x) * 2.6;
      strip.intensity = 12 + api.rift * 16 + Math.sin(t * 0.9) * 1.4;
      alarmWash.intensity = api.alarm * 16 * (0.55 + 0.45 * Math.sin(t * 3.4));

      // the leak: a broken line nobody is coming to fix
      if (Math.random() < dt * 4) {
        emitPuff(V(leak.position.x * 0.9, 3.6, leak.position.z * 0.9), V(0, -0.5, 0), 1,
          { ttl: 1.8, size: 0.3, grow: 1.1, sink: 1.2 });
      }
      // dust falling off the intake, so the air has a direction
      if (Math.random() < dt * (2.2 + api.rift * 6)) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * FLOOR_R;
        emitPuff(V(Math.sin(a) * rr, 8 + Math.random() * 6, -Math.cos(a) * rr), V(0, -0.7, 0), 0,
          { ttl: 5, size: 0.5, grow: 0.6, sink: 0.25 });
      }

      for (const p of puffs) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.sp.position.addScaledVector(p.v, dt);
        p.v.y += dt * (0.2 - (p.sink || 0));
        p.v.multiplyScalar(1 - dt * 0.5);
        const f = p.life / p.ttl;
        p.sp.scale.addScalar(dt * p.grow);
        p.sp.material.opacity = Math.min(0.42, f * 0.5);
        p.sp.material.color.setRGB(
          p.tint ? 0.86 : 0.78, p.tint ? 0.94 : 0.78, p.tint ? 0.98 : 0.8);
        if (p.life <= 0) p.sp.visible = false;
      }

      const pa = sGeo.attributes.position;
      for (let i = 0; i < MAXS; i++) {
        const p = pool[i];
        const j = i * 3;
        if (p.life > 0) {
          p.life -= dt;
          p.vy -= 9.8 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          pa.array[j] = p.x; pa.array[j + 1] = p.y; pa.array[j + 2] = p.z;
          if (p.y < -20) p.life = 0;
        } else {
          pa.array[j + 1] = -999;
        }
      }
      pa.needsUpdate = true;
    },
  };

  api.fog = fog;
  return api;
}
