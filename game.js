const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const percentCutEl = document.getElementById('percent-cut');
const finalScoreEl = document.getElementById('final-score');
const livesEl = document.getElementById('lives');
const gameOverScreen = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');

// Game State
let isGameOver = false;
let score = 0;
let highScore = localStorage.getItem('tractorHighScore') || 0;
let lives = 3;
let camera = { x: 0, y: 0 };
let invulnerableStart = 0; // Timer for i-frames after taking damage
let totalHayTiles = 0;

if (highScoreEl) highScoreEl.innerText = highScore;

// Grid settings (The Field)
const TILE_SIZE = 40;
const MAP_COLS = 120;
const MAP_ROWS = 120;
const FIELD_RADIUS = 60;
let map = []; // 1 = uncut, 0 = cut, 2 = rock
// Tiles: 18=Track, 19=Dark Track, 20=OutOfBounds, 21=Puddle, 22=Mud

// Tractor state
const tractor = {
  x: (MAP_COLS * TILE_SIZE / 2) - 80,
  y: (MAP_ROWS * TILE_SIZE / 2) + 80,
  width: 32,
  height: 48,
  speed: 1.33,
  baseSpeedOffset: 0, // Reduces permanent speed relative to score
  angle: 0, // In radians. 0 = pointing UP
  turningSpeed: 0.08,
  dx: 0,
  dy: -1,
  state: 'DRIVING', // DRIVING, STUCK, CUTSCENE
  immuneUntil: 0
};

let pivotAngle = 0;
let wetTimers = [];

let cutscene = {
  active: false,
  timer: 0,
  truckX: 0, truckY: 0,
  angle: 0,
  phase: 'NONE' // DRIVE_UP, HITCH, DRAG, LEAVE
};

const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false
};

function initMap() {
  map = [];
  totalHayTiles = 0;

  wetTimers = new Array(MAP_ROWS);
  for (let i = 0; i < MAP_ROWS; i++) wetTimers[i] = new Float64Array(MAP_COLS);

  let cx = MAP_COLS / 2;
  let cy = MAP_ROWS / 2;

  // Initial circular field fill
  for (let r = 0; r < MAP_ROWS; r++) {
    let row = [];
    for (let c = 0; c < MAP_COLS; c++) {
      let dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist > FIELD_RADIUS) {
        row.push(20); // Out of bounds
      } else {
        row.push(1); // Uncut Hay
      }
    }
    map.push(row);
  }

  // Starting safe zone override
  for (let r = cy - 4; r <= cy + 4; r++) {
    for (let c = cx - 4; c <= cx + 4; c++) {
      map[r][c] = 1;
    }
  }

  // Generate Rock Clusters
  for (let i = 0; i < 40; i++) {
    let rr = Math.floor(Math.random() * MAP_ROWS);
    let rc = Math.floor(Math.random() * MAP_COLS);
    // Don't spawn in direct center
    if (map[rr][rc] === 1 && Math.sqrt((rr - cy) ** 2 + (rc - cx) ** 2) > 8) {
      let clusterSize = Math.floor(Math.random() * 5) + 1;
      map[rr][rc] = 2;
      let curR = rr, curC = rc;
      for (let j = 1; j < clusterSize; j++) {
        let dr = Math.floor(Math.random() * 3) - 1;
        let dc = Math.floor(Math.random() * 3) - 1;
        let nr = curR + dr, nc = curC + dc;
        if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && map[nr][nc] === 1) {
          map[nr][nc] = 2;
          curR = nr; curC = nc;
        }
      }
    }
  }

  // Generate Puddle Blobs (Random Walk)
  let puddleTiles = [];
  for (let i = 0; i < 8; i++) {
    let rr = Math.floor(Math.random() * MAP_ROWS);
    let rc = Math.floor(Math.random() * MAP_COLS);
    if (map[rr][rc] === 1 && Math.sqrt((rr - cy) ** 2 + (rc - cx) ** 2) > 8) {
      let blobSize = Math.floor(Math.random() * 14) + 7; // 7 to 20 blocks
      let curR = rr, curC = rc;
      map[curR][curC] = 21; // Puddle
      puddleTiles.push({ r: curR, c: curC });
      for (let j = 1; j < blobSize; j++) {
        let dr = Math.floor(Math.random() * 3) - 1;
        let dc = Math.floor(Math.random() * 3) - 1;
        let nr = curR + dr, nc = curC + dc;
        if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && map[nr][nc] === 1) {
          map[nr][nc] = 21;
          puddleTiles.push({ r: nr, c: nc });
          curR = nr; curC = nc;
        }
      }
    }
  }

  // Extend 2-3 layers of Mud around Puddles
  for (let pt of puddleTiles) {
    let mudRadius = Math.floor(Math.random() * 2) + 2; // 2 or 3
    for (let mr = -mudRadius; mr <= mudRadius; mr++) {
      for (let mc = -mudRadius; mc <= mudRadius; mc++) {
        if (Math.abs(mr) + Math.abs(mc) <= mudRadius * 1.5) {
          let nr = pt.r + mr, nc = pt.c + mc;
          if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS) {
            if (map[nr][nc] === 1 || map[nr][nc] === 2) { // Override hay and loose rocks
              map[nr][nc] = 22; // Permanent Mud
            }
          }
        }
      }
    }
  }

  // Generate Pivot Tracks
  // Rings every 20 radius bounds extending out.
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      let dist = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2);
      if (dist <= FIELD_RADIUS) {
        let remainder = dist % 20;
        // 2 block wide tracks
        if (remainder < 1.2 || remainder > 18.8) {
          let isAdjacentPuddle = false;
          for (let ddr = -1; ddr <= 1; ddr++) {
            for (let ddc = -1; ddc <= 1; ddc++) {
              let anr = r + ddr, anc = c + ddc;
              if (anr >= 0 && anr < MAP_ROWS && anc >= 0 && anc < MAP_COLS) {
                if (map[anr][anc] === 21) isAdjacentPuddle = true;
              }
            }
          }
          map[r][c] = isAdjacentPuddle ? 19 : 18;
        } else {
          if (map[r][c] === 1) totalHayTiles++;
        }
      }
    }
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function updateLivesUI() {
  livesEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    let heart = document.createElement('div');
    heart.className = i < lives ? 'heart' : 'heart lost';
    // Adding HTML entity code for heart
    heart.innerHTML = '&#10084;';
    livesEl.appendChild(heart);
  }
}

function doGameOver(titleText) {
  isGameOver = true;
  if (titleText) {
    document.getElementById('game-over-title').innerText = titleText;
  } else {
    document.getElementById('game-over-title').innerText = "Game Over";
  }
  finalScoreEl.innerText = score;
  gameOverScreen.classList.remove('hidden');
  drawPieChart();
}

function drawPieChart() {
  const pieCanvas = document.getElementById('pie-chart');
  if (!pieCanvas) return;
  const pctx = pieCanvas.getContext('2d');

  let w = pieCanvas.width;
  let h = pieCanvas.height;

  pctx.clearRect(0, 0, w, h);

  let cutPercentage = 0;
  if (totalHayTiles > 0) {
    cutPercentage = (score / 10) / totalHayTiles;
  }

  let cx = w / 2;
  let cy = h / 2;
  let r = Math.min(cx, cy) - 2;

  pctx.imageSmoothingEnabled = false;

  // Fill background pixel circle
  for (let py = 0; py < h; py += 4) {
    for (let px = 0; px < w; px += 4) {
      let dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
      if (dist <= r) {
        let angle = Math.atan2(py - cy, px - cx);
        angle += Math.PI / 2; // Shift top
        if (angle < 0) angle += Math.PI * 2;

        let prcnt = angle / (Math.PI * 2);
        let cutPhase = prcnt <= cutPercentage;

        pctx.fillStyle = cutPhase ? '#7a875a' : '#27ae60';
        // Add subtle noise for grass texture
        if (Math.random() < 0.2) pctx.fillStyle = cutPhase ? '#59693d' : '#1e8449';

        pctx.fillRect(px, py, 4, 4);
      }
    }
  }
}

function looseLife() {
  lives--;
  updateLivesUI();

  // Flash Screen Red
  let damageOverlay = document.getElementById('damage-overlay');
  if (damageOverlay) {
    damageOverlay.classList.add('active');
    setTimeout(() => damageOverlay.classList.remove('active'), 50);
  }

  if (lives <= 0) {
    doGameOver();
  } else {
    tractor.immuneUntil = Date.now() + 3000; // 3 full seconds of phasing visually
  }
}

function executeCutscene() {
  cutscene.timer++;

  // Truck approaches from behind (-200 pixels)
  // Pulls tractor backwards (+100 pixels)
  let truckDx = Math.sin(cutscene.angle);
  let truckDy = -Math.cos(cutscene.angle);

  if (cutscene.phase === 'DRIVE_UP') {
    // Move truck towards tractor
    cutscene.truckX += truckDx * 2;
    cutscene.truckY += truckDy * 2;

    let dist = Math.sqrt((cutscene.truckX - tractor.x) ** 2 + (cutscene.truckY - tractor.y) ** 2);
    if (dist < 60) {
      cutscene.phase = 'WAIT_HITCH';
      cutscene.timer = 0;
    }
  } else if (cutscene.phase === 'WAIT_HITCH') {
    if (cutscene.timer > 60) { // 1 second wait
      cutscene.phase = 'DRAG';
    }
  } else if (cutscene.phase === 'DRAG') {
    // Reverse both back out of puddle!
    cutscene.truckX -= truckDx * 0.9;
    cutscene.truckY -= truckDy * 0.9;
    tractor.x -= truckDx * 0.9;
    tractor.y -= truckDy * 0.9;

    if (cutscene.timer > 300) { // Drag for 5 seconds to get clear
      cutscene.phase = 'UNHITCH';
      cutscene.timer = 0;
    }
  } else if (cutscene.phase === 'UNHITCH') {
    if (cutscene.timer > 60) {
      cutscene.phase = 'LEAVE';
    }
  } else if (cutscene.phase === 'LEAVE') {
    cutscene.truckX -= truckDx * 3;
    cutscene.truckY -= truckDy * 3;
    if (cutscene.timer > 120) {
      cutscene.active = false;
      tractor.state = 'DRIVING';
      // Reset speed to starting base by calculating the difference created by the score
      tractor.baseSpeedOffset = score * 0.003;
      tractor.immuneUntil = Date.now() + 2000; // 2s safety net for clearing edge cases
    }
  }

  camera.x = tractor.x - canvas.width / 2;
  camera.y = tractor.y - canvas.height / 2;
}

function update() {
  if (isGameOver) return;

  if (tractor.state === 'CUTSCENE') {
    executeCutscene();
    return;
  }

  let cxPx = (MAP_COLS * TILE_SIZE) / 2;
  let cyPx = (MAP_ROWS * TILE_SIZE) / 2;

  // Update Pivot 
  pivotAngle += (Math.PI * 2) / 5400;
  if (pivotAngle > Math.PI * 2) pivotAngle -= Math.PI * 2;

  let timeNow = Date.now();
  let pivotDx = Math.cos(pivotAngle);
  let pivotDy = Math.sin(pivotAngle);
  let pivotTileCenterR = MAP_ROWS / 2;
  let pivotTileCenterC = MAP_COLS / 2;

  // Localized 5-block watering array strictly down pivot vector
  for (let rad = 0; rad < FIELD_RADIUS; rad += 5) {
    let cCenter = Math.floor(pivotTileCenterC + pivotDx * rad);
    let rCenter = Math.floor(pivotTileCenterR + pivotDy * rad);

    let waterRadius = 5;
    for (let wr = -waterRadius; wr <= waterRadius; wr++) {
      for (let wc = -waterRadius; wc <= waterRadius; wc++) {
        if (wr * wr + wc * wc <= waterRadius * waterRadius) {
          let nr = rCenter + wr;
          let nc = cCenter + wc;
          if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS) {
            let t = map[nr][nc];
            if (t === 1 || t === 0 || t === 6 || t === 16) {
              if (t === 1) map[nr][nc] = 6;
              else if (t === 0) map[nr][nc] = 16;
              wetTimers[nr][nc] = timeNow + 5000;
            }
          }
        }
      }
    }
  }

  // Clear expired wet grass timers
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (wetTimers[r][c] > 0 && timeNow > wetTimers[r][c]) {
        wetTimers[r][c] = 0;
        if (map[r][c] === 6) map[r][c] = 1;
        else if (map[r][c] === 16) map[r][c] = 0;
      }
    }
  }

  // Collision Math against physical pipe
  let pEndX = cxPx + Math.cos(pivotAngle) * (FIELD_RADIUS * TILE_SIZE);
  let pEndY = cyPx + Math.sin(pivotAngle) * (FIELD_RADIUS * TILE_SIZE);

  let l2 = (cxPx - pEndX) * (cxPx - pEndX) + (cyPx - pEndY) * (cyPx - pEndY);
  let pt = Math.max(0, Math.min(1, ((tractor.x - cxPx) * (pEndX - cxPx) + (tractor.y - cyPx) * (pEndY - cyPx)) / l2));
  let projX = cxPx + pt * (pEndX - cxPx);
  let projY = cyPx + pt * (pEndY - cyPx);
  let distToPivot = Math.sqrt((tractor.x - projX) * (tractor.x - projX) + (tractor.y - projY) * (tractor.y - projY));

  if (distToPivot < (tractor.width / 2 + 15)) {
    if (lives > 0) {
      lives = 0;
      doGameOver("Game Over - You Broke the Main Pivot");
    }
    return;
  }

  // Determine under-body tile explicitly
  let curGridX = Math.floor(tractor.x / TILE_SIZE);
  let curGridY = Math.floor(tractor.y / TILE_SIZE);
  let bodyTileCache = 1;
  if (curGridY >= 0 && curGridY < MAP_ROWS && curGridX >= 0 && curGridX < MAP_COLS) {
    bodyTileCache = map[curGridY][curGridX];
  }

  // Logic for DRIVING state
  if (tractor.state === 'DRIVING') {
    let targetSpeed = 1.33 + (score * 0.003) - tractor.baseSpeedOffset;
    targetSpeed = Math.min(targetSpeed, 5.0); // Cap top speed
    
    if (bodyTileCache === 21 || bodyTileCache === 20) {
      // Into Puddle -> Stuck!
      tractor.state = 'STUCK';
      tractor.speed = 0;
      document.getElementById('stuck-modal').classList.remove('hidden');
    } else if (bodyTileCache === 22) { // Static Mud Border
      tractor.speed -= 0.15; // Slow down more dramatically
      if (tractor.speed < 1.0) tractor.speed = 1.0; // Cap slow speed
      tractor.baseSpeedOffset = (1.33 + (score * 0.003)) - tractor.speed;
    } else {
      tractor.speed = targetSpeed;
    }

    // Steering
    if (keys.ArrowLeft) tractor.angle -= tractor.turningSpeed;
    if (keys.ArrowRight) tractor.angle += tractor.turningSpeed;

    tractor.dx = Math.sin(tractor.angle);
    tractor.dy = -Math.cos(tractor.angle);

    let targetX = tractor.x + tractor.dx * tractor.speed;
    let targetY = tractor.y + tractor.dy * tractor.speed;

    let frontDist = tractor.height / 2 + 8;
    let frontX = targetX + tractor.dx * frontDist;
    let frontY = targetY + tractor.dy * frontDist;
    
    let perpDx = Math.cos(tractor.angle);
    let perpDy = Math.sin(tractor.angle);
    
    // Header is 56px wide, check three points across the front and the main body
    let pointsToCheck = [
      { x: targetX, y: targetY }, // Body
      { x: frontX, y: frontY },   // Front Center
      { x: frontX - perpDx * 22, y: frontY - perpDy * 22 }, // Front Left
      { x: frontX + perpDx * 22, y: frontY + perpDy * 22 }  // Front Right
    ];

    let hitRock = false;
    let hitTiles = [];
    
    for (let pt of pointsToCheck) {
      let gX = Math.floor(pt.x / TILE_SIZE);
      let gY = Math.floor(pt.y / TILE_SIZE);
      
      if (gX >= 0 && gX < MAP_COLS && gY >= 0 && gY < MAP_ROWS) {
        let tile = map[gY][gX];
        if (tile === 2 || tile === 4) {
          hitRock = true;
          if (tile === 2) map[gY][gX] = 4; // Visual crack
        }
        hitTiles.push({ r: gY, c: gX });
      }
    }

    if (hitRock) {
      if (Date.now() > tractor.immuneUntil) { // Only break and loose life if not immune
        looseLife();
      }
      // Do not bounce! Can drive through while immune.
      tractor.x = targetX;
      tractor.y = targetY;
    } else {
      // Move natively
      tractor.x = targetX;
      tractor.y = targetY;

      if (Date.now() > tractor.immuneUntil) { // Cannot swath during iframe immunity!
        function addScore() {
          score += 10;
          scoreEl.innerText = score;
          if (percentCutEl) percentCutEl.innerText = (((score / 10) / totalHayTiles) * 100).toFixed(1);
          if (score > highScore) {
            highScore = score;
            localStorage.setItem('tractorHighScore', highScore);
            if (highScoreEl) highScoreEl.innerText = highScore;
          }
        }

        // Swath all uncut or wet grass under header
        for (let ht of hitTiles) {
          let t = map[ht.r][ht.c];
          if (t === 1) {
            map[ht.r][ht.c] = 0;
            addScore();
          } else if (t === 6) {
            map[ht.r][ht.c] = 16;
            addScore();
          }
        }
      }
    }
  }

  camera.x = tractor.x - canvas.width / 2;
  camera.y = tractor.y - canvas.height / 2;
}

function draw() {
  // Clear map background
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Draw Tiles (Viewport culling - only draw tiles visible on-screen)
  let startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
  let endCol = Math.min(MAP_COLS, startCol + Math.ceil(canvas.width / TILE_SIZE) + 1);
  let startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
  let endRow = Math.min(MAP_ROWS, startRow + Math.ceil(canvas.height / TILE_SIZE) + 1);

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      let tile = map[r][c];
      let x = c * TILE_SIZE;
      let y = r * TILE_SIZE;

      if (tile === 1) {
        // Uncut Hay (Deep Green)
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        // Faux crossy-road depth
        ctx.fillStyle = '#1e8449';
        ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
      } else if (tile === 20) {
        continue; // Off limits mathematical zone (uses base background #2c3e50)
      } else if (tile === 18) {
        ctx.fillStyle = '#a67c52'; // Track Tan
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (tile === 19) {
        ctx.fillStyle = '#5c4033'; // Dark Track Tan
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (tile === 21) {
        // Puddle visually lower rendering liquid
        ctx.fillStyle = '#1e8449';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        let time = Date.now() / 200;
        let wave = Math.sin(time + x + y) * 2;
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(x + 2, y + 2 + wave, TILE_SIZE - 4, TILE_SIZE - 4 - wave);
        ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(time * 1.5 + x) * 0.1})`;
        ctx.fillRect(x + 6, y + 6 + wave, 10, 4);
      } else if (tile === 22) {
        ctx.fillStyle = '#873600';  // Permanent mud ring
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      } else if (tile === 6) {
        // Wet Hay (Darker Green)
        ctx.fillStyle = '#145a32';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#0e4124';
        ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
      } else if (tile === 7 || tile === 17) {
        // Mud (Mud Brown) visually identical regardless of cut states under it (FROM LEGACY SYSTEMS IF EXISTING)
        ctx.fillStyle = '#873600';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (tile === 0 || tile === 16) {
        // Cut Hay (Brown-Green)
        ctx.fillStyle = tile === 16 ? '#59693d' : '#7a875a';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (tile === 2 || tile === 4) {
        let groundColor = '#27ae60'; // Default to uncut hay
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (r + dr >= 0 && r + dr < MAP_ROWS && c + dc >= 0 && c + dc < MAP_COLS) {
              let nTile = map[r + dr][c + dc];
              if (nTile === 6 || nTile === 16) groundColor = '#145a32';
              else if (nTile === 7 || nTile === 17) groundColor = '#873600';
              else if (nTile === 0 && tile === 4) groundColor = '#7a875a'; // Only broken rocks allow cut grass backgrounds
            }
          }
        }
        ctx.fillStyle = groundColor;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Rock
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(x + 8, y + 8, 24, 24);
        // Depth Shadow
        ctx.fillStyle = '#34495e';
        ctx.fillRect(x + 8, y + 32, 24, 6);

        if (tile === 4) {
          // Draw cracking lines
          ctx.strokeStyle = '#2c3e50';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 8);
          ctx.lineTo(x + 20, y + 20);
          ctx.lineTo(x + 14, y + 26);
          ctx.lineTo(x + 22, y + 32);
          ctx.stroke();
        }
      }
    }
  }

  let cxPx = (MAP_COLS * TILE_SIZE) / 2;
  let cyPx = (MAP_ROWS * TILE_SIZE) / 2;

  // Draw the Massive Central Pivot System over the map natively
  ctx.save();
  ctx.translate(cxPx, cyPx);
    ctx.rotate(pivotAngle);

    // Master Metal Pipe extending 200 blocks
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(0, -8, FIELD_RADIUS * TILE_SIZE, 16);
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(0, -6, FIELD_RADIUS * TILE_SIZE, 6);

    // Procedural wheel engines mapping onto generated track radii evenly
    for (let radDist = 20; radDist <= FIELD_RADIUS; radDist += 20) {
      let wx = radDist * TILE_SIZE;

      // Wheels
      ctx.fillStyle = '#111';
      ctx.fillRect(wx - 10, -22, 20, 10); // Left tire
      ctx.fillRect(wx - 10, 12, 20, 10);  // Right tire

      // Structural joints bridging pipe and wheels
      ctx.fillStyle = '#e67e22'; // distinct joint block
      ctx.fillRect(wx - 18, -12, 36, 24);
      ctx.fillStyle = '#d35400';
      ctx.fillRect(wx - 18, -12, 36, 12);
    }

    // Dropping graphical sprinkler wet mist locally from pipe
    let mFrameTime = Date.now() / 200;
    for (let wx = 5; wx < FIELD_RADIUS; wx += 5) {
      if (wx % 20 === 0) continue; // Skip directly over wheel hubs visually
      let sX = wx * TILE_SIZE;

      // Dropping pipe nozzles
      ctx.fillStyle = '#34495e';
      ctx.fillRect(sX - 4, -12, 8, 24);

      // Radial mist fields overlapping beneath
      ctx.fillStyle = `rgba(52, 152, 219, ${0.15 + Math.sin(mFrameTime + wx) * 0.05})`;
      ctx.beginPath();
      ctx.arc(sX, 0, TILE_SIZE * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Pickup Truck Cutscene Rendering
    if (cutscene.active) {
      if (cutscene.phase === 'WAIT_HITCH' || cutscene.phase === 'DRAG') {
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cutscene.truckX, cutscene.truckY);
        ctx.lineTo(tractor.x, tractor.y);
        ctx.stroke();
      }

      // Draw Pickup Truck Shadow
      ctx.save();
      ctx.translate(cutscene.truckX, cutscene.truckY + 10);
      ctx.rotate(cutscene.angle);
      ctx.scale(0.75, 0.75);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-20, -40, 40, 80);
      ctx.restore();

      // Draw Pickup Truck
      ctx.save();
      ctx.translate(cutscene.truckX, cutscene.truckY);
      ctx.rotate(cutscene.angle);
      ctx.scale(0.75, 0.75);

      // Body of the truck (White / Silver)
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-20, -40, 40, 80); 

      // Cab
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(-18, -10, 36, 25);
      
      // Windshield
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(-16, -10, 32, 8); // Front
      ctx.fillRect(-16, 10, 32, 4);  // Back

      // Truck bed
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-16, 16, 32, 22);

      // Lights
      ctx.fillStyle = '#f1c40f'; // Headlights
      ctx.fillRect(-18, -40, 8, 4);
      ctx.fillRect(10, -40, 8, 4);
      
      ctx.fillStyle = '#c0392b'; // Taillights
      ctx.fillRect(-18, 36, 8, 4);
      ctx.fillRect(10, 36, 8, 4);

      // Tires
      ctx.fillStyle = '#111';
      ctx.fillRect(-24, -25, 4, 14); // Front Left
      ctx.fillRect(20, -25, 4, 14);  // Front Right
      ctx.fillRect(-24, 15, 4, 14);  // Back Left
      ctx.fillRect(20, 15, 4, 14);   // Back Right

      ctx.restore();
    }

    // Draw Tractor Shadow
    ctx.save();
    ctx.translate(tractor.x, tractor.y + 10);
    ctx.rotate(tractor.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-tractor.width / 2, -tractor.height / 2, tractor.width, tractor.height);
    ctx.restore();

    // Draw Tractor 
    ctx.save();
    if (tractor.immuneUntil > Date.now()) {
      if (Math.floor(Date.now() / 150) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }
    }
    ctx.translate(tractor.x, tractor.y);
    ctx.rotate(tractor.angle);

    // Swather header (front)
    ctx.fillStyle = '#34495e';
    ctx.fillRect(-tractor.width / 2 - 12, -tractor.height / 2 - 14, tractor.width + 24, 14);

    // Rotating header blades 
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(-tractor.width / 2 - 10, -tractor.height / 2 - 10, tractor.width + 20, 6);

    // Tractor body geometry
    ctx.fillStyle = '#e74c3c'; // Vibrant Red
    ctx.fillRect(-tractor.width / 2, -tractor.height / 2, tractor.width, tractor.height);

    // Tractor Cab
    ctx.fillStyle = '#ecf0f1'; // glass
    ctx.fillRect(-tractor.width / 2 + 4, -tractor.height / 2 + 10, tractor.width - 8, 18);
    ctx.fillStyle = '#2c3e50'; // roof top
    ctx.fillRect(-tractor.width / 2 + 2, -tractor.height / 2 + 8, tractor.width - 4, 16);

    // Wheels
    ctx.fillStyle = '#111'; // Tires
    ctx.fillRect(-tractor.width / 2 - 6, tractor.height / 2 - 16, 6, 20); // back left
    ctx.fillRect(tractor.width / 2, tractor.height / 2 - 16, 6, 20); // back right
    ctx.fillRect(-tractor.width / 2 - 4, -tractor.height / 2 + 6, 4, 12); // front left
    ctx.fillRect(tractor.width / 2, -tractor.height / 2 + 6, 4, 12); // front right

    ctx.restore();
    ctx.restore();
  }

  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  // Controls
  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
      // Prevent default scrolling via arrow keys only for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      keys[e.code] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = false;
    }
  });

  document.getElementById('get-help-btn').addEventListener('click', () => {
    document.getElementById('stuck-modal').classList.add('hidden');

    looseLife();
    if (lives <= 0) return; // Handled inside looseLife

    tractor.state = 'CUTSCENE';
    cutscene.active = true;
    cutscene.timer = 0;
    cutscene.angle = tractor.angle;
    // Spawn directly behind the tractor exactly 200px away 
    cutscene.truckX = tractor.x - Math.sin(tractor.angle) * 200;
    cutscene.truckY = tractor.y - (-Math.cos(tractor.angle)) * 200;
    cutscene.phase = 'DRIVE_UP';
  });

  // Restart
  restartBtn.addEventListener('click', () => {
    isGameOver = false;
    score = 0;
    lives = 3;
    scoreEl.innerText = score;
    if (percentCutEl) percentCutEl.innerText = "0.0";
    updateLivesUI();
    gameOverScreen.classList.add('hidden');
    initMap();
    tractor.x = (MAP_COLS * TILE_SIZE / 2) - 80;
    tractor.y = (MAP_ROWS * TILE_SIZE / 2) + 80;
    tractor.angle = 0;
    tractor.speed = 1.33;
    tractor.baseSpeedOffset = 0;
    tractor.state = 'DRIVING';
    tractor.immuneUntil = 0;
    pivotAngle = 0;
    document.getElementById('stuck-modal').classList.add('hidden');
  });

  // Initialize Framework
  window.addEventListener('resize', resize);
  resize();
  initMap();
  updateLivesUI();
  requestAnimationFrame(gameLoop);
