/**
 * BLOODCORE // ULTRAQUAKE
 * Quake + ULTRAKILL Kinetic Movement & AABB Collision Solver
 * Implements: Always-Run, Bunny-Hopping / Air-Strafing, 3-Bar Stamina Dash + Dash-Jump,
 * Directional Ground Slide, Air Ground-Slam + Slam-Jump Boost, and 3-Charge Wall-Jumps.
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  var P = B.PHYSICS;

  B.PlayerController = function (camera, audio) {
    this.camera = camera;
    this.audio = audio;

    this.pos = new THREE.Vector3(0, 0.2, 3.0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;   // Looking towards -Z initially (yaw = 0 means forward is (0,0,-1))
    this.pitch = 0;

    this.hp = 100;
    this.maxHp = 100;
    this.hardDamage = 0; // ULTRAKILL hard damage cap (decays when stylish)
    this.stamina = P.STAMINA_MAX;

    this.grounded = false;
    this.wallJumpsLeft = P.MAX_WALL_JUMPS;
    this.touchingWallNormal = null;

    this.isSliding = false;
    this.slideDir = new THREE.Vector3(0, 0, -1);

    this.isSlamming = false;
    this.slamAirTime = 0;
    this.slamJumpWindow = 0;

    this.dashTimeLeft = 0;
    this.dashDir = new THREE.Vector3(0, 0, -1);
    this.iFrameTime = 0;
    this.hazardCooldown = 0;

    // Camera procedural animation state
    this.currentEyeY = P.EYE_HEIGHT;
    this.bobPhase = 0;
    this.cameraRoll = 0;
    this.screenShake = 0;
    this.recoilPitch = 0;
  };

  B.PlayerController.prototype.reset = function (x, y, z) {
    this.pos.set(x || 0, y || 0.2, z !== undefined ? z : 3.0);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.hp = 100;
    this.hardDamage = 0;
    this.stamina = P.STAMINA_MAX;
    this.grounded = false;
    this.wallJumpsLeft = P.MAX_WALL_JUMPS;
    this.isSliding = false;
    this.isSlamming = false;
    this.slamJumpWindow = 0;
    this.dashTimeLeft = 0;
    this.iFrameTime = 0;
    this.screenShake = 0;
    this.recoilPitch = 0;
  };

  B.PlayerController.prototype.getForwardVector = function (out) {
    out = out || new THREE.Vector3();
    var cp = Math.cos(this.pitch);
    out.set(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp
    ).normalize();
    return out;
  };

  B.PlayerController.prototype.getFlatForward = function (out) {
    out = out || new THREE.Vector3();
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    return out;
  };

  B.PlayerController.prototype.getFlatRight = function (out) {
    out = out || new THREE.Vector3();
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    return out;
  };

  B.PlayerController.prototype.triggerDash = function (input) {
    if (this.stamina < P.STAMINA_COST) return false;
    this.stamina -= P.STAMINA_COST;
    this.isSliding = false;
    this.isSlamming = false;

    var wish = this.computeWishDir(input);
    if (wish.lengthSq() < 0.01) {
      this.getFlatForward(wish);
    }
    this.dashDir.copy(wish).normalize();
    this.dashTimeLeft = P.DASH_DURATION;
    this.iFrameTime = P.DASH_IFRAMES;
    this.vel.set(this.dashDir.x * P.DASH_SPEED, 0, this.dashDir.z * P.DASH_SPEED);

    if (this.audio) this.audio.playDash();
    return true;
  };

  B.PlayerController.prototype.computeWishDir = function (input) {
    var fwd = this.getFlatForward();
    var right = this.getFlatRight();
    var moveZ = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    var moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var wish = new THREE.Vector3();
    wish.addScaledVector(fwd, moveZ);
    wish.addScaledVector(right, moveX);
    if (wish.lengthSq() > 0.001) wish.normalize();
    return wish;
  };

  B.PlayerController.prototype.update = function (dt, input, levelMgr, onSlamImpact, onPlayerDamage) {
    if (this.iFrameTime > 0) this.iFrameTime = Math.max(0, this.iFrameTime - dt);
    if (this.hazardCooldown > 0) this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    if (this.slamJumpWindow > 0) this.slamJumpWindow = Math.max(0, this.slamJumpWindow - dt);

    // Regenerate Stamina (paused while actively sliding)
    if (!this.isSliding && this.dashTimeLeft <= 0) {
      this.stamina = Math.min(P.STAMINA_MAX, this.stamina + P.STAMINA_REGEN_RATE * dt);
    }

    var wishDir = this.computeWishDir(input);

    // 1. Handle Crouch / Slide / Air-Slam input
    if (input.slidePressed) {
      input.slidePressed = false;
      if (!this.grounded && !this.isSlamming && this.dashTimeLeft <= 0) {
        // Trigger Air Ground-Slam!
        this.isSlamming = true;
        this.slamAirTime = 0;
        this.vel.set(0, P.SLAM_FALL_SPEED, 0);
      } else if (this.grounded && !this.isSliding) {
        this.isSliding = true;
        if (wishDir.lengthSq() > 0.01) {
          this.slideDir.copy(wishDir);
        } else {
          var horizSpd = Math.hypot(this.vel.x, this.vel.z);
          if (horizSpd > 2.0) {
            this.slideDir.set(this.vel.x / horizSpd, 0, this.vel.z / horizSpd);
          } else {
            this.getFlatForward(this.slideDir);
          }
        }
      }
    }
    if (!input.slideHeld && this.isSliding) {
      this.isSliding = false;
    }

    // 2. Handle Jump / Bunny-Hop / Slam-Jump / Dash-Jump / Wall-Jump
    if (input.jumpPressed) {
      if (this.grounded) {
        input.jumpPressed = false;
        this.grounded = false;
        var jumpVel = P.JUMP_VELOCITY;

        // Slam-Jump Boost!
        if (this.slamJumpWindow > 0) {
          jumpVel *= P.SLAM_JUMP_MULT;
          this.slamJumpWindow = 0;
          if (onSlamImpact) onSlamImpact(this.pos, true);
        }

        // Dash-Jump or Slide-Jump momentum preservation!
        if (this.dashTimeLeft > 0) {
          this.dashTimeLeft = 0;
          this.vel.x = this.dashDir.x * (P.BASE_RUN_SPEED * 1.48);
          this.vel.z = this.dashDir.z * (P.BASE_RUN_SPEED * 1.48);
        } else if (this.isSliding) {
          this.isSliding = false;
          this.vel.x = this.slideDir.x * (P.SLIDE_SPEED * 1.08);
          this.vel.z = this.slideDir.z * (P.SLIDE_SPEED * 1.08);
        } else if (wishDir.lengthSq() > 0.01) {
          // Bunny-hop speed boost (stack up to MAX_BHOP_SPEED)
          var curSpd = Math.hypot(this.vel.x, this.vel.z);
          var newSpd = Math.min(P.MAX_BHOP_SPEED, Math.max(P.BASE_RUN_SPEED, curSpd * 1.07));
          this.vel.x = wishDir.x * newSpd;
          this.vel.z = wishDir.z * newSpd;
        }

        this.vel.y = jumpVel;
      } else if (this.touchingWallNormal && this.wallJumpsLeft > 0) {
        // Wall-Jump!
        input.jumpPressed = false;
        this.isSlamming = false;
        var usedCount = (P.MAX_WALL_JUMPS - this.wallJumpsLeft) + 1;
        this.wallJumpsLeft--;
        this.vel.y = P.WALL_JUMP_UP;
        this.vel.x = this.touchingWallNormal.x * P.WALL_JUMP_PUSH + wishDir.x * 6.5;
        this.vel.z = this.touchingWallNormal.z * P.WALL_JUMP_PUSH + wishDir.z * 6.5;
        if (this.audio) this.audio.playWallJump(usedCount);
      }
    }

    // 3. Apply Horizontal Acceleration & Gravity
    if (this.dashTimeLeft > 0) {
      this.dashTimeLeft -= dt;
      this.vel.set(this.dashDir.x * P.DASH_SPEED, 0, this.dashDir.z * P.DASH_SPEED);
      if (this.dashTimeLeft <= 0) {
        // Post-dash velocity transitions smoothly to run speed
        this.vel.x = this.dashDir.x * P.BASE_RUN_SPEED;
        this.vel.z = this.dashDir.z * P.BASE_RUN_SPEED;
      }
    } else if (this.isSlamming) {
      this.slamAirTime += dt;
      this.vel.x = 0;
      this.vel.z = 0;
      this.vel.y = P.SLAM_FALL_SPEED;
    } else if (this.isSliding && this.grounded) {
      // High-speed directional ground slide with gentle steering
      if (wishDir.lengthSq() > 0.01) {
        this.slideDir.lerp(wishDir, dt * 2.2).normalize();
      }
      var curSlideSpd = Math.max(P.SLIDE_SPEED, Math.hypot(this.vel.x, this.vel.z));
      this.vel.x = this.slideDir.x * curSlideSpd;
      this.vel.z = this.slideDir.z * curSlideSpd;
      this.vel.y -= P.GRAVITY * dt;
      if (this.audio) this.audio.playSlideTick();
    } else if (this.grounded) {
      // Ground Friction + Always-Run Acceleration
      var speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.001) {
        var drop = speed * P.FRICTION * dt;
        var scaled = Math.max(0, speed - drop) / speed;
        this.vel.x *= scaled;
        this.vel.z *= scaled;
      }
      this.accelerate(wishDir, P.BASE_RUN_SPEED, P.GROUND_ACCEL, dt);
      this.vel.y -= P.GRAVITY * dt;
    } else {
      // Quake Air-Strafing Acceleration!
      this.accelerate(wishDir, P.AIR_WISH_SPEED, P.AIR_ACCEL, dt);
      this.vel.y -= P.GRAVITY * dt;
    }

    // 4. Integrate Position & Resolve World Collisions
    var wasGrounded = this.grounded;
    var wasSlamming = this.isSlamming;
    this.resolveCollisions(dt, levelMgr);

    // 5. Check Ground Slam Impact
    if (this.grounded && !wasGrounded) {
      this.wallJumpsLeft = P.MAX_WALL_JUMPS;
      if (wasSlamming) {
        this.isSlamming = false;
        this.slamJumpWindow = P.SLAM_JUMP_WINDOW;
        this.screenShake = Math.max(this.screenShake, 0.45);
        if (this.audio) this.audio.playSlam();
        if (onSlamImpact) onSlamImpact(this.pos, false);
      }
    }

    // 6. Check Jump Pads & Environmental Hazards
    this.checkTriggers(levelMgr, onPlayerDamage);

    // 7. Update First-Person Camera Transform, View Bob, Strafe Roll & Recoil
    this.updateCamera(dt, input);
  };

  B.PlayerController.prototype.accelerate = function (wishDir, wishSpeed, accel, dt) {
    if (wishDir.lengthSq() < 0.001) return;
    var currentSpeed = this.vel.x * wishDir.x + this.vel.z * wishDir.z;
    var addSpeed = wishSpeed - currentSpeed;
    if (addSpeed <= 0) return;
    var accelSpeed = accel * wishSpeed * dt;
    if (accelSpeed > addSpeed) accelSpeed = addSpeed;
    this.vel.x += accelSpeed * wishDir.x;
    this.vel.z += accelSpeed * wishDir.z;
  };

  // Swept/Iterative Cylinder-vs-AABB Collision Solver with Step-Up & Wall Normal Detection
  B.PlayerController.prototype.resolveCollisions = function (dt, levelMgr) {
    var r = P.PLAYER_RADIUS;
    var h = this.isSliding ? P.PLAYER_CROUCH_HEIGHT : P.PLAYER_HEIGHT;
    var cols = levelMgr ? levelMgr.colliders : [];

    this.touchingWallNormal = null;

    // Move X & Z first (with automatic step-up up to 0.55m for stairs/ledges)
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (this.pos.y + h <= c.minY + 0.05 || this.pos.y >= c.maxY - 0.05) continue;
      if (this.pos.x + r > c.minX && this.pos.x - r < c.maxX &&
          this.pos.z + r > c.minZ && this.pos.z - r < c.maxZ) {

        // Step-up check if near top of a low ledge
        var stepHeight = c.maxY - this.pos.y;
        if (this.grounded && stepHeight > 0 && stepHeight <= 0.65) {
          this.pos.y = c.maxY;
          continue;
        }

        // Compute minimal push-out axis in XZ
        var overlapLeft = (this.pos.x + r) - c.minX;
        var overlapRight = c.maxX - (this.pos.x - r);
        var overlapBack = (this.pos.z + r) - c.minZ;
        var overlapFront = c.maxZ - (this.pos.z - r);

        var minOverlapX = Math.min(overlapLeft, overlapRight);
        var minOverlapZ = Math.min(overlapBack, overlapFront);

        if (minOverlapX < minOverlapZ) {
          if (overlapLeft < overlapRight) {
            this.pos.x = c.minX - r;
            if (this.vel.x > 0) this.vel.x = 0;
            if (c.isWall) this.touchingWallNormal = new THREE.Vector3(-1, 0, 0);
          } else {
            this.pos.x = c.maxX + r;
            if (this.vel.x < 0) this.vel.x = 0;
            if (c.isWall) this.touchingWallNormal = new THREE.Vector3(1, 0, 0);
          }
        } else {
          if (overlapBack < overlapFront) {
            this.pos.z = c.minZ - r;
            if (this.vel.z > 0) this.vel.z = 0;
            if (c.isWall) this.touchingWallNormal = new THREE.Vector3(0, 0, -1);
          } else {
            this.pos.z = c.maxZ + r;
            if (this.vel.z < 0) this.vel.z = 0;
            if (c.isWall) this.touchingWallNormal = new THREE.Vector3(0, 0, 1);
          }
        }
      }
    }

    // Move Y & check Floor / Ceiling
    this.pos.y += this.vel.y * dt;
    this.grounded = false;

    for (var j = 0; j < cols.length; j++) {
      var cy = cols[j];
      if (this.pos.x + r <= cy.minX + 0.04 || this.pos.x - r >= cy.maxX - 0.04 ||
          this.pos.z + r <= cy.minZ + 0.04 || this.pos.z - r >= cy.maxZ - 0.04) {
        continue;
      }
      if (this.pos.y + h > cy.minY && this.pos.y < cy.maxY) {
        var distToTop = Math.abs(this.pos.y - cy.maxY);
        var distToBottom = Math.abs((this.pos.y + h) - cy.minY);
        if (this.vel.y <= 0 && distToTop <= distToBottom + 0.35) {
          this.pos.y = cy.maxY;
          this.vel.y = 0;
          this.grounded = true;
        } else if (this.vel.y > 0) {
          this.pos.y = cy.minY - h;
          this.vel.y = 0;
        }
      }
    }

    // Safety floor clamp so player can never fall out of the world
    if (this.pos.y < -15) {
      this.pos.y = 1.0;
      this.vel.y = 18.0;
    }
  };

  B.PlayerController.prototype.checkTriggers = function (levelMgr, onPlayerDamage) {
    if (!levelMgr) return;

    // 1. Jump Pads
    for (var i = 0; i < levelMgr.jumpPads.length; i++) {
      var jp = levelMgr.jumpPads[i];
      var dx = this.pos.x - jp.x;
      var dz = this.pos.z - jp.z;
      var dy = Math.abs(this.pos.y - jp.y);
      if (dy < 1.6 && (dx * dx + dz * dz) < jp.radius * jp.radius) {
        this.vel.y = jp.boostY;
        if (jp.boostZ) this.vel.z += jp.boostZ;
        this.grounded = false;
        this.isSlamming = false;
        this.isSliding = false;
        this.wallJumpsLeft = P.MAX_WALL_JUMPS;
        if (this.audio) this.audio.playJumpPad();
        break;
      }
    }

    // 2. Hazard Pools (Lava / Acid)
    if (this.hazardCooldown <= 0) {
      for (var h = 0; h < levelMgr.hazards.length; h++) {
        var hz = levelMgr.hazards[h];
        if (this.pos.x > hz.minX && this.pos.x < hz.maxX &&
            this.pos.z > hz.minZ && this.pos.z < hz.maxZ &&
            this.pos.y >= hz.minY && this.pos.y <= hz.maxY) {
          this.hazardCooldown = 0.55;
          this.vel.y = Math.max(this.vel.y, 13.5); // lava bounce
          this.grounded = false;
          if (onPlayerDamage) onPlayerDamage(hz.damage, true);
          break;
        }
      }
    }
  };

  B.PlayerController.prototype.updateCamera = function (dt, input) {
    var targetEye = (this.isSliding || this.isSlamming) ? P.CROUCH_EYE_HEIGHT : P.EYE_HEIGHT;
    this.currentEyeY += (targetEye - this.currentEyeY) * Math.min(1, dt * 16.0);

    var horizSpd = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && !this.isSliding && horizSpd > 1.5) {
      this.bobPhase += dt * Math.min(18, horizSpd * 0.85);
    }
    var bobY = (this.grounded && !this.isSliding) ? Math.sin(this.bobPhase) * 0.055 * Math.min(1, horizSpd / 16) : 0;

    // Strafe & Slide Camera Roll Tilt (Quake/ULTRAKILL signature feel)
    var strafeInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    var targetRoll = strafeInput * 0.032 + (this.isSliding ? 0.045 : 0);
    this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, dt * 12.0);

    // Decay Recoil & Screen Shake
    this.recoilPitch += (0 - this.recoilPitch) * Math.min(1, dt * 14.0);
    this.screenShake = Math.max(0, this.screenShake - dt * 1.8);

    var shakeX = (Math.random() - 0.5) * this.screenShake * 0.22;
    var shakeY = (Math.random() - 0.5) * this.screenShake * 0.22;

    this.camera.position.set(
      this.pos.x + shakeX,
      this.pos.y + this.currentEyeY + bobY + shakeY,
      this.pos.z
    );

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = Math.max(-1.48, Math.min(1.48, this.pitch + this.recoilPitch));
    this.camera.rotation.z = this.cameraRoll;
  };

  B.PlayerController.prototype.getHorizontalSpeed = function () {
    return Math.hypot(this.vel.x, this.vel.z);
  };

})(window.Bloodcore);
