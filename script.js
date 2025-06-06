class ScreamRacer {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.gameOverDiv = document.getElementById('gameOver');
        
        this.gameRunning = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        
        this.isDragging = false;
        this.lastMouseX = 0;
        this.dragStartX = 0;
        
        this.player = {
            x: 375,
            y: 450,
            width: 50,
            height: 80,
            speed: 0,
            maxSpeed: 15,
            targetX: 375,
            turnAngle: 0,
            maxTurnAngle: 0.3
        };
        
        this.opponents = [];
        this.roadLines = [];
        this.score = 0;
        this.volume = 0;
        
        this.initRoadLines();
        this.bindEvents();
    }
    
    initRoadLines() {
        for (let i = 0; i < 20; i++) {
            this.roadLines.push({
                x: 395,
                y: i * 40,
                width: 10,
                height: 20
            });
        }
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        
        this.canvas.addEventListener('mousedown', (e) => this.handleDragStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleDragMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleDragEnd());
        this.canvas.addEventListener('mouseleave', () => this.handleDragEnd());
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleDragStart(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleDragMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleDragEnd();
        });
    }
    
    handleDragStart(e) {
        if (!this.gameRunning) return;
        this.isDragging = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastMouseX = e.clientX - rect.left;
        this.dragStartX = this.lastMouseX;
    }
    
    handleDragMove(e) {
        if (!this.isDragging || !this.gameRunning) return;
        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const deltaX = currentX - this.lastMouseX;
        
        this.player.targetX += deltaX * 1.5;
        
        this.player.targetX = Math.max(260, Math.min(540, this.player.targetX));
        
        this.lastMouseX = currentX;
    }
    
    handleDragEnd() {
        this.isDragging = false;
    }
    
    async startGame() {
        try {
            await this.initAudio();
            this.gameRunning = true;
            this.startBtn.style.display = 'none';
            this.gameOverDiv.classList.add('hidden');
            this.gameLoop();
        } catch (error) {
            alert('Microphone access required! Please allow microphone and try again.');
        }
    }
    
    async initAudio() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.analyser = this.audioContext.createAnalyser();
        this.microphone = this.audioContext.createMediaStreamSource(stream);
        
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyser.fftSize = 1024;
        
        this.microphone.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    
    getVolume() {
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        return Math.min(100, (sum / this.dataArray.length) * 2);
    }
    
    update() {
        if (!this.gameRunning) return;
        
        this.volume = this.getVolume();
        this.player.speed = (this.volume / 100) * this.player.maxSpeed;
        
        const moveSpeed = 0.15;
        const oldX = this.player.x;
        this.player.x += (this.player.targetX - this.player.x) * moveSpeed;
        
        const deltaX = this.player.x - oldX;
        this.player.turnAngle += (deltaX * 0.2 - this.player.turnAngle) * 0.3;
        this.player.turnAngle = Math.max(-this.player.maxTurnAngle, 
                                       Math.min(this.player.maxTurnAngle, this.player.turnAngle));
        
        this.roadLines.forEach(line => {
            line.y += 5 + this.player.speed;
            if (line.y > this.canvas.height) {
                line.y = -20;
            }
        });
        
        if (Math.random() < 0.02) {
            this.spawnOpponent();
        }
        
        this.opponents.forEach((opponent, index) => {
            opponent.y += 3 + this.player.speed;
            if (opponent.y > this.canvas.height) {
                this.opponents.splice(index, 1);
                this.score += 10;
            }
        });
        
        this.checkCollisions();
        
        this.score += Math.floor(this.player.speed / 5);
        
        this.updateUI();
    }
    
    spawnOpponent() {
        const lanes = [300, 375, 450];
        this.opponents.push({
            x: lanes[Math.floor(Math.random() * lanes.length)],
            y: -100,
            width: 50,
            height: 80,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });
    }
    
    checkCollisions() {
        this.opponents.forEach(opponent => {
            if (this.player.x < opponent.x + opponent.width &&
                this.player.x + this.player.width > opponent.x &&
                this.player.y < opponent.y + opponent.height &&
                this.player.y + this.player.height > opponent.y) {
                this.gameOver();
            }
        });
    }
    
    drawCar(x, y, width, height, color, turnAngle = 0) {
        this.ctx.save();
        
        if (turnAngle !== 0) {
            this.ctx.translate(x + width/2, y + height/2);
            this.ctx.rotate(turnAngle);
            this.ctx.translate(-width/2, -height/2);
            x = 0;
            y = 0;
        }
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);
        
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(x + 5, y + 10, width - 10, 25);
        
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(x - 3, y + 10, 8, 15);
        this.ctx.fillRect(x + width - 5, y + 10, 8, 15);
        this.ctx.fillRect(x - 3, y + height - 25, 8, 15);
        this.ctx.fillRect(x + width - 5, y + height - 25, 8, 15);
        
        this.ctx.restore();
    }
    
    draw() {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#555';
        this.ctx.fillRect(250, 0, 300, this.canvas.height);
        
        this.ctx.fillStyle = '#fff';
        this.roadLines.forEach(line => {
            this.ctx.fillRect(line.x, line.y, line.width, line.height);
        });
        
        this.drawCar(this.player.x, this.player.y, this.player.width, this.player.height, '#00ff00', this.player.turnAngle);
        
        this.opponents.forEach(opponent => {
            this.drawCar(opponent.x, opponent.y, opponent.width, opponent.height, opponent.color);
        });
        
        this.ctx.fillStyle = '#ff4444';
        this.ctx.fillRect(10, 10, this.volume * 2, 20);
        this.ctx.strokeStyle = '#fff';
        this.ctx.strokeRect(10, 10, 200, 20);
    }
    
    updateUI() {
        document.getElementById('speed').textContent = Math.floor(this.player.speed * 10);
        document.getElementById('score').textContent = this.score;
        document.getElementById('volume').textContent = Math.floor(this.volume);
    }
    
    gameOver() {
        this.gameRunning = false;
        document.getElementById('finalScore').textContent = this.score;
        this.gameOverDiv.classList.remove('hidden');
        this.startBtn.style.display = 'inline-block';
        
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
    
    restartGame() {
        this.player.x = 375;
        this.player.y = 450;
        this.player.speed = 0;
        this.player.targetX = 375;
        this.player.turnAngle = 0;
        this.opponents = [];
        this.score = 0;
        this.volume = 0;
        this.isDragging = false;
        this.initRoadLines();
        this.startGame();
    }
    
    gameLoop() {
        if (this.gameRunning) {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

window.addEventListener('load', () => {
    new ScreamRacer();
});
