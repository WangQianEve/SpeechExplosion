function cubicBezierGenerator(p1x, p1y, p2x, p2y) {
    let cubicBezier = simplifiedCubicBezier(p1x, p1y, p2x, p2y);
    return function(t) {
        let results = solveCubicBezier(0, p1x, p2x, 1, t);
        for (let i = 0; i < results.length; i++) {
            let temp = results[i];
            if (temp >= 0 && temp <= 1) {
                return cubicBezier(temp)[1];
            }
        }
        return 0;
    };
}

var U = {
    WIDTH: window.innerWidth,
    HEIGHT: window.innerHeight,
    center: {X:0, Y:0},
    STABLE_DUR : 3000, // MS
    END_DUR : 5000, // MS
    init: function () {
        this.center.X = this.WIDTH/2;
        this.center.Y = this.HEIGHT/3;
        console.log("U ",this.WIDTH, this.HEIGHT);
    }
};

var waitStable = _.debounce(function() {
    if (TEXT_RENDERER.hasFront()) {
        PARTICLE_RENDERER.explode();
    }
}, U.STABLE_DUR);

var waitEnd = _.debounce(function() {
    TEXT_RENDERER.enterDefault();
}, U.END_DUR);

var RENDERER = {

    FRAME_DUR : 16,
    SHRINK_TIME1 :25, // FRAME
    SHRINK_TIME2 : 15, // FRAME
    SHRINK_MAX_SPEED1 : 15, // FRAME
    SHRINK_MAX_SPEED2 : 70, // FRAME
    SPEEDUP_TIME : 10, // FRAME
    SLOWDOWN_TIME : 40, // FRAME
    EXPLODE_MAX_SPEED : 200, // FRAME
    MIC_TIME_MIN : 40,
    MIC_TIME_RANGE : 30,

    init :function () {
        this.EXPLODE_TIME = this.SPEEDUP_TIME + this.SLOWDOWN_TIME;
        this.explodeSpeedCurve = function (t) {
            if (t < this.SPEEDUP_TIME) {
                return this.EXPLODE_MAX_SPEED * cubicBezierGenerator(.5, 0, .5, 1)(t/this.SPEEDUP_TIME);
            } else {
                return this.EXPLODE_MAX_SPEED * cubicBezierGenerator(.5, 0, .5, 1)(1 - (t-this.SPEEDUP_TIME)/this.SLOWDOWN_TIME);
            }
        };
        this.shrinkSpeedCurve = function (t) {
            if (t < this.SHRINK_TIME1) {
                return this.SHRINK_MAX_SPEED1 * cubicBezierGenerator(0, .5, .5, 1)(t/this.SHRINK_TIME1);
            } else if (t - this.SHRINK_TIME1 < this.SHRINK_TIME2) {
                // return 0;
                return this.SHRINK_MAX_SPEED1 + this.SHRINK_MAX_SPEED2 * cubicBezierGenerator(.5, 0, 1, .5)((t - this.SHRINK_TIME1)/this.SHRINK_TIME2);
            } else {
                // return 0;
                return this.SHRINK_MAX_SPEED1 + this.SHRINK_MAX_SPEED2;
            }
        };

        this.toMicX = function (t) {
            if (t >= this.MIC_TIME_MIN) return 1;
            return cubicBezierGenerator(0, .6, .6, .9)(t/this.MIC_TIME_MIN);
        };

        this.toMicY = function (t) {
            if (t >= this.MIC_TIME_MIN) return 1;
            return cubicBezierGenerator(.5, .5, .5, .5)(t/this.MIC_TIME_MIN);
        };
    },

    initCanvasById: function (id) {
        let _canvas = document.getElementById(id);
        _canvas.width = U.WIDTH;
        _canvas.height = U.HEIGHT;
        return _canvas;
    },

    clearCtx: function (ctx) {
        ctx.clearRect(0, 0, U.WIDTH, U.HEIGHT);
    },
};

var SHAPE_RENDERER = {
    HIDE : 0,
    ENTER : 1,
    RUN : 2,
    LEAVE : 3,
    ENTER_FRAME : 30,
    init: function () {
        this.canvas = RENDERER.initCanvasById("shapeCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.x = U.center.X;
        this.y = U.HEIGHT*0.8;
        this.N = 90; // frames in a loop
        this.r_min = 60;
        this.r_max = 180;
        this.r_step = (this.r_max - this.r_min) / this.N;
        this.a_min = 0;
        this.a_max = 0.3;
        this.a_step = (this.a_max-this.a_min) / this.N;

        this.MAX = 4;
        this.rings = Array.apply(null, Array(this.MAX)).map(function (item, i) {
            return {r:0, a:0};
        });
        this.center = new Image();
        this.center.src = 'images/center.png';
        this.ring = new Image();
        this.ring.src = 'images/ring.png';
        // this.lights = Array.apply(null, Array(this.ENTER_FRAME)).map(function (item, i) {
        //     let img = new Image();
        //     img.src = 'images/reveal/d'+(i+1)+'.png';
        //     return img;
        // });
        this.current = 0;
        this.state = this.HIDE;
        this.leaving = false;
        this.center_a = 1;
    },

    update: function () {
        let ctx = this.ctx;
        RENDERER.clearCtx(ctx);
        ctx.save();
        if (this.state === this.RUN) {
            for(let i = 0; i < this.MAX; i++) {
                if(this.rings[i]['r'] <= this.r_min) {continue;}
                this.rings[i]['r'] -= this.r_step;
                if (this.leaving) {
                    let a = this.rings[i]['a'] - 0.02; // 20 frames from 0.3 to 0
                    this.rings[i]['a'] = Math.max(0, a);
                } else this.rings[i]['a'] += this.a_step;
                ctx.globalAlpha = this.rings[i]['a'];
                let r = this.rings[i]['r'];
                this.ctx.drawImage(this.ring, this.x - r/2, this.y - r/2, r, r);
            }
            if (this.leaving) this.center_a -= 0.05; // 300ms
            ctx.globalAlpha = this.center_a;
            this.ctx.drawImage(this.center, this.x - this.r_min/2, this.y - this.r_min/2, this.r_min, this.r_min);
        }
        if (this.state === this.ENTER) {
            // ctx.globalAlpha = 0.5;
            ctx.globalAlpha = 1;
            ctx.drawImage(this.center, this.x - this.r_min/2, this.y - this.r_min/2, this.r_min, this.r_min);
            ctx.restore();
            this.drawCircle(this.enter_frame);
            this.enter_frame += 1;
            if(this.enter_frame >= this.ENTER_FRAME){
                this.state = this.RUN; 
            }
        }
        ctx.restore();
    },

    drawCircle: function (t) {
        let ctx = this.ctx;
        ctx.strokeStyle = '#C5C0B4'; // C5C0B4
        t = Math.max(t, 2);
        ctx.lineWidth = this.r_min * 2.4 - t * 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.r_min/2, this.r_min * 1.2 , 0 , 2*Math.PI , true); // t * this.r_min / this.ENTER_FRAME
        ctx.stroke();
        ctx.closePath();
    },

    genWave: function () {
        // console.log("ds");
        if(this.state !== this.RUN) return;
        this.rings[this.current]['r'] = this.r_max;
        this.rings[this.current]['a'] = this.a_min;
        this.current += 1;
        if(this.current >= this.MAX) this.current = 0;
    },

    enter : function () {
        _.each(this.rings, function (ring) {
            ring['r'] = 0;
        });
        PARTICLE_RENDERER.activate();
        setTimeout(function () {
            SHAPE_RENDERER.state = SHAPE_RENDERER.ENTER;
            SHAPE_RENDERER.enter_frame = 0;
        },RENDERER.MIC_TIME_MIN * RENDERER.FRAME_DUR);
        this.leaving = false;
        this.center_a = 1;
        // console.log('enter', this.state);
    },
    
    leave : function () {
        this.leaving = true;
        setTimeout(function () {SHAPE_RENDERER.state = SHAPE_RENDERER.LEAVE;}, 500);
    }
};

var PARTICLE_RENDERER = {
    MAX_NUM : 50,
    SHRINK_NUM : 1000,
    MIC_NUM : 30,

    init: function() {
        this.canvas = RENDERER.initCanvasById("particleCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.particles = Array.apply(null, Array(this.MAX_NUM)).map(function (item, i) {
            return new Particle(i, true, 0, 0);
        });
        this.micParticles = Array.apply(null, Array(this.MIC_NUM)).map(function (item, i) {
            return new Particle(-2, true, 0, 0);
        });
        this.shrinkParticles = Array.apply(null, Array(this.SHRINK_NUM)).map(function (item, i) {
            return new Particle(i, true, 0, 0);
        })
    },

    updateParticles: function () {
        if (!this.ctx) return;
        RENDERER.clearCtx(this.ctx);
        // _.each(this.particles, function (particle) {
        //     particle.update(PARTICLE_RENDERER.ctx);
        // });
        _.each(this.explodeParticles, function (particle) {
            particle.update(PARTICLE_RENDERER.ctx);
        });
        _.each(this.shrinkParticles, function (particle) {
            particle.update(PARTICLE_RENDERER.ctx);
        });
        // console.log('mic particles');
        _.each(this.micParticles, function (particle) {
            particle.update(PARTICLE_RENDERER.ctx);
            // console.log(particle.state);
        });
    },

    getExplodeParticlesFromPixels : function (pixels) {
        this.explodeParticles = _.map(pixels, function (pixel, idx) {
            return new Particle(-1, false, pixel.x, pixel.y);
        });
    },

    explode: function () {
        // console.log("particle exploding");
        this.getExplodeParticlesFromPixels(TEXT_RENDERER.pixels);
        // _.each(this.particles, function (particle) {
        //     particle.explode();
        // });
        _.each(this.shrinkParticles, function (particle) {
            particle.fadeout();
        });
        _.each(this.explodeParticles, function (particle) {
            particle.explode();
        });
        _.each(this.micParticles, function (particle) {
            particle.explode();
        });
    },

    shrink: function (hwidth, hheight) {
        // console.log('start shrinking',this.shrinkParticles.length);
        let w_margin = U.WIDTH;
        let h_margin = U.HEIGHT;
        // _.each(this.particles, function (particle) {
        //     particle.shrink(U.center.X - hwidth + Math.random() * 2 * hwidth,
        //         U.center.Y - hheight + Math.random() * 2 * hheight);
        // });
        _.each(this.shrinkParticles, function (particle) {
            let x_ = 1;
            let y_ = 1;
            if (Math.random() >= 0.5) x_ = -1;
            if (Math.random() >= 0.5) y_ = -1;
            particle.x = U.center.X + x_ * ( Math.random() * w_margin );
            particle.y = U.center.Y + y_ * ( Math.random() * h_margin);
            particle.shrink(U.center.X - hwidth + Math.random() * 2 * hwidth,
                            U.center.Y - hheight + 15 + Math.random() * 2 * hheight);
        });
    },

    activate: function () {
        _.each(this.micParticles, function (particle) {
            setTimeout(function () {
                particle.activate();
            },Math.random() * RENDERER.MIC_TIME_RANGE * RENDERER.FRAME_DUR);
        });
    }
};

var TEXT_RENDERER = {
    SEPARATOR : ' ',
    LINE_LIMIT : 5,
    texts : [],
    numOfLines : 0,
    CHAR_PER_LINE : 8,
    FADEIN_STEP : 0.05,
    FADEOUT_STEP : 0.1,
    MOVE_ALPHA_STEP : 0.005,

    MAX_STEP_Y : 10,
    MIN_STEP_Y : 2,
    MOVE_SPEED_Y: 1,

    MOVE_TIME : 100,  // FRAME

    FONT_SIZE : 50,
    FONT_SIZE_STEP : 0.15,

    shrink_end : 0,
    shrink_lock : false,

    DEFAULTS : ["复杂语言", "八卦能力", "虚构故事", "认知与思考", "交流与想象", "描述与重塑", "讲述历史", "记录当下", "描绘未来", "认知革命"],

    init : function() {
        this.canvas = RENDERER.initCanvasById("textCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.moveSpeedCurve = function (t) {
            return this.MAX_STEP_Y * cubicBezierGenerator(1,0,.7,0)(1-t/this.MOVE_TIME);
        };

        this.default = true;
        // this.enterText();
    },

    removeFirst : function() {
        if (this.texts.length === 0) {
            console.log("[ERROR] trying to remove from empty text array");
            return;
        }
        this.texts = this.texts.slice(1,this.texts.length);
    },

    squeezeLines : function(orgCurrentTexts) {
        let currentTexts = [];
        for (let i = 0 ; i < orgCurrentTexts.length; i++) {
            let curText = orgCurrentTexts[i];
            if (i !== 0 && currentTexts[currentTexts.length-1].length + curText.length <= this.CHAR_PER_LINE) { // merge
                currentTexts[currentTexts.length-1] += curText;
            } else {
                let idx = 0;
                while (idx < curText.length) {
                    currentTexts.push(curText.substring(idx, Math.min(idx + this.CHAR_PER_LINE, curText.length)));
                    idx += this.CHAR_PER_LINE;
                }
            }
        }
        return currentTexts;
    },

    enterDefault : function () {
        this.default = true;
    },

    enterText : function () {
        if (this.texts.length === 0 && this.default === true)
            enterText(this.DEFAULTS[Math.floor(Math.random() * (this.DEFAULTS.length - 0.01))]);
    },

    releaseShrinkLock : function () {
        this.shrink_lock = false;
    },

    shrinkLock: function() {
        this.shrink_end = new Date().getTime() + 450;
        this.shrink_lock = true;
    },

    checkFirstLines: function(text) {
        for (let i = 0; i < this.texts.length; ++ i) {
            let line = this.texts[i];
            if (line.state === line.FRONT || line.state === line.APPEAR) {
                if (line.text !== text)
                    line.startMoving((Math.random() - 0.5) * U.WIDTH / (U.HEIGHT / 2));
            }
        }
    },

    setText : function (text) {
        this.default = false;
        let orgTexts = text.split(this.SEPARATOR);
        if (orgTexts.length === 0) return;
        let currentTexts = this.squeezeLines(orgTexts);
        if (currentTexts.length === this.numOfLines) { // same length
            for (let i = 1; i <= Math.min(this.texts.length , 2); ++i) { // update last two lines
                this.texts[this.texts.length - i].text = currentTexts[this.numOfLines - i];
                console.log('update 2',this.texts[this.texts.length - i].text);
            }
        } else if (currentTexts.length > this.numOfLines) { // add lines
            if (currentTexts.length - 1 === this.numOfLines) { // add one line
                if ( this.texts.length > 0 ) { // update one
                    this.texts[this.texts.length - 1].text = currentTexts[currentTexts.length - 2];
                    // console.log('update 1',this.texts[this.texts.length - 1].text);
                }
            }
            let time = 0;
            if (this.numOfLines === 0) { // shrink
                let length = currentTexts[currentTexts.length - 1].length;
                PARTICLE_RENDERER.shrink((TEXT_RENDERER.FONT_SIZE - 20 ) * length / 2, (TEXT_RENDERER.FONT_SIZE - 20) / 2);
                this.shrinkLock();
                setTimeout(function () {
                    TEXT_RENDERER.releaseShrinkLock();
                }, 450);
                time = 450;
            } else {
                if (this.shrink_lock === true) {
                    time = Math.min(this.shrink_end - new Date().getTime(), 450);
                }
            }
            TEXT_RENDERER.texts.push(new Textline(currentTexts[currentTexts.length - 1], time));
        }
        this.numOfLines = currentTexts.length;
    },

    //从ctx获取文字所占的像素点
    getTextPixelsFromCtx : function (interval) {
        interval = interval || 3;
        let imageData = this.ctx.getImageData(0, 0, U.WIDTH, U.HEIGHT);
        let points = [];
        for (let x = 0; x < imageData.width; x += 1) {
            for (let y = 0; y < imageData.height; y += 1) {
                let i = (y * imageData.width + x) * 4;
                if (imageData.data[i + 3] > 128) {
                    if (x % interval === 0 && y % interval === 0) { //取一定的间隔
                        points.push({x: x, y: y});
                    }
                }
            }
        }
        this.pixels = points;
    },

    updateTexts : function () {
        if (!this.ctx) return;
        RENDERER.clearCtx(this.ctx);
        _.each(this.texts, function (line) {
            line.update(TEXT_RENDERER.ctx);
        });
    },

    hasFront: function () {
        let ret = false;
        if (this.texts.length <= 0) return false;
        let lastLine = this.texts[this.texts.length - 1];
        if (lastLine.text.length <= 0 || !lastLine.state == lastLine.FRONT) return false;
        this.getTextPixelsFromCtx();
        this.numOfLines = 0;
        _.each(this.texts, function(textline) {
            if (textline.state === textline.FRONT) textline.startFadeOut();
            else textline.explode();
        });
        return true;
    }
}

function Textline(text, delay) {
    // console.log('new Textline', text, delay);
    this.x = U.center.X;
    this.y = U.center.Y;
    this.alpha = 0;
    this.fontsize = TEXT_RENDERER.FONT_SIZE;
    this.text = text;
    this.state = this.HIDE;
    this.delay = delay;
}

Textline.prototype = {
    DEAD : 0,
    APPEAR : 1,
    FRONT : 2,
    SHAKE : 3,
    FADEOUT : 4,
    MOVE : 5,
    FLOAT : 6,
    EXPLODE : 7,
    HIDE : 8,

    draw : function (ctx) {
        ctx.fillStyle = "rgba(255,255,255,"+this.alpha+")";
        ctx.font = this.fontsize + "px HYWenHei";
        var endY = this.y + 0.5 * this.fontsize;
        var endX = this.x - this.text.length * this.fontsize / 2;
        for (var idx = 0; idx < this.text.length; idx++) {
            ctx.fillText( this.text[idx], endX, endY);
            endX += this.fontsize;
        }
    },

    update : function (ctx) {
        if (this.state == this.DEAD) {
            TEXT_RENDERER.removeFirst();
            return;
        } else if (this.state == this.APPEAR) {
            if (this.alpha < 1) {
                this.alpha += TEXT_RENDERER.FADEIN_STEP;
                if (this.alpha > 0.4 && this.alpha < 0.6)
                    this.fontsize += 0.5;
            } else this.state = this.FRONT;
        } else if (this.state == this.FADEOUT) {
            if (this.alpha > 0) this.alpha -= TEXT_RENDERER.FADEOUT_STEP;
            else this.state = this.DEAD;
        } else if (this.state == this.MOVE || this.state == this.EXPLODE) {
            let vy = TEXT_RENDERER.MIN_STEP_Y;
            if (this.state === this.EXPLODE) {
                if (this.explode_frame < RENDERER.EXPLODE_TIME) {
                    this.explode_frame += 1;
                    vy += RENDERER.explodeSpeedCurve(this.explode_frame);
                } else {
                    this.state = this.MOVE;
                    this.move_frame = TEXT_RENDERER.MOVE_TIME;
                }
            } else {
                if (this.move_frame < TEXT_RENDERER.MOVE_TIME) {
                    this.move_frame += 1;
                    vy += TEXT_RENDERER.moveSpeedCurve(this.move_frame);
                }
            }
            vy = vy * TEXT_RENDERER.MOVE_SPEED_Y;
            this.y -= vy;
            this.x += vy * this.move_dist ;
            if (this.alpha >0) this.alpha -= TEXT_RENDERER.MOVE_ALPHA_STEP;
            if (this.fontsize >0) this.fontsize -= vy * TEXT_RENDERER.FONT_SIZE_STEP;
        }

        if (this.y < 0) {
            this.state = this.DEAD;
        }
        if (this.state !== this.HIDE) {
            this.draw(ctx);
        } else {
            this.delay -= RENDERER.FRAME_DUR;
            if (this.delay <= 0) {
                this.state = this.APPEAR;
                TEXT_RENDERER.checkFirstLines(this.text);
            }
        }
    },

    startMoving : function (dist) {
        this.state = this.MOVE;
        this.move_frame = 0;
        this.alpha = 1;
        this.move_dist = dist;
    },

    startFadeOut: function () {
        this.state = this.FADEOUT;
    },

    explode: function () {
        this.state = this.EXPLODE;
        this.explode_frame = 0;
    }
};

function Particle(i, bg, x, y) {
    this.id = i;
    this.reborn();
    if (i === -2) {
        return;
    }
    if (bg) this.state = this.IDLE;
    else {
        this.x = x;
        this.y = y;
        this.alpha = this.a;
        this.state = this.STABLE;
        this.velocity += 0.8;
        this.projection *= 2;
        this.projection += 0.08;
    }
}

Particle.prototype = {
    IDLE : -1,
    APPEAR : 0,
    FLOAT : 1,
    EXPLODE : 2,
    STABLE : 3,
    SHRINK : 4,
    SHRINK_FADEOUT : 5,
    MIC : 6,
    FLOAT_DIR_STEP: 0.07,
    V : [0.2, 1.0],
    R : [3, 4],

    reborn: function () {
        this.x = Math.floor(Math.random() * U.WIDTH);
        this.y = Math.floor(Math.random() * U.HEIGHT);
        this.r = Math.floor(this.R[0] + Math.random() * this.R[1]);
        this.a = Math.random();
        this.alpha = 0;
        this.state = this.APPEAR;
        this.direction = Math.random() * 2 * Math.PI;
        this.velocity = this.V[0] + Math.random() * this.V[1];
        this.projection = 0.2 * Math.sin(Math.random() * Math.PI);
    },

    draw : function (ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r , 0 , 2*Math.PI , true);
        ctx.fillStyle = "rgba(255,255,255,"+this.alpha+")";
        ctx.fill();
        ctx.restore();
    },

    reflect : function () {
        if (this.x > U.WIDTH) {
            this.x = 0;
        } else if (this.x < 0) {
            this.x = U.WIDTH;
        }

        if (this.y > U.HEIGHT) {
            this.y = 0;
        } else if (this.y < 0) {
            this.y = U.HEIGHT;
        }
    },

    update : function (ctx) {
        if (this.state === this.IDLE) {
            if (this.id === -1) return;
            if (Math.random() > 0.98) {
                this.reborn();
            }
        } else if (this.state === this.APPEAR) {
            if (this.alpha >= this.a) this.state = this.FLOAT;
            else this.alpha += this.a/8;
        } else if (this.state === this.FLOAT) {
            // only update direction
            if (this.id >= 0 || this.id === -2) {
                this.direction += (Math.random() - 0.5) * this.FLOAT_DIR_STEP;
                this.direction = this.direction % (Math.PI * 2);
            } else {
                if (this.x > U.WIDTH || this.y > U.HEIGHT || this.x < 0 || this.y < 0) {
                    this.state = this.IDLE;
                }
            }
            this.x += this.velocity * Math.cos(this.direction);
            this.y += this.velocity * Math.sin(this.direction);
            if (this.id >= 0 || this.id === -2) {
                this.x = this.x % U.WIDTH;
                this.y = this.y % U.HEIGHT;
            }
        } else if (this.state === this.EXPLODE) {
            if (this.explode_frame < RENDERER.EXPLODE_TIME) {
                let v = this.velocity;
                this.explode_frame += 1;
                v += RENDERER.explodeSpeedCurve(this.explode_frame) * this.projection;
                this.x += v * Math.cos(this.direction);
                this.y += v * Math.sin(this.direction);
            } else {
                this.state = this.FLOAT;
                if (this.x > U.WIDTH || this.y > U.HEIGHT || this.x < 0 || this.y < 0) {
                    if (this.id === -2) {
                        this.reflect();
                    } else {
                        this.state = this.IDLE;
                    }
                }
            }
        } else if (this.state === this.SHRINK) {
            if (this.alpha < this.a) this.alpha += this.a/20;
            this.shrink_frame += 1;
            let v = 0; // this.velocity;
            v += RENDERER.shrinkSpeedCurve(this.shrink_frame);// * this.projection;
            let dy = v * Math.sin(this.direction);
            let dx = v * Math.cos(this.direction);
            this.y += dy;
            this.x += dx;
            if ((dx < 0 && this.x <= this.shrink_dest) || (dx > 0 && this.x >= this.shrink_dest)) {
                this.state = this.SHRINK_FADEOUT;
            }
        } else if (this.state === this.SHRINK_FADEOUT) {
            if (this.alpha > 0) this.alpha -= 0.15;
        } else if (this.state === this.MIC) {
            this.mic_frame += 1;
            if (this.r > 3) this.r -= 0.1;

            if (this.mic_frame > this.mic_time) {
                this.reborn();
            }

            if (this.mic_frame <= this.mic_time) {
                this.x = this.toMicStart.x + this.toMic.x * RENDERER.toMicX(this.mic_frame);
                this.y = this.toMicStart.y + this.toMic.y * RENDERER.toMicY(this.mic_frame);
            }
        }
        if (this.state !== this.IDLE) {
            this.draw(ctx);
        }
    },
    
    explode : function () {
        if (this.state === this.IDLE || this.state === this.MIC) return;
        this.state = this.EXPLODE;
        if (this.id > 0) this.direction = Math.atan2(this.y - U.HEIGHT/2, this.x - U.WIDTH/2);
        this.explode_frame = 0;
    },
    
    shrink: function (x, y) {
        if (this.state === this.EXPLODE || this.state === this.SHRINK) return;
        this.alpha = 0;
        this.shrink_dest = x;
        this.shrink_frame = 0;
        this.direction = Math.atan2(y - this.y, x - this.x);
        this.state = this.SHRINK;
    },
    
    fadeout: function () {
        this.state = this.SHRINK_FADEOUT;
    },
    
    activate : function () {
        this.state = this.MIC;
        this.mic_time = RENDERER.MIC_TIME_MIN; // + Math.floor(Math.random() * RENDERER.MIC_TIME_RANGE);
        this.mic_frame = 0;
        this.toMicStart = {x:this.x,
                           y:this.y};
        this.toMic = {x: SHAPE_RENDERER.x - this.x,
                      y: SHAPE_RENDERER.y - SHAPE_RENDERER.r_min/2 + 4 - this.y};
    }
};

function print() {
    console.log(Date.now());
}

function init() {
    U.init();
    RENDERER.init();
    PARTICLE_RENDERER.init();
    TEXT_RENDERER.init();
    SHAPE_RENDERER.init();
    setInterval(function () {PARTICLE_RENDERER.updateParticles();TEXT_RENDERER.updateTexts();}, RENDERER.FRAME_DUR);
    setInterval(function () {TEXT_RENDERER.enterText();}, 5000);
    setInterval(function () {SHAPE_RENDERER.update();}, 33);
    setInterval(function () {SHAPE_RENDERER.genWave();}, 1000);
    test();
}

function test() {
    mockContinuousInput();
    // mockInput(300);
}

window.onload = init;

function mockInput(baseTime) {
    SHAPE_RENDERER.enter();
    setTimeout(function () {
        SHAPE_RENDERER.leave();
    }, 4000);

    // var baseTime = baseTime || 0;
    // setTimeout(function() {
    //     enterText('我要数数1，', 4);
    // }, baseTime);
    //
    // setTimeout(function() {
    //     enterText('我要给你数数1，我要数数2，', 4);
    // }, baseTime);
    //
    // setTimeout(function() {
    //     enterText('我要给你数数1，我要数数2，我要数数3，我要数数4', 4);
    // }, baseTime + 200);

    // setTimeout(function() {
    //     enterText('马桑德'+TEXT_RENDERER.SEPARATOR+'不可以这样'+TEXT_RENDERER.SEPARATOR+'你好依图欢迎你你好我欢迎你啦啦啦', 4);
    // }, baseTime + 1200);
    //
    // setTimeout(function() {
    //     enterText('马桑德'+TEXT_RENDERER.SEPARATOR+'不可以这样'+TEXT_RENDERER.SEPARATOR+'你好依图欢迎你你好我欢迎', 4);
    // }, baseTime + 1500);
}

function mockContinuousInput() {
    mockInput();
    var seconds = 5;
    setTimeout(function() {
        mockContinuousInput();
    }, seconds * 1000);
}

function enterText(text, greyIdx) {
    // console.log("out enterText",text);
    TEXT_RENDERER.setText(text);
    waitStable();
    waitEnd();
}

var receiveText = (function() {
    var textLastTime = "";
    var greyIdxLastTime = 0;

    return function(text, greyIdx) {
        if (text !== textLastTime || greyIdx !== greyIdxLastTime) {
            enterText(text, greyIdx);
        }
    }
})();
