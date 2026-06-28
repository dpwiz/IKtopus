export interface Particle {
    x: number;
    y: number;
    oldX: number;
    oldY: number;
    tentacleId: number;
    index: number;
}

export interface Treat {
    x: number;
    y: number;
    vy: number;
    active: boolean;
}

export class Fish {
    x: number;
    y: number;
    vx: number;
    vy: number;
    targetX: number;
    targetY: number;
    state: 'seeking' | 'random' | 'caught' | 'eaten' | 'predator_caught' | 'husk';
    wanderAngle: number = 0;
    hue: number;
    timeOffset: number;
    type: 'normal' | 'predator';
    sizeScale: number;
    draggedPrey: Fish | null = null;
    predatorBiteTime: number = 0;
    dashCooldown: number = 0;
    dashDuration: number = 0;
    eatenTime: number = 0;
    lookX: number = 0;
    lookY: number = 0;

    constructor(x: number, targetX: number, y: number, targetY: number, type: 'normal' | 'predator' = 'normal') {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.targetX = targetX;
        this.targetY = targetY;
        this.state = 'seeking';
        this.type = type;
        this.sizeScale = type === 'predator' ? 2.5 : 1;
        this.hue = type === 'predator' ? Math.floor(Math.random() * 35) : Math.floor(Math.random() * 120) + 120; // Predators red/orange, normal green/blue
        this.timeOffset = Math.random() * 1000;
    }

    update(fishes: Fish[], treats: Treat[], octopus: Octopus) {
        if (this.state === 'eaten') {
            this.eatenTime++;
            if (this.eatenTime > 60) {
                this.state = 'husk';
            }
            return;
        }

        if (this.state === 'caught' || this.state === 'predator_caught') return;

        if (this.state === 'husk') {
            this.y += 0.5;
            this.x += Math.sin(this.y * 0.02) * 0.3; // slowly sink and sway
            return;
        }

        if (this.state === 'seeking') {
            let dx = this.targetX - this.x;
            let dy = this.targetY - this.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist < 80) {
                this.state = 'random';
                this.wanderAngle = Math.atan2(dy, dx);
            } else {
                let ax = (dx / dist) * 0.15;
                let ay = (dy / dist) * 0.15;
                this.vx += ax;
                this.vy += ay;
            }
        } else if (this.state === 'random') {
            this.wanderAngle += (Math.random() - 0.5) * 0.2;
            let ax = Math.cos(this.wanderAngle) * 0.05;
            let ay = Math.sin(this.wanderAngle) * 0.05;
            this.vx += ax;
            this.vy += ay;
            
            // Flocking & Predator behavior
            let separationDistance = 40;
            let neighborDistance = 150;
            let sepX = 0, sepY = 0;
            let alignX = 0, alignY = 0;
            let cohX = 0, cohY = 0;
            let count = 0;
            
            let predAvoidX = 0, predAvoidY = 0;
            let preyCentX = 0, preyCentY = 0;
            let preyCount = 0;
            let caughtAvoidX = 0, caughtAvoidY = 0;

            for (let other of fishes) {
                if (other === this || other.state === 'husk') continue;
                
                let isCaught = other.state === 'caught' || other.state === 'predator_caught' || other.state === 'eaten';
                
                let dx = this.x - other.x;
                let dy = this.y - other.y;
                let dist = Math.hypot(dx, dy);

                if (this.type === 'normal' && other.type === 'predator') {
                    if (dist > 0 && dist < 250 && !isCaught) {
                        predAvoidX += dx / dist;
                        predAvoidY += dy / dist;
                    }
                } else if (this.type === 'predator' && other.type === 'normal') {
                    if (dist > 0 && dist < 500 && !isCaught) {
                        preyCentX += other.x;
                        preyCentY += other.y;
                        preyCount++;
                        
                        if (dist < 25 && !this.draggedPrey) {
                            this.draggedPrey = other;
                            other.state = 'predator_caught';
                            this.predatorBiteTime = 0;
                        } else if (dist < 150 && !this.draggedPrey && this.dashCooldown <= 0) {
                            let angleToPrey = Math.atan2(other.y - this.y, other.x - this.x);
                            let currentAngle = Math.atan2(this.vy, this.vx);
                            let angleDiff = Math.abs(angleToPrey - currentAngle);
                            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
                            if (Math.abs(angleDiff) < Math.PI / 4) {
                                this.dashDuration = 40;
                                this.dashCooldown = 200;
                            }
                        }
                    }
                } else if (this.type === other.type) {
                    if (isCaught) {
                        if (dist > 0 && dist < 250) {
                            caughtAvoidX += dx / dist;
                            caughtAvoidY += dy / dist;
                        }
                        continue;
                    }

                    if (dist > 0 && dist < separationDistance) {
                        sepX += dx / dist;
                        sepY += dy / dist;
                    }

                    if (dist > 0 && dist < neighborDistance) {
                        alignX += other.vx;
                        alignY += other.vy;
                        cohX += other.x;
                        cohY += other.y;
                        count++;
                    }
                }
            }

            if (this.type === 'normal') {
                if (count > 0) {
                    alignX /= count;
                    alignY /= count;
                    cohX /= count;
                    cohY /= count;

                    let alignSpeed = Math.hypot(alignX, alignY);
                    if (alignSpeed > 0) {
                       this.vx += (alignX / alignSpeed) * 0.05;
                       this.vy += (alignY / alignSpeed) * 0.05;
                    }

                    let cdx = cohX - this.x;
                    let cdy = cohY - this.y;
                    let cohSpeed = Math.hypot(cdx, cdy);
                    if (cohSpeed > 0) {
                       this.vx += (cdx / cohSpeed) * 0.02;
                       this.vy += (cdy / cohSpeed) * 0.02;
                    }
                }
                
                let sepSpeed = Math.hypot(sepX, sepY);
                if (sepSpeed > 0) {
                   this.vx += (sepX / sepSpeed) * 0.1;
                   this.vy += (sepY / sepSpeed) * 0.1;
                }

                let predAvoidSpeed = Math.hypot(predAvoidX, predAvoidY);
                if (predAvoidSpeed > 0) {
                    this.vx += (predAvoidX / predAvoidSpeed) * 0.3; // High priority escape
                    this.vy += (predAvoidY / predAvoidSpeed) * 0.3;
                }
                
                let caughtAvoidSpeed = Math.hypot(caughtAvoidX, caughtAvoidY);
                if (caughtAvoidSpeed > 0) {
                    this.vx += (caughtAvoidX / caughtAvoidSpeed) * 0.35; // Stronger avoidance
                    this.vy += (caughtAvoidY / caughtAvoidSpeed) * 0.35;
                }
                
                // Treat attraction
                let closestTreat: Treat | null = null;
                let closestTreatDist = 1000;
                for (let t of treats) {
                    if (!t.active) continue;
                    let tdx = t.x - this.x;
                    let tdy = t.y - this.y;
                    let tdist = Math.hypot(tdx, tdy);
                    if (tdist < closestTreatDist) {
                        closestTreatDist = tdist;
                        closestTreat = t;
                    }
                }

                if (closestTreat && closestTreatDist < 600) { 
                    let tdx = closestTreat.x - this.x;
                    let tdy = closestTreat.y - this.y;
                    this.vx += (tdx / closestTreatDist) * 0.25;
                    this.vy += (tdy / closestTreatDist) * 0.25;

                    if (closestTreatDist < 12) {
                        closestTreat.active = false;
                    }
                }
            } else if (this.type === 'predator') {
                if (preyCount > 0) {
                    preyCentX /= preyCount;
                    preyCentY /= preyCount;
                    let cdx = preyCentX - this.x;
                    let cdy = preyCentY - this.y;
                    let cohSpeed = Math.hypot(cdx, cdy);
                    if (cohSpeed > 0) {
                       this.vx += (cdx / cohSpeed) * 0.04;
                       this.vy += (cdy / cohSpeed) * 0.04;
                    }
                }
                
                let sepSpeed = Math.hypot(sepX, sepY);
                if (sepSpeed > 0) {
                   this.vx += (sepX / sepSpeed) * 0.05;
                   this.vy += (sepY / sepSpeed) * 0.05;
                }
            }
            
            // Repel from edges gently
            let margin = 100;
            if (this.x < margin) this.vx += 0.2;
            if (this.x > window.innerWidth - margin) this.vx -= 0.2;
            if (this.y < margin) this.vy += 0.2;
            if (this.y > window.innerHeight - margin) this.vy -= 0.2;
            
            // Avoid octopus
            let odx = this.x - octopus.x;
            let ody = this.y - octopus.y;
            let odist = Math.hypot(odx, ody);
            if (odist < 350) {
                this.vx += (odx / odist) * 0.6;
                this.vy += (ody / odist) * 0.6;
            }
            
            if (this.type === 'predator') {
                if (this.draggedPrey) {
                    this.lookX = this.draggedPrey.x;
                    this.lookY = this.draggedPrey.y;
                } else if (preyCount > 0) {
                    this.lookX = preyCentX;
                    this.lookY = preyCentY;
                } else {
                    this.lookX = this.x + this.vx;
                    this.lookY = this.y + this.vy;
                }
            } else {
                this.lookX = this.x + this.vx;
                this.lookY = this.y + this.vy;
            }
        }

        // Apply drag & limit speed
        let speed = Math.hypot(this.vx, this.vy);
        let maxSpeed = this.type === 'predator' ? 2 : 4;
        
        if (this.type === 'predator') {
            if (this.dashCooldown > 0) this.dashCooldown--;
            if (this.dashDuration > 0) {
                this.dashDuration--;
                maxSpeed *= 2.5; // Boost speed
                this.vx *= 1.05; // Acceleration
                this.vy *= 1.05;
            }
            if (this.draggedPrey) {
                maxSpeed *= 0.6; // slow down when dragging prey
            }
        }

        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;
        
        if (this.type === 'predator' && this.draggedPrey) {
            this.predatorBiteTime++;
            let angle = Math.atan2(this.vy, this.vx);
            this.draggedPrey.x = this.x + Math.cos(angle) * 15 * this.sizeScale;
            this.draggedPrey.y = this.y + Math.sin(angle) * 15 * this.sizeScale;
            
            if (this.predatorBiteTime > 180) {
                this.draggedPrey.state = 'husk';
                this.draggedPrey = null;
            }
        }
    }
}

export class Tentacle {
    particles: Particle[] = [];
    segmentLength: number;
    baseAngle: number;
    id: number;
    targetFish: Fish | null = null;
    state: 'idle' | 'reaching' | 'feeding' | 'unfurling' = 'idle';
    timeOnTarget: number = 0;

    constructor(id: number, spawnX: number, spawnY: number, baseAngle: number, numSegments: number, segmentLength: number) {
        this.id = id;
        this.segmentLength = segmentLength;
        this.baseAngle = baseAngle;
        
        let cx = spawnX;
        let cy = spawnY;
        for (let i = 0; i < numSegments; i++) {
            this.particles.push({
                x: cx, y: cy, oldX: cx, oldY: cy,
                tentacleId: id, index: i
            });
            cx += Math.cos(baseAngle) * segmentLength;
            cy += Math.sin(baseAngle) * segmentLength;
        }
    }
}

export class Octopus {
    x: number;
    y: number;
    radius: number;
    tentacles: Tentacle[];
    time: number = 0;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.radius = 45;
        this.tentacles = [];
        
        for (let i = 0; i < 8; i++) {
            let angle = (i / 8) * Math.PI * 2;
            this.tentacles.push(new Tentacle(i, x, y, angle, 24, 12));
        }
    }

    update(fishes: Fish[]) {
        this.time++;
        
        let w = window.innerWidth;
        let h = window.innerHeight;
        
        // Gentle returning to center if drifted too far
        let dxCenter = w / 2 - this.x;
        let dyCenter = h / 2 - this.y;
        this.x += dxCenter * 0.005;
        this.y += dyCenter * 0.005;
        
        // Floating motion
        this.x += Math.cos(this.time * 0.012) * 0.3;
        this.y += Math.sin(this.time * 0.015) * 0.3;

        // 1. Assign Targets
        for (let t of this.tentacles) {
            if (t.state === 'reaching' && t.targetFish) {
                t.timeOnTarget++;
                if (Math.random() < (t.timeOnTarget / 10000)) {
                    t.state = 'idle';
                    t.targetFish = null;
                    t.timeOnTarget = 0;
                }
            } else if (t.state === 'feeding' && t.targetFish) {
                t.timeOnTarget++;
                if (t.timeOnTarget > 350) {
                    t.state = 'unfurling';
                    t.timeOnTarget = 0;
                }
            } else if (t.state === 'unfurling' && t.targetFish) {
                t.timeOnTarget++;
                if (t.timeOnTarget > 120) {
                    t.state = 'feeding';
                    t.timeOnTarget = 0;
                }
            }

            if (t.state === 'idle') {
                let prevId = (t.id - 1 + this.tentacles.length) % this.tentacles.length;
                let nextId = (t.id + 1) % this.tentacles.length;
                if (this.tentacles[prevId].state !== 'idle' || this.tentacles[nextId].state !== 'idle') {
                    continue;
                }

                let maxReach = t.particles.length * t.segmentLength * 0.95;
                let closestDist = maxReach;
                let target: Fish | null = null;
                
                for (let f of fishes) {
                    if (f.state !== 'caught' && f.state !== 'eaten' && f.state !== 'predator_caught' && f.state !== 'husk') {
                        let isTargeted = false;
                        for (let other of this.tentacles) {
                            if (other !== t && other.targetFish === f) {
                                isTargeted = true;
                                break;
                            }
                        }
                        if (isTargeted) continue;

                        let dx = f.x - t.particles[0].x;
                        let dy = f.y - t.particles[0].y;
                        let dist = Math.hypot(dx, dy);
                        if (dist < closestDist) {
                            closestDist = dist;
                            target = f;
                        }
                    }
                }
                
                if (target) {
                    t.targetFish = target;
                    t.state = 'reaching';
                    t.timeOnTarget = 0;
                }
            }
            
            if (t.state === 'reaching' && t.targetFish) {
                if (t.targetFish.state === 'caught' || t.targetFish.state === 'eaten' || t.targetFish.state === 'predator_caught' || t.targetFish.state === 'husk') {
                    t.state = 'idle';
                    t.targetFish = null;
                    t.timeOnTarget = 0;
                } else {
                    let endP = t.particles[t.particles.length - 1];
                    let dx = t.targetFish.x - endP.x;
                    let dy = t.targetFish.y - endP.y;
                    let dist = Math.hypot(dx, dy);
                    if (dist < 25) {
                        t.state = 'feeding';
                        t.targetFish.state = 'caught';
                        t.targetFish.vx = 0;
                        t.targetFish.vy = 0;
                        t.timeOnTarget = 0;
                    }
                }
            }
            
            if (t.state === 'feeding' && t.targetFish) {
                let dx = this.x - t.targetFish.x;
                let dy = this.y - t.targetFish.y;
                if (Math.hypot(dx, dy) < 55) {
                    t.targetFish.state = 'eaten';
                    t.state = 'idle';
                    t.targetFish = null;
                    t.timeOnTarget = 0;
                }
            }
        }

        // 2. Velocity and Damping integration
        let allP: Particle[] = [];
        for (let t of this.tentacles) {
            for (let p of t.particles) {
                let vx = (p.x - p.oldX) * 0.90; // Higher internal friction feels like muscle
                let vy = (p.y - p.oldY) * 0.90;
                p.oldX = p.x;
                p.oldY = p.y;
                p.x += vx;
                p.y += vy;
                allP.push(p);
            }
        }

        // 3. AI Inverse Kinematics Forces
        for (let t of this.tentacles) {
            if (t.state === 'reaching' && t.targetFish) {
                let end = t.particles[t.particles.length - 1];
                let dx = t.targetFish.x - end.x;
                let dy = t.targetFish.y - end.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    // Maximum rate of change limiter for the head of constraint chain
                    let force = Math.min(dist * 0.1, 5.5);
                    end.x += (dx / dist) * force;
                    end.y += (dy / dist) * force;
                }
                
                // Assist middle of the tentacle to curve intelligently (wrap effect)
                let mid = Math.floor(t.particles.length / 2);
                for (let i = mid; i < t.particles.length - 1; i++) {
                   let p = t.particles[i];
                   let pdx = t.targetFish.x - p.x;
                   let pdy = t.targetFish.y - p.y;
                   let pdist = Math.hypot(pdx, pdy);
                   if (pdist > 0) {
                       p.x += (pdx / pdist) * 0.4;
                       p.y += (pdy / pdist) * 0.4;
                   }
                }
            } else if (t.state === 'feeding' && t.targetFish) {
                let end = t.particles[t.particles.length - 1];
                let dx = this.x - end.x;
                let dy = this.y - end.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    end.x += (dx / dist) * 4.0;
                    end.y += (dy / dist) * 4.0;
                }
            } else if (t.state === 'unfurling' && t.targetFish) {
                let end = t.particles[t.particles.length - 1];
                let dx = (this.x + Math.cos(t.baseAngle) * 300) - end.x;
                let dy = (this.y + Math.sin(t.baseAngle) * 300) - end.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    end.x += (dx / dist) * 3.0;
                    end.y += (dy / dist) * 3.0;
                }
            } else {
                let angle = t.baseAngle;
                let outwardX = Math.cos(angle) * 0.25;
                let outwardY = Math.sin(angle) * 0.25;
                for (let i = 1; i < t.particles.length; i++) {
                    let p = t.particles[i];
                    p.x += outwardX + Math.cos(this.time * 0.015 + i * 0.2 + t.id) * 0.25;
                    p.y += outwardY + Math.sin(this.time * 0.018 + i * 0.2 + t.id) * 0.25;
                }
            }
        }

        // 4. Resolve Constraints Iteratively
        for (let iter = 0; iter < 12; iter++) {
            for (let t of this.tentacles) {
                t.particles[0].x = this.x + Math.cos(t.baseAngle) * this.radius * 0.9;
                t.particles[0].y = this.y + Math.sin(t.baseAngle) * this.radius * 0.9;
                
                // Distance Constraint (strict)
                for (let i = 0; i < t.particles.length - 1; i++) {
                    let p1 = t.particles[i];
                    let p2 = t.particles[i+1];
                    let dx = p2.x - p1.x;
                    let dy = p2.y - p1.y;
                    let dist = Math.hypot(dx, dy);
                    let diff = t.segmentLength - dist;
                    if (dist > 0) {
                        let percent = (diff / dist) / 2;
                        p1.x -= dx * percent;
                        p1.y -= dy * percent;
                        p2.x += dx * percent;
                        p2.y += dy * percent;
                    }
                }
                
                // Rigidity / Angle limitation (prevents sharp folds)
                for (let i = 0; i < t.particles.length - 2; i++) {
                    let p1 = t.particles[i];
                    let p2 = t.particles[i+2];
                    let dx = p2.x - p1.x;
                    let dy = p2.y - p1.y;
                    let dist = Math.hypot(dx, dy);
                    let target = t.segmentLength * 1.95; // Stiff bend capacity
                    let diff = target - dist;
                    if (dist > 0 && dist < target) {
                        let percent = (diff / dist) / 2 * 0.08; 
                        p1.x -= dx * percent;
                        p1.y -= dy * percent;
                        p2.x += dx * percent;
                        p2.y += dy * percent;
                    }
                }
            }
            
            // Self-intersection Check (every few cycles for performance smoothing)
            if (iter % 4 === 0) { 
                for (let i = 0; i < allP.length; i++) {
                    for (let j = i + 1; j < allP.length; j++) {
                        let p1 = allP[i];
                        let p2 = allP[j];
                        
                        // Ignore collision with immediate neighbors on the same tentacle
                        if (p1.tentacleId === p2.tentacleId && Math.abs(p1.index - p2.index) < 4) continue;
                        
                        let dx = p2.x - p1.x;
                        let dy = p2.y - p1.y;
                        let distSq = dx * dx + dy * dy;
                        let minR = 14; 
                        
                        if (distSq < minR * minR && distSq > 0.001) {
                            let dist = Math.sqrt(distSq);
                            let force = (minR - dist) / dist * 0.5;
                            p1.x -= dx * force;
                            p1.y -= dy * force;
                            p2.x += dx * force;
                            p2.y += dy * force;
                        }
                    }
                }
            }
        }

        // Lock caught fishes to the tentacles
        for (let t of this.tentacles) {
            if ((t.state === 'feeding' || t.state === 'unfurling') && t.targetFish) {
                let end = t.particles[t.particles.length - 1];
                t.targetFish.x = end.x;
                t.targetFish.y = end.y;
            }
        }
    }
}

export function runSimulation(canvas: HTMLCanvasElement): () => void {
    const ctx = canvas.getContext('2d')!;
    let animationId = 0;
    
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    
    const fishes: Fish[] = [];
    const treats: Treat[] = [];
    const octopus = new Octopus(window.innerWidth / 2, window.innerHeight / 2);
    
    const clickHandler = (e: MouseEvent) => {
        let rect = canvas.getBoundingClientRect();
        let cx = e.clientX - rect.left;
        let cy = e.clientY - rect.top;
        
        treats.push({ x: cx, y: cy, vy: 1.5, active: true });
    };
    
    canvas.addEventListener('click', clickHandler);
    
    const drawBackground = (w: number, h: number, time: number) => {
        let grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0c4a6e'); // sky-900
        grad.addColorStop(1, '#020617'); // slate-950
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for(let i = 0; i < 6; i++) {
            ctx.beginPath();
            let x = Math.sin(time*0.001 + i) * 300 + w/2 + (i-3)*250;
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 200*Math.sin(time*0.0005+i), h);
            ctx.lineTo(x + 400 + 200*Math.sin(time*0.0005+i), h);
            ctx.lineTo(x + 150, 0);
            ctx.fill();
        }
        ctx.restore();
    };
    
    const drawFish = (f: Fish) => {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.sizeScale, f.sizeScale);
        let angle = Math.atan2(f.vy, f.vx);
        if (f.vx === 0 && f.vy === 0 && f.state === 'caught') {
            angle = octopus.time * 0.1; // Flail when caught
        }
        if (f.state === 'husk' || f.state === 'eaten') {
            angle = Math.PI / 2 + Math.sin(f.y * 0.05) * 0.2;
        } else if (f.state === 'predator_caught') {
            angle = octopus.time * 0.2; // Flail wildly when caught by predator
        }
        
        ctx.rotate(angle);
        
        if (f.state === 'husk' || f.state === 'eaten') {
            ctx.fillStyle = `hsl(${f.hue}, 10%, 40%)`; // Dull color for husk
        } else {
            ctx.fillStyle = `hsl(${f.hue}, 90%, 55%)`;
        }
        
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        let tailSwing = Math.sin(octopus.time * 0.5 + f.timeOffset) * 6;
        if (f.state === 'caught' || f.state === 'predator_caught') tailSwing *= 3; // Panic
        if (f.state === 'husk' || f.state === 'eaten') tailSwing = 0; // Dead
        
        ctx.moveTo(-10, 0);
        ctx.lineTo(-20, -8 + tailSwing);
        ctx.lineTo(-20, 8 + tailSwing);
        ctx.fill();
        
        if (f.state === 'husk' || f.state === 'eaten') {
            ctx.fillStyle = '#cbd5e1';
            ctx.beginPath(); ctx.arc(5, -2, 2, 0, Math.PI*2); ctx.fill();
            // Dead eye
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(4, -3); ctx.lineTo(6, -1);
            ctx.moveTo(6, -3); ctx.lineTo(4, -1);
            ctx.stroke();
        } else {
            let pupilX = 5.5;
            let pupilY = -2;
            if (f.lookX !== 0 || f.lookY !== 0) {
                let lookAngle = Math.atan2(f.lookY - f.y, f.lookX - f.x);
                let relAngle = lookAngle - angle;
                pupilX = 5 + Math.cos(relAngle) * 1;
                pupilY = -2 + Math.sin(relAngle) * 1;
            }

            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(5, -2, 2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.arc(pupilX, pupilY, 1, 0, Math.PI*2); ctx.fill();
        }
        
        ctx.restore();
    };

    const spawnRandomFish = () => {
        let margin = 60;
        let w = window.innerWidth;
        let h = window.innerHeight;
        let sx = 0, sy = 0;
        let rand = Math.random();
        
        if (rand < 0.25) { sx = Math.random() * w; sy = -margin; }
        else if (rand < 0.5) { sx = w + margin; sy = Math.random() * h; }
        else if (rand < 0.75) { sx = Math.random() * w; sy = h + margin; }
        else { sx = -margin; sy = Math.random() * h; }
        
        let cx = w / 2 + (Math.random() - 0.5) * w * 0.6;
        let cy = h / 2 + (Math.random() - 0.5) * h * 0.6;
        fishes.push(new Fish(sx, cx, sy, cy, 'normal'));
    };

    const spawnPredatorFish = () => {
        let w = window.innerWidth;
        let h = window.innerHeight;
        let sx = -100, sy = Math.random() * h;
        let cx = w / 2 + (Math.random() - 0.5) * w * 0.8;
        let cy = h / 2 + (Math.random() - 0.5) * h * 0.8;
        fishes.push(new Fish(sx, cx, sy, cy, 'predator'));
    };

    const loop = () => {
        let predatorCount = 0;
        for (let f of fishes) {
            if (f.type === 'predator' && f.state !== 'eaten' && f.state !== 'husk') predatorCount++;
        }
        if (predatorCount === 0) {
            spawnPredatorFish();
        }

        if (Math.random() < 0.015 && fishes.length < 25) {
            spawnRandomFish();
        }

        octopus.update(fishes);
        
        for (let j = treats.length - 1; j >= 0; j--) {
            let t = treats[j];
            t.y += t.vy;
            if (t.y > window.innerHeight + 10 || !t.active) {
                treats.splice(j, 1);
            }
        }
        
        for (let j = fishes.length - 1; j >= 0; j--) {
            let f = fishes[j];
            if (f.state === 'husk' && f.y > window.innerHeight + 50) fishes.splice(j, 1);
            else f.update(fishes, treats, octopus);
        }
        
        drawBackground(window.innerWidth, window.innerHeight, octopus.time);
        
        for (let t of treats) {
            ctx.fillStyle = '#fef08a'; // yellow-200
            ctx.beginPath();
            ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw fishes
        for (let f of fishes) drawFish(f);
        
        // Draw tentacles
        for (let t of octopus.tentacles) {
            let pts = t.particles;
            ctx.fillStyle = '#450a0a'; // dark red
            
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                let p = pts[i];
                let nx = 0, ny = 0;
                if (i < pts.length - 1) {
                    let d = Math.hypot(pts[i+1].x - p.x, pts[i+1].y - p.y) || 1;
                    nx = -(pts[i+1].y - p.y) / d;
                    ny = +(pts[i+1].x - p.x) / d;
                } else {
                    let d = Math.hypot(p.x - pts[i-1].x, p.y - pts[i-1].y) || 1;
                    nx = -(p.y - pts[i-1].y) / d;
                    ny = +(p.x - pts[i-1].x) / d;
                }
                let th = (1 - i / (pts.length - 1)) * 16 + 2.5; 
                ctx.lineTo(p.x + nx * th, p.y + ny * th);
            }
            
            for (let i = pts.length - 1; i >= 0; i--) {
                let p = pts[i];
                let nx = 0, ny = 0;
                if (i > 0) {
                    let d = Math.hypot(p.x - pts[i-1].x, p.y - pts[i-1].y) || 1;
                    nx = -(p.y - pts[i-1].y) / d;
                    ny = +(p.x - pts[i-1].x) / d;
                } else {
                    let d = Math.hypot(pts[1].x - p.x, pts[1].y - p.y) || 1;
                    nx = -(pts[1].y - p.y) / d;
                    ny = +(pts[1].x - p.x) / d;
                }
                let th = (1 - i / (pts.length - 1)) * 16 + 2.5; 
                ctx.lineTo(p.x - nx * th, p.y - ny * th);
            }
            ctx.closePath();
            ctx.fill();
            
            // Draw suckers
            ctx.fillStyle = '#f87171'; // bright red
            for(let i=2; i<pts.length-1; i+=2) {
                let p = pts[i];
                let pNext = pts[i+1];
                let dx = pNext.x - p.x;
                let dy = pNext.y - p.y;
                let d = Math.hypot(dx, dy) || 1;
                // Offset toward right inner curve softly
                let turnDir = t.id % 2 === 0 ? 1 : -1;
                let nx = dy / d * turnDir; 
                let ny = -dx / d * turnDir;
                let th = (1 - i / (pts.length - 1)) * 12;
                
                ctx.beginPath();
                ctx.arc(p.x + nx * th, p.y + ny * th, th * 0.45, 0, Math.PI*2);
                ctx.fill();
            }
        }
        
        // Draw octopus body
        let bx = octopus.x;
        let by = octopus.y;
        let r = octopus.radius + 18; // Make central body visually larger
        let grad = ctx.createRadialGradient(bx, by, r*0.3, bx, by, r);
        grad.addColorStop(0, '#991b1b'); // red-800
        grad.addColorStop(1, '#450a0a'); // red-950
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.ellipse(bx, by, r * 1.15, r * 0.95, Math.sin(octopus.time*0.01)*0.1, 0, Math.PI*2);
        ctx.fill();
        
        // Scary Octopus Eyes
        let eyeR = r * 0.55;
        let ex1 = bx + Math.cos(-Math.PI/2 - 0.45) * eyeR;
        let ey1 = by + Math.sin(-Math.PI/2 - 0.45) * eyeR;
        let ex2 = bx + Math.cos(-Math.PI/2 + 0.45) * eyeR;
        let ey2 = by + Math.sin(-Math.PI/2 + 0.45) * eyeR;
        
        let pOffset1 = Math.cos(octopus.time*0.015) * r*0.05;
        let pOffset2 = Math.sin(octopus.time*0.013) * r*0.05;

        // Left Eye (Slanted)
        ctx.save();
        ctx.translate(ex1, ey1);
        ctx.rotate(0.35); // Slanted inwards
        ctx.fillStyle = '#fef08a'; // Glowing yellow sclera
        ctx.beginPath(); ctx.ellipse(0, 0, r*0.25, r*0.12, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000000'; // Slit pupil
        ctx.beginPath(); ctx.ellipse(pOffset1, pOffset2, r*0.04, r*0.1, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // Right Eye (Slanted)
        ctx.save();
        ctx.translate(ex2, ey2);
        ctx.rotate(-0.35); // Slanted inwards
        ctx.fillStyle = '#fef08a'; // Glowing yellow sclera
        ctx.beginPath(); ctx.ellipse(0, 0, r*0.25, r*0.12, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000000'; // Slit pupil
        ctx.beginPath(); ctx.ellipse(pOffset1, pOffset2, r*0.04, r*0.1, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        
        animationId = requestAnimationFrame(loop);
    };
    
    animationId = requestAnimationFrame(loop);
    
    return () => {
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('click', clickHandler);
        cancelAnimationFrame(animationId);
    };
}
