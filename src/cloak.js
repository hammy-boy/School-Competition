import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class CloakScout {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    const matMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.7 });
    const matCloak = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0.3,
      transparent: true,
      opacity: 0.7
    });
    const matLight = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.5 });

    // scout body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.4, 8), matMetal);
    body.position.y = 0.7;
    body.castShadow = true;
    this.root.add(body);

    // cloak mesh
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 8), matCloak);
    cloak.position.y = 0.9;
    cloak.rotation.x = Math.PI;
    this.root.add(cloak);
    this.cloakMesh = cloak;

    // glow when visible
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), matLight);
    glow.position.set(0, 1.3, 0.4);
    this.root.add(glow);
    this.glow = glow;

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
    this.scout = true;
    this.trooper = false;
    this.enforcer = false;
    this.officer = false;
    this.drone = false;
    this.cloaked = true;

    // scout-specific
    this.ambushRange = 5;
    this.revealDist = 3;
    this.stealthRegen = 2;
    this.ambushCooldown = 0;
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
    if (part === 'head') out.y += 1.2;
    else if (part === 'chest') out.y += 0.7;
    else if (part === 'knee') out.y += 0.2;
  }

  goTo(x, z) {
    this.v.x = (x - this.root.position.x) * 3;
    this.v.z = (z - this.root.position.z) * 3;
  }

  damage(amount) {
    if (this.ko) return { ko: true, death: false };
    this.stagger = Math.min(1, this.stagger + amount * 0.6);
    this.flinch = 0.4;
    this.vulnerable = true;
    this.cloaked = false;  // reveal on hit

    if (this.stagger >= 1) {
      this.ko = true;
      this.koT = 0;
      this.setMode('offscreen');
      return { ko: true, death: true };
    }
    return { ko: false, death: false };
  }

  blocksHit(part) {
    return false;
  }

  evadesHit() {
    // high dodge chance when cloaked
    return this.cloaked && Math.random() > 0.2;
  }

  update(dt, player, opts = {}) {
    if (this.ko) {
      this.koT += dt;
      if (this.koT > 2) {
        this.root.visible = false;
        this.mode = 'offscreen';
      }
      this.root.position.y -= 9.8 * dt;
      this.root.rotation.x += dt * 2;
      return;
    }

    if (this.mode === 'offscreen' || !this.root.visible) return;

    this.t += dt;
    this.stagger = Math.max(0, this.stagger - dt * 0.3);
    this.flinch = Math.max(0, this.flinch - dt * 2);
    this.ambushCooldown = Math.max(0, this.ambushCooldown - dt);

    const pPos = player.root.position;
    const dist = this.distanceTo(pPos);

    // cloak management
    if (this.cloaked) {
      this.cloakMesh.material.opacity = THREE.MathUtils.damp(this.cloakMesh.material.opacity, 0.2, 3, dt);
      this.glow.visible = false;
    } else {
      this.cloakMesh.material.opacity = THREE.MathUtils.damp(this.cloakMesh.material.opacity, 0.9, 3, dt);
      this.glow.visible = true;

      // regen cloak when not in combat
      if (dist > this.ambushRange && this.ambushCooldown <= 0) {
        this.cloaked = true;
      }
    }

    // AI behavior
    if (this.mode === 'stalk') {
      // follow player but stay at distance
      if (dist > this.ambushRange) {
        const dir = new THREE.Vector3().subVectors(pPos, this.root.position).normalize();
        this.root.position.addScaledVector(dir, 4 * dt);
        this.root.rotation.y = Math.atan2(dir.x, dir.z);
      }

      // ambush when close
      if (dist < this.ambushRange && this.ambushCooldown <= 0) {
        this.setMode('ambush');
      }
    } else if (this.mode === 'ambush') {
      // dash attack
      const dir = new THREE.Vector3().subVectors(pPos, this.root.position).normalize();
      this.root.position.addScaledVector(dir, 12 * dt);
      this.root.rotation.y = Math.atan2(dir.x, dir.z);
      this.cloaked = false;

      if (dist < 1.2) {
        player.takeDamage(0.4);
        this.setMode('retreat');
        this.ambushCooldown = 4;
      }

      if (this.t > 0.6) {
        this.setMode('stalk');
      }
    } else if (this.mode === 'retreat') {
      // move away
      const dir = new THREE.Vector3().subVectors(this.root.position, pPos).normalize();
      this.root.position.addScaledVector(dir, 6 * dt);
      this.root.rotation.y = Math.atan2(dir.x, dir.z);

      if (this.t > 1.2) {
        this.setMode('stalk');
      }
    }

    // apply stagger knockback
    if (this.stagger > 0) {
      this.root.position.addScaledVector(this.v, dt);
      this.v.multiplyScalar(0.9);
    }
  }
}
