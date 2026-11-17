# BLOODCORE // ULTRAQUAKE

> **MANKIND IS DEAD. BLOOD IS FUEL. HELL IS FULL.**  
> A fast-paced, kinetic retro-cyber FPS built for the browser, inspired by *ULTRAKILL* and *Quake*.

---

## ⚡ Highlights

- **Relentless Kinetic Movement**: Always-running movement engine with Quake-style bunny-hopping & air-strafing, 3-charge stamina dash with i-frames, directional ground slide, air ground-slam, slam-jump height boost, and 3-charge wall-jumps.
- **Aggressive Survival ("Blood is Fuel")**: Enemies burst into fountains of voxel gibs and blood. Close-range damage instantly heals your HP, while the Feedbacker parry punch (`F`) triggers an 80ms hitstop, heals +50 HP, and reflects lethal projectiles back at high velocity.
- **Deep Weapon Combo Tech**:
  - **Marksman Revolver**: Precision hitscan + 4 regenerating coins (`RMB`). Shoot airborne coins for guaranteed critical ricochets (`+RICOSHOT`, `+ULTRARICOSHOT`).
  - **Core-Eject Shotgun**: 12-pellet spread + explosive core grenade (`RMB`). Punch shotgun blasts mid-fire for `+PROJECTILE BOOST` or shoot airborne cores for a room-clearing `+CORE NUKE`!
  - **Attractor Nailgun**: Rapid-fire twin-barrel rotary nails. Build heat to unleash a scorching incendiary salvo (`+OVERHEAT`) that sets targets ablaze.
  - **Volt Rail / Rocket**: High-velocity splash rockets with Quake-style rocket-jumping (`LMB`) + instant piercing electric beam (`RMB`) that detonates coins, cores, and lines of hostiles (`+CONDUCTOR`).
- **5 Articulated Cyber-Demonic Bot Archetypes + Apex Boss**:
  1. **Filth Husk**: Melee swarmer that charges with a parryable lunge.
  2. **Stray Soldier**: Armored skeletal trooper that strafes and casts parryable plasma Hell-Orbs.
  3. **Seeker Drone**: 3D hovering oculus that enters a Kamikaze Death Spiral when killed—punch it with `F` for a `+HOMERUN`!
  4. **Cerberus Juggernaut**: 3.4m stone-and-iron colossus with jumping shockwave stomps, explosive sphere throws, and an Enraged phase.
  5. **Malicious Sentry**: Tripod rail-sniper with tracking laser sight. Dash at the flash or coin-toss to trigger `+CHARGEBACK`!
  6. **ARCHON V-0 (Apex Boss)**: Winged cyber-seraph with light wings, energy greatswords, spear throws, aerial blade dashes, and judgement dive-bombs.
- **Two Game Modes**:
  - **5 Handcrafted Campaign Gauntlets**: Layer 0-1 through 0-5 with multi-room progression, jump pads, moving crushers, hazard pits (lava/acid), and end-of-stage P-Rank grading (Time, Kills, Style).
  - **The Endless Cyber-Descent ("Keep Going")**: Continuous forward procedural generation. Clearing a chamber unlocks the blast door into the next procedural arena with changing layouts, shifting biome palettes, scaling waves, and Apex Boss encounters every 5 sectors.
- **PS1/PS2 Aesthetics + Modern Dynamic Lighting**:
  - Procedurally synthesized 64×64 and 128×128 NearestFilter textures with Bayer dithering and pixel bump relief.
  - Full dynamic colored point lights, weapon muzzle flashes, and customizable post-processing pipeline featuring emissive HDR bloom, speed chromatic aberration, and optional CRT scanlines.
- **Dynamic 168 BPM Procedural WebAudio Synthesizer**:
  - Real-time synthesized breakcore / industrial drum-and-bass soundtrack (adaptive intensity shifts from eerie corridor drone to intense 168–176 BPM combat beats).
  - 100% procedurally synthesized SFX for all guns, parry clangs, coin dings, explosions, and UI.

---

## 🎮 Controls

| Action | Key / Input | Notes |
| :--- | :--- | :--- |
| **Move** | `W` `A` `S` `D` | Always-running baseline |
| **Look / Aim** | `Mouse` | Pointer lock enabled on click |
| **Jump / Bunny-Hop** | `Space` | Press right on landing to build & stack speed |
| **Wall-Jump** | `Space` against wall | Up to 3 charges before touching floor or jump pad |
| **Slam-Jump** | `Space` after slam impact | Press within 0.28s of ground slam for 1.58x jump |
| **Stamina Dash** | `Shift` | Consumes 1 of 3 stamina bars; grants i-frames |
| **Ground Slide** | `Ctrl` or `C` (ground) | Lowers camera, preserves momentum, full 360° aim |
| **Air Ground-Slam** | `Ctrl` or `C` (air) | Plummets down at 46 m/s; launches light enemies |
| **Primary Fire** | `Left Mouse` | Auto-fire supported on hold |
| **Alt-Fire** | `Right Mouse` | Coin Toss / Core Eject / Overheat / Rail Beam |
| **Feedbacker Punch / Parry** | `F` | Parry projectiles & melee (+50 HP, hitstop) |
| **Switch Weapon** | `1` `2` `3` `4` / `Scroll` | Instant weapon selection |
| **Quick-Swap** | `Q` | Toggles between last two weapons |
| **Pause / Resume** | `Esc` | Opens system interrupt terminal |

---

## 💥 Combo & Tech Cheat Sheet

- **`+RICOSHOT`**: Toss a coin with `RMB` (Revolver) and shoot it with your hitscan revolver for an auto-targeted weakpoint critical hit.
- **`+ULTRARICOSHOT`**: Toss multiple coins into the air; shooting one cascades through all active coins before slamming into an enemy.
- **`+CORE NUKE`**: Lob a Shotgun Core with `RMB` and shoot the grenade mid-air with the Revolver or Railcannon for a massive explosion.
- **`+PROJECTILE BOOST`**: Fire the Shotgun (`LMB`) and press `F` (Punch) at the exact same instant to punch a pellet into a high-speed explosive rocket shell.
- **`+CHARGEBACK`**: When a Malicious Sentry is locking on with its red laser, throw a coin in the beam line to reflect its hitscan shot back into its optic sensor.
- **`+HOMERUN`**: When a Seeker Drone enters its kamikaze death spiral, punch it with `F` to bat it toward other enemies as a guided bomb.
- **`+ROCKET JUMP`**: Fire a rocket at your feet while jumping or dashing to launch into high aerial vantage points (forgiving self-damage).

---

## 🛠️ Tech Stack & Architecture

- **Engine**: Three.js (r128) WebGL Renderer
- **Zero Build Step**: Native ES5/ES6 modules loaded via script tags; runs locally on any lightweight HTTP server or directly in the browser.
- **Custom Post-Processing (`src/postfx.js`)**: Single-pass dual-ring bright-pass halation bloom, speed-adaptive chromatic aberration, Bayer dithering, and ACES filmic tonemapping.
- **Procedural Pixel Texture Generator (`src/textures.js`)**: Real-time canvas generation of 64×64 pixelated textures with 4×4 Bayer matrix quantizing and normal/bump maps.
- **Procedural WebAudio Sequencer (`src/audio.js`)**: Real-time synthesized 16-step amen break drum synth, lowpass filtered bass synth, acid arpeggiator, and FM combat sound effects without external audio assets.
- **Storage**: LocalStorage saves campaign level P-ranks, best times, and endless mode sector records.

---

## 🚀 Running Locally

Clone the repository and serve the folder using any HTTP server:

```bash
# Clone the repository
git clone https://github.com/TrySmthNew993/bloodcore-ultraquake.git
cd bloodcore-ultraquake

# Option 1: Python 3
python3 -m http.server 8080

# Option 2: Node.js (npx serve or http-server)
npx serve .

# Option 3: VS Code Live Server
# Right click index.html -> "Open with Live Server"
```

Open `http://localhost:8080` in Chrome, Firefox, Safari, or Edge and click **DEPLOY INTO LAYER**.

---

## 📜 License

MIT License. Created with passion for retro-shooters and movement games.
