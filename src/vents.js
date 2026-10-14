import * as THREE from 'three';
import { rustTex, siloWallTex, gratingTex } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- the maintenance vents ----------
export const VENT_W = 3;           // vent width
export const VENT_H = 2.5;         // vent height
export const VENT_LENGTH = 80;     // total vent path length
export const PIPE_R = 15;          // facility radius

const polar = (p) => ({ r: Math.hypot(p.x, p.z), th: Math.atan2(p.x, -p.z) });
const at = (r, th, out = V()) => out.set(Math.sin(th) * r, 0, -Math.cos(th) * r);

export function buildVents(scene) {
  const rust = rustTex(), shell = siloWallTex(), grate = gratingTex();
  shell.repeat.set(32, 8);
  grate.repeat.set(6, 6);

  const matMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.6 });
  const matGrate = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.4, map: grate });
  const matShell = new THREE.MeshStandardMaterial({ color: 0x1a1815, roughness: 0.9, metalness: 0.3, map: shell });
  const matRust = new THREE.MeshStandardMaterial({ color: 0x3d2a1f, roughness: 1, metalness: 0.1, map: rust });
  const matSteam = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

  const group = new THREE.Group();
  scene.add(group);

  // ---- the main vent tunnel (curved around the facility) ----
  const ventSegments = 20;
  const segmentLength = VENT_LENGTH / ventSegments;

  for (let i = 0; i < ventSegments; i++) {
    const th = (i / ventSegments) * Math.PI * 1.5;  // 270 degree arc
    const r = PIPE_R + 5;

    const segment = new THREE.Group();
    segment.position.set(Math.sin(th) * r, 0, -Math.cos(th) * r);
    segment.rotation.y = th;
    group.add(segment);

    // vent floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(VENT_W, 0.15, segmentLength), matGrate);
    floor.receiveShadow = true;
    segment.add(floor);

    // vent ceiling
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(VENT_W, 0.15, segmentLength), matMetal);
    ceil.position.y = VENT_H;
    segment.add(ceil);

    // vent walls
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.1, VENT_H, segmentLength), matMetal);
    wallL.position.x = -VENT_W / 2;
    wallL.position.y = VENT_H / 2;
    segment.add(wallL);

    const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.1, VENT_H, segmentLength), matMetal);
    wallR.position.x = VENT_W / 2;
    wallR.position.y = VENT_H / 2;
    segment.add(wallR);

    // support beams
    if (i % 3 === 0) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(VENT_W + 0.2, 0.15, 0.15), matMetal);
      beam.position.y = VENT_H / 2;
      beam.position.z = -segmentLength / 2;
      segment.add(beam);
    }
  }

  // ---- steam valves (hazards) ----
  const valves = [];
  for (let i = 0; i < 6; i++) {
    const th = 0.3 + (i / 6) * Math.PI * 1.2;
    const r = PIPE_R + 5;

    const valve = new THREE.Group();
    valve.position.set(Math.sin(th) * r, VENT_H / 2, -Math.cos(th) * r);
    valve.rotation.y = th;
    group.add(valve);

    const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8), matRust);
    valveBody.rotation.z = Math.PI / 2;
    valveBody.position.x = VENT_W / 2 + 0.2;
    valve.add(valveBody);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 8), matMetal);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.x = VENT_W / 2 + 0.6;
    valve.add(wheel);

    valve.userData = { active: false, timer: 0, interval: 3 + Math.random() * 4 };
    valves.push(valve);
  }

  // ---- exhaust pistons (crushing hazards) ----
  const pistons = [];
  for (let i = 0; i < 4; i++) {
    const th = 0.5 + (i / 4) * Math.PI * 1.1;
    const r = PIPE_R + 5;

    const piston = new THREE.Group();
    piston.position.set(Math.sin(th) * r, 0, -Math.cos(th) * r);
    piston.rotation.y = th;
    group.add(piston);

    const pistonBody = new THREE.Mesh(new THREE.BoxGeometry(VENT_W - 0.5, 0.4, 1.5), matMetal);
    pistonBody.position.y = VENT_H - 0.5;
    piston.add(pistonBody);

    const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8), matMetal);
    pistonRod.position.y = VENT_H + 0.5;
    piston.add(pistonRod);

    piston.userData = { ext: 0, target: 0, timer: 0, interval: 2 + Math.random() * 3 };
    pistons.push(piston);
  }

  // ---- steam particle systems ----
  const steamSystems = [];
  for (const valve of valves) {
    const steamGeom = new THREE.BufferGeometry();
    const steamCount = 50;
    const steamPos = new Float32Array(steamCount * 3);
    steamGeom.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
    const steamMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.4 });
    const steam = new THREE.Points(steamGeom, steamMat);
    valve.add(steam);
    steamSystems.push({ steam, valve, particles: [] });
  }

  // ---- fog ----
  const fog = new THREE.FogExp2(0x0a0806, 0.02);

  const api = {
    group,
    valves,
    pistons,
    steamSystems,
    fog,
    alarm: 0,

    setVisible(v) { group.visible = v; },

    /** keeps player in the vent tunnel */
    clamp(pos) {
      const { r, th } = polar(pos);
      const ventR = PIPE_R + 5;
      const angleDist = Math.abs(th - (Math.PI * 0.75));  // center of arc

      if (angleDist > Math.PI * 0.75) {
        // constrain to arc
        const clampedTh = THREE.MathUtils.clamp(th, 0, Math.PI * 1.5);
        at(r, clampedTh, pos);
      }

      // constrain to vent width
      const distFromCenter = Math.abs(r - ventR);
      if (distFromCenter > VENT_W / 2 - 0.3) {
        const newR = ventR + (distFromCenter > 0 ? VENT_W / 2 - 0.3 : -(VENT_W / 2 - 0.3));
        at(newR, th, pos);
      }

      // height constraint
      pos.y = THREE.MathUtils.clamp(pos.y, 0, VENT_H - 0.5);

      return pos;
    },

    onDeck(pos) {
      const { r, th } = polar(pos);
      const ventR = PIPE_R + 5;
      const angleDist = Math.abs(th - (Math.PI * 0.75));
      const distFromCenter = Math.abs(r - ventR);
      return angleDist < Math.PI * 0.75 && distFromCenter < VENT_W / 2 + 0.5 && pos.y >= 0 && pos.y <= VENT_H;
    },

    /** trigger a steam valve */
    triggerValve(index) {
      if (index >= 0 && index < this.valves.length) {
        this.valves[index].userData.active = true;
        this.valves[index].userData.timer = 0;
      }
    },

    update(dt, t) {
      // update steam valves
      for (let i = 0; i < this.valves.length; i++) {
        const valve = this.valves[i];
        valve.userData.timer += dt;

        if (valve.userData.timer > valve.userData.interval) {
          valve.userData.timer = 0;
          valve.userData.active = !valve.userData.active;
        }

        // update steam particles
        const sys = this.steamSystems[i];
        if (valve.userData.active) {
          const positions = sys.steam.geometry.attributes.position.array;
          for (let j = 0; j < 50; j++) {
            if (sys.particles[j] === undefined || sys.particles[j].life <= 0) {
              sys.particles[j] = {
                x: (Math.random() - 0.5) * 0.5,
                y: VENT_H / 2,
                z: (Math.random() - 0.5) * 0.5,
                vx: (Math.random() - 0.5) * 2,
                vy: 2 + Math.random() * 2,
                vz: (Math.random() - 0.5) * 2,
                life: 1
              };
            }
            const p = sys.particles[j];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.life -= dt * 2;

            positions[j * 3] = p.x;
            positions[j * 3 + 1] = p.y;
            positions[j * 3 + 2] = p.z;
          }
          sys.steam.geometry.attributes.position.needsUpdate = true;
          sys.steam.visible = true;
        } else {
          sys.steam.visible = false;
        }
      }

      // update pistons
      for (const piston of this.pistons) {
        piston.userData.timer += dt;

        if (piston.userData.timer > piston.userData.interval) {
          piston.userData.timer = 0;
          piston.userData.target = piston.userData.target === 0 ? 1 : 0;
        }

        piston.userData.ext = THREE.MathUtils.damp(piston.userData.ext, piston.userData.target, 3, dt);
        piston.children[0].position.y = VENT_H - 0.5 - piston.userData.ext * 0.8;
        piston.children[1].position.y = VENT_H + 0.5 - piston.userData.ext * 0.8;
      }

      scene.fog = this.fog;
    },

    burst(pos, count, color, size, speed, life, spread) {
      const geom = new THREE.BufferGeometry();
      const pCount = count;
      const pPos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = pos.x;
        pPos[i * 3 + 1] = pos.y;
        pPos[i * 3 + 2] = pos.z;
      }
      geom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const mat = new THREE.PointsMaterial({ color: new THREE.Color(...color), size, transparent: true });
      const points = new THREE.Points(geom, mat);
      group.add(points);
      setTimeout(() => group.remove(points), life * 1000);
    }
  };

  return api;
}
