import * as THREE from 'three';
import { rustTex, siloWallTex, gratingTex } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- the cargo lift silo ----------
export const SILO_R = 40;          // silo radius
export const SILO_H = 120;         // silo height
export const LIFT_R = 8;           // lift platform radius
export const LIFT_SPEED = 12;      // lift descent speed

const polar = (p) => ({ r: Math.hypot(p.x, p.z), th: Math.atan2(p.x, -p.z) });
const at = (r, th, out = V()) => out.set(Math.sin(th) * r, 0, -Math.cos(th) * r);

export function buildLift(scene) {
  const rust = rustTex(), shell = siloWallTex(), grate = gratingTex();
  shell.repeat.set(64, 18);
  grate.repeat.set(12, 12);

  const matMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.6 });
  const matGrate = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.4, map: grate });
  const matShell = new THREE.MeshStandardMaterial({ color: 0x1a1815, roughness: 0.9, metalness: 0.3, map: shell });
  const matRust = new THREE.MeshStandardMaterial({ color: 0x3d2a1f, roughness: 1, metalness: 0.1, map: rust });
  const matNeon = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2 });

  const group = new THREE.Group();
  scene.add(group);

  // ---- the silo walls ----
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(SILO_R, SILO_R, SILO_H, 64, 1, true), matShell);
  wall.position.y = -SILO_H / 2;
  wall.receiveShadow = true;
  group.add(wall);

  // ---- neon strips on the walls ----
  for (let i = 0; i < 12; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, SILO_H * 0.8, 0.15), matNeon);
    const th = (i / 12) * Math.PI * 2;
    strip.position.set(Math.sin(th) * (SILO_R - 0.2), -SILO_H * 0.4, -Math.cos(th) * (SILO_R - 0.2));
    strip.rotation.y = th;
    group.add(strip);
  }

  // ---- the moving lift platform ----
  const lift = new THREE.Group();
  group.add(lift);

  const ldeck = new THREE.Mesh(new THREE.CylinderGeometry(LIFT_R, LIFT_R - 0.3, 0.3, 32, 1), matGrate);
  ldeck.receiveShadow = true;
  lift.add(ldeck);

  // lift railings
  for (let i = 0; i < 8; i++) {
    const th = (i / 8) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), matMetal);
    post.position.set(Math.sin(th) * (LIFT_R - 0.2), 0.6, -Math.cos(th) * (LIFT_R - 0.2));
    lift.add(post);
  }

  // railing around the edge
  const rail = new THREE.Mesh(new THREE.TorusGeometry(LIFT_R - 0.15, 0.04, 8, 32), matMetal);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 1.1;
  lift.add(rail);

  // ---- cargo boxes (falling hazards) ----
  const boxes = [];
  for (let i = 0; i < 8; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), matRust);
    box.position.set(
      (Math.random() - 0.5) * (SILO_R - 4),
      20 + Math.random() * 40,
      (Math.random() - 0.5) * (SILO_R - 4)
    );
    box.userData = { vy: -8 - Math.random() * 4, rotSpeed: (Math.random() - 0.5) * 2 };
    box.visible = false;
    group.add(box);
    boxes.push(box);
  }

  // ---- wind particles ----
  const windGeom = new THREE.BufferGeometry();
  const windCount = 200;
  const windPos = new Float32Array(windCount * 3);
  for (let i = 0; i < windCount; i++) {
    windPos[i * 3] = (Math.random() - 0.5) * SILO_R * 1.5;
    windPos[i * 3 + 1] = -Math.random() * SILO_H;
    windPos[i * 3 + 2] = (Math.random() - 0.5) * SILO_R * 1.5;
  }
  windGeom.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
  const windMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.3 });
  const wind = new THREE.Points(windGeom, windMat);
  group.add(wind);

  // ---- fog ----
  const fog = new THREE.FogExp2(0x0a0806, 0.015);

  const api = {
    group,
    lift,
    boxes,
    wind,
    fog,
    liftY: 0,
    liftTargetY: -SILO_H + 10,
    alarm: 0,
    windSpeed: 0,

    setVisible(v) { group.visible = v; },

    /** keeps player on the lift platform */
    clamp(pos) {
      const { r, th } = polar(pos);
      if (r < LIFT_R - 0.5) {
        at(THREE.MathUtils.clamp(r, 0, LIFT_R - 0.5), th, pos);
      }
      return pos;
    },

    onDeck(pos) {
      const { r } = polar(pos);
      return r < LIFT_R + 0.5;
    },

    /** position the lift platform at a given height */
    setLiftHeight(y) {
      this.liftY = y;
      this.lift.position.y = y;
    },

    /** spawn a falling cargo box */
    spawnBox() {
      const box = this.boxes.find(b => !b.visible);
      if (!box) return;
      box.position.set(
        (Math.random() - 0.5) * (LIFT_R - 2),
        this.liftY + 15,
        (Math.random() - 0.5) * (LIFT_R - 2)
      );
      box.userData.vy = -12 - Math.random() * 6;
      box.rotation.set(0, 0, 0);
      box.visible = true;
    },

    update(dt, t) {
      // move lift down
      if (this.liftY > this.liftTargetY) {
        this.liftY -= LIFT_SPEED * dt;
        this.lift.position.y = this.liftY;
      }

      // update falling boxes
      for (const box of this.boxes) {
        if (!box.visible) continue;
        box.position.y += box.userData.vy * dt;
        box.rotation.x += box.userData.rotSpeed * dt;
        box.rotation.z += box.userData.rotSpeed * dt * 0.7;

        // remove if below lift
        if (box.position.y < this.liftY - 10) {
          box.visible = false;
        }
      }

      // update wind particles
      const positions = wind.geometry.attributes.position.array;
      for (let i = 0; i < windCount; i++) {
        positions[i * 3 + 1] += (15 + this.windSpeed * 20) * dt;
        if (positions[i * 3 + 1] > this.liftY + 20) {
          positions[i * 3 + 1] = this.liftY - 20;
        }
      }
      wind.geometry.attributes.position.needsUpdate = true;

      // camera follows lift
      scene.fog = this.fog;
    },

    burst(pos, count, color, size, speed, life, spread) {
      // Simple particle burst
      const geom = new THREE.BufferGeometry();
      const pCount = count;
      const pPos = new Float32Array(pCount * 3);
      const pVel = [];
      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = pos.x;
        pPos[i * 3 + 1] = pos.y;
        pPos[i * 3 + 2] = pos.z;
        pVel.push({
          x: (Math.random() - 0.5) * speed,
          y: (Math.random() - 0.5) * speed,
          z: (Math.random() - 0.5) * speed
        });
      }
      geom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const mat = new THREE.PointsMaterial({ color: new THREE.Color(...color), size, transparent: true });
      const points = new THREE.Points(geom, mat);
      group.add(points);

      // Simple animation - remove after life
      setTimeout(() => group.remove(points), life * 1000);
    }
  };

  return api;
}
