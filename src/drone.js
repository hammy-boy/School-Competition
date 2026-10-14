import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Drone {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    const matMetal = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.7 });
    const matLight = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 1 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.5 });

    // drone body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.2), matMetal);
    body.castShadow = true;
    this.root.add(body);

    // rotors
    for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) {
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8), matDark);
      rotor.position.set(x, 0.3, z);
      rotor.rotation.x = Math.PI / 2;
      this.root.add(rotor);
    }

    // eye/light
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), matLight);
    eye.position.set(0, 0, 0.6);
    this.root.add(eye);

    // state
    this.ko = false;
    this.koT = 0;
    this.mode = 'offscreen';
    this.v = new THREE.Vector3();
    this.groundY = 0;
    this.t = 0;
    this.walk = 0;
    this.stagger = 0;
    this.overextended = false;
    this.vulnerable = false;
    this.holdOff = false;
    this.landed = false;
    this.flinch = 0;
    this.shield = null;
    this.shieldUp = false;
    this.scout = false;
    this.trooper = false;
    this.enforcer = false;
    this.officer = false;
    this.drone = true;

    // drone-specific
    this.hoverY = 3 + Math.random() * 2;
    this.hoverSpeed = 2 + Math.random();
    this.attackRange = 8;
    this.dashSpeed = 15;
    this.dashCooldown = 0;
    this.targetY = this.hoverY;
  }

  setVisible(v) { this.root.visible = v; }

  setMode(mode) {
    this.mode = mode;
    this.t = 0;
  }

  distanceTo(pos) {
    return this.root.position.distanceTo(pos);
  }

  point(part, out) {
    out.copy(this.root.position);
    if (part === 'head') out.y += 0.2;
    else if (part === 'chest') out.y += 0;
    else if (part === 'knee') out.y -= 0.3;
  }

  goTo(x, z) {
    this.v.x = (x - this.root.position.x) * 3;
    this.v.z = (z - this.root.position.z) * 3;
  }

  damage(amount) {
    if (this.ko) return { ko: true, death: false };
    this.stagger = Math.min(1, this.stagger + amount * 0.5);
    this.flinch = 0.3;
    this.vulnerable = true;

    if (this.stagger >= 1) {
      this.ko = true;
      this.koT = 0;
      this.setMode('offscreen');
      return { ko: true, death: true };
    }
    return { ko: false, death: false };
  }

  blocksHit(part) {
    return false;  // drones don't have shields
  }

  evadesHit() {
    return this.mode === 'dash' && Math.random() > 0.3;
  }

  update(dt, player, opts = {}) {
    if (this.ko) {
      this.koT += dt;
      if (this.koT > 2) {
        this.root.visible = false;
        this.mode = 'offscreen';
      }
      this.root.position.y -= 9.8 * dt;
      this.root.rotation.x += dt * 3;
      this.root.rotation.z += dt * 2;
      return;
    }

    if (this.mode === 'offscreen' || !this.root.visible) return;

    this.t += dt;
    this.stagger = Math.max(0, this.stagger - dt * 0.3);
    this.flinch = Math.max(0, this.flinch - dt * 2);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    const pPos = player.root.position;
    const dist = this.distanceTo(pPos);

    // hover movement
    this.targetY = this.hoverY + Math.sin(this.t * this.hoverSpeed) * 0.5;
    this.root.position.y = THREE.MathUtils.damp(this.root.position.y, this.targetY, 4, dt);

    // AI behavior
    if (this.mode === 'patrol') {
      // circle around the lift
      const angle = this.t * 0.5;
      const r = 12;
      this.root.position.x = Math.sin(angle) * r;
      this.root.position.z = Math.cos(angle) * r;
      this.root.rotation.y = -angle + Math.PI / 2;

      // attack if close
      if (dist < this.attackRange && this.dashCooldown <= 0) {
        this.setMode('dash');
        this.dashCooldown = 3;
      }
    } else if (this.mode === 'dash') {
      // dash toward player
      const dir = new THREE.Vector3().subVectors(pPos, this.root.position).normalize();
      this.root.position.addScaledVector(dir, this.dashSpeed * dt);
      this.root.rotation.y = Math.atan2(dir.x, dir.z);

      // check if hit player
      if (dist < 1.5) {
        player.takeDamage(0.5);
        this.setMode('retreat');
        this.dashCooldown = 2;
      }

      // end dash after distance
      if (this.t > 0.8) {
        this.setMode('patrol');
      }
    } else if (this.mode === 'retreat') {
      // move away from player
      const dir = new THREE.Vector3().subVectors(this.root.position, pPos).normalize();
      this.root.position.addScaledVector(dir, 8 * dt);
      this.root.rotation.y = Math.atan2(dir.x, dir.z);

      if (this.t > 1.5) {
        this.setMode('patrol');
      }
    }

    // apply stagger knockback
    if (this.stagger > 0) {
      this.root.position.addScaledVector(this.v, dt);
      this.v.multiplyScalar(0.9);
    }
  }
}
