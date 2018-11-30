// Infrared signal reception
var wsUri = "ws://localhost:9980";

function testWebSocket()
{
    websocket = new WebSocket(wsUri);
    websocket.onopen = function(evt) { onOpen(evt) };
    websocket.onclose = function(evt) { onClose(evt) };
    websocket.onmessage = function(evt) { onMessage(evt) };
    websocket.onerror = function(evt) { onError(evt) };
}

function onOpen(evt)
{
    writeToScreen("CONNECTED");
    doSend("WebSocket rocks");
}

function onClose(evt)
{
    writeToScreen("DISCONNECTED");
}

function onMessage(evt)
{
    writeToScreen('RESPONSE: ' + evt.data);
    if (evt.data === '1') {
        SHAPE_RENDERER.enter();
    } else if (evt.data === '0') {
        SHAPE_RENDERER.leave();
    }

}

function onError(evt)
{
    writeToScreen('ERROR: ' + evt.data);
}

function doSend(message)
{
    writeToScreen("SENT: " + message);
    websocket.send(message);
}

function writeToScreen(message)
{
    console.log('[@Screen]', message);
}

// Tool
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

// True Start
var S = { // user settings
    TEST : 1, // 0-no test, 1-continuous test, 2-single test

    STABLE_DUR : 3000, // time in MS, how long after input does the text explode.
    END_DUR : 5000, // time in MS, how long after explosion does it start showing default texts
    // below are times in FRAME
    SHRINK_TIME1 :25, // speedup stage
    SHRINK_TIME2 : 15, // the second speedup stage
    SHRINK_MAX_SPEED1 : 15,
    SHRINK_MAX_SPEED2 : 70, // accumulated on speed1
    EXPLODE_TIME1 : 10, // speedup stage
    EXPLODE_TIME2 : 40, // slowdown stage
    EXPLODE_MAX_SPEED : 200,
    MIC_TIME : 40,
    MIC_TIME_RANGE : 480, // time in MS, this + MIC_TIME is the max total time cost for particles to gather around mic.
    SHAPE_ENTER_FRAME : 30, // time cost to reveal the ring
    FRAME_DUR : 16, // how long does a frame cost

    // about center rings
    CENTER_POINT_SIZE : 5, // size of particle in the ring
    SHAPE_Y : 0.88, // ring's position in percentage
    SHAPE_LOOP_TIME : 120, // frames in a loop
    SHAPE_R_MIN : 100, // loop size
    SHAPE_R_MAX : 220,
    SHAPE_A_MIN : 0.2, // alpha
    SHAPE_A_MAX : 0.6,
    SHAPE_LEAVE_TIME : 20, // time in frames, time to fade away
    SHAPE_GEN_TIME : 800,
};

var U = {
    WIDTH: window.innerWidth,
    HEIGHT: window.innerHeight,
    center: {X:0, Y:0},
    init: function () {
        this.center.X = this.WIDTH/2;
        this.center.Y = this.HEIGHT/2;
        this.H_DIAG = Math.sqrt(this.WIDTH * this.WIDTH + this.HEIGHT * this.HEIGHT) / 2;
    }
};

var waitStable = _.debounce(function() {
    if (TEXT_RENDERER.hasFront()) {
        PARTICLE_RENDERER.explode();
    }
}, S.STABLE_DUR);

var waitEnd = _.debounce(function() {
    TEXT_RENDERER.enterDefault();
}, S.END_DUR);

var RENDERER = {
    init :function () {
        this.EXPLODE_TIME = S.EXPLODE_TIME1 + S.EXPLODE_TIME2;

        this.explodeSpeedCurve = function (t) {
            if (t < S.EXPLODE_TIME1) {
                return S.EXPLODE_MAX_SPEED * cubicBezierGenerator(.5, 0, .5, 1)(t/S.EXPLODE_TIME1);
            } else {
                return S.EXPLODE_MAX_SPEED * cubicBezierGenerator(.5, 0, .5, 1)(1 - (t-S.EXPLODE_TIME1)/S.EXPLODE_TIME2);
            }
        };
        
        this.shrinkSpeedCurve = function (t) {
            if (t < S.SHRINK_TIME1) {
                return S.SHRINK_MAX_SPEED1 * cubicBezierGenerator(0, .5, .5, 1)(t/S.SHRINK_TIME1);
            } else if (t - S.SHRINK_TIME1 < S.SHRINK_TIME2) {
                return S.SHRINK_MAX_SPEED1 + S.SHRINK_MAX_SPEED2 * cubicBezierGenerator(.5, 0, 1, .5)((t - S.SHRINK_TIME1)/S.SHRINK_TIME2);
            } else {
                return S.SHRINK_MAX_SPEED1 + S.SHRINK_MAX_SPEED2;
            }
        };

        this.toMicX = function (t) {
            if (t >= S.MIC_TIME)
            return cubicBezierGenerator(0, .6, .6, .9)(t/S.MIC_TIME);
        };

        this.toMicY = function (t) {
            if (t >= S.MIC_TIME) return 1;
            else return cubicBezierGenerator(.15, .6, .8, .5)(t/S.MIC_TIME);
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
    init: function () {
        this.SHAPE_LOOP_COUNT = Math.ceil(S.SHAPE_LOOP_TIME * S.FRAME_DUR / S.SHAPE_GEN_TIME) + 2; // max loop count
        this.canvas = RENDERER.initCanvasById("shapeCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.x = U.center.X;
        this.y = U.HEIGHT*S.SHAPE_Y;
        this.r_step = (S.SHAPE_R_MAX - S.SHAPE_R_MIN) / S.SHAPE_LOOP_TIME;
        this.a_step = (S.SHAPE_A_MAX-S.SHAPE_A_MIN) / S.SHAPE_LOOP_TIME;
        this.rings = Array.apply(null, Array(SHAPE_RENDERER.SHAPE_LOOP_COUNT)).map(function (item, i) {
            return {r:0, a:0};
        });
        this.center = new Image();
        this.center.src = 'images/center.png';
        this.ring = new Image();
        this.ring.src = 'images/ring.png';
        this.current = 0;
        this.state = this.HIDE;
        this.leaving = false;
        this.center_a = 1;
        this.revealCurve = function (t) {
            if (t >= S.SHAPE_ENTER_FRAME) return 1;
            return cubicBezierGenerator(.6, .1, .9, .3)(t/S.SHAPE_ENTER_FRAME);
        };
        this.leaving_a_step = 1 / S.SHAPE_LEAVE_TIME;
    },

    update: function () {
        if (this.leaving) {
            this.center_a -= this.leaving_a_step;
            if (this.center_a <= 0) {
                this.endLeave();
            }
        }
        let ctx = this.ctx;
        RENDERER.clearCtx(ctx);
        ctx.save();
        if (this.state === this.RUN) {
            for(let i = 0; i < SHAPE_RENDERER.SHAPE_LOOP_COUNT; i++) {
                if(this.rings[i]['r'] <= S.SHAPE_R_MIN) {continue;}
                this.rings[i]['r'] -= this.r_step;
                if (this.leaving) {
                    let a = this.rings[i]['a'] - this.leaving_a_step;
                    this.rings[i]['a'] = Math.max(0, a);
                } else this.rings[i]['a'] += this.a_step;
                ctx.globalAlpha = this.rings[i]['a'];
                let r = this.rings[i]['r'];
                this.ctx.drawImage(this.ring, this.x - r/2, this.y - r/2, r, r);
            }
            ctx.globalAlpha = this.center_a;
            ctx.drawImage(this.center, this.x - S.SHAPE_R_MIN/2, this.y - S.SHAPE_R_MIN/2, S.SHAPE_R_MIN, S.SHAPE_R_MIN);
        }
        if (this.state === this.ENTER) {
            ctx.globalAlpha = 1;
            ctx.drawImage(this.center, this.x - S.SHAPE_R_MIN/2, this.y - S.SHAPE_R_MIN/2, S.SHAPE_R_MIN, S.SHAPE_R_MIN);
            ctx.restore();
            this.drawCircle(this.enter_frame);
            this.enter_frame += 1;
            if(this.enter_frame >= S.SHAPE_ENTER_FRAME){
                this.state = this.RUN;
            }
        }
        ctx.restore();
    },

    drawCircle: function (frame) {
        let ctx = this.ctx;
        let r1 = S.SHAPE_ENTER_FRAME * 2 * this.revealCurve(frame);
        ctx.strokeStyle = '#000000'; // C5C0B4
        ctx.lineWidth = S.SHAPE_R_MIN * 2.4 - r1 * 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y - S.SHAPE_R_MIN/2, S.SHAPE_R_MIN * 1.2 , 0 , 2*Math.PI , true); // t * S.SHAPE_R_MIN / S.SHAPE_ENTER_FRAME
        ctx.stroke();
        ctx.closePath();
        // draw small ones
        let a = r1*r1/S.SHAPE_R_MIN;
        let yy = this.y - S.SHAPE_R_MIN/2 + a + 3;
        let b = Math.sqrt(r1*r1 - a*a) - 3;
        ctx.beginPath();
        ctx.arc(this.x - b, yy, S.CENTER_POINT_SIZE , 0 , 2*Math.PI , true);
        ctx.arc(this.x + b, yy, S.CENTER_POINT_SIZE , 0 , 2*Math.PI , true);
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.fill();
        ctx.restore();
    },

    genWave: function () {
        if(this.state !== this.RUN) return;
        this.rings[this.current]['r'] = S.SHAPE_R_MAX;
        this.rings[this.current]['a'] = S.SHAPE_A_MIN;
        this.current += 1;
        if(this.current >= SHAPE_RENDERER.SHAPE_LOOP_COUNT) this.current = 0;
    },

    enter : function () {
        _.each(this.rings, function (ring) {
            ring['r'] = 0;
        });
        PARTICLE_RENDERER.activate();
        setTimeout(function () {
            PARTICLE_RENDERER.actFinish();
            SHAPE_RENDERER.state = SHAPE_RENDERER.ENTER;
            SHAPE_RENDERER.enter_frame = 0;
        }, S.MIC_TIME * S.FRAME_DUR + S.MIC_TIME_RANGE);
        this.center_a = 1;
    },

    leave : function () {
        this.leaving = true;
    },

    endLeave : function () {
        this.state = this.HIDE;
        this.center_a = 0;
        this.leaving = false;
    }
};

var PARTICLE_RENDERER = {
    // user settings
    FLOAT_DIR_STEP: 0.03,
    V : [0.2, 0.6],
    R : [3, 4], // max r is r[0] + r[1]
    A : [0.2, 0.8], // max a is a[0] + a[1]
    CHANGE_DIR_MAX_FRAME : 200,
    BG_PARTICLE_N : 20,
    MIC_PARTICLE_N : 10,
    SHRINK_PARTICLE_N : 300,

    // states
    IDLE : -1,
    APPEAR : 0,
    FLOAT : 1,
    EXPLODE : 2,
    STABLE : 3,
    SHRINK : 4,
    SHRINK_FADEOUT : 5,
    MIC : 6,
    SHRINK_MOVE : 7,

    init: function() {
        this.canvas = RENDERER.initCanvasById("particleCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.particles = Array.apply(null, Array(this.BG_PARTICLE_N)).map(function (item, i) {
            return new Particle('p', 0, 0);
        });
        this.micParticles = Array.apply(null, Array(this.MIC_PARTICLE_N)).map(function (item, i) {
            return new Particle('m', 0, 0);
        });
        this.shrinkParticles = Array.apply(null, Array(this.SHRINK_PARTICLE_N)).map(function (item, i) {
            return new Particle('s', 0, 0);
        });
    },

    updateParticles: function () {
        if (!this.ctx) return;
        RENDERER.clearCtx(this.ctx);
        _.each(this.particles, function (particle) {
            particle.update(PARTICLE_RENDERER.ctx);
        });
        _.each(this.micParticles, function (particle) {
            particle.update(PARTICLE_RENDERER.ctx);
        });
        _.each(this.shrinkParticles, function (particle) {
            particle.update(PARTICLE_RENDERER.ctx);
        });
        _.each(this.explodeParticles, function (particle) {
            particle.update(PARTICLE_RENDERER.ctx);
        });
    },

    getExplodeParticlesFromPixels : function (pixels) {
        this.explodeParticles = _.map(pixels, function (pixel, idx) {
            return new Particle('e', pixel.x, pixel.y);
        });
    },

    explode: function () {
        this.getExplodeParticlesFromPixels(TEXT_RENDERER.pixels);
        _.each(this.particles, function (particle) {
            particle.explode();
        });
        _.each(this.micParticles, function (particle) {
            particle.explode();
        });
        _.each(this.shrinkParticles, function (particle) {
            particle.fadeout();
        });
        _.each(this.explodeParticles, function (particle) {
            particle.explode();
        });
    },

    shrink: function (hwidth, hheight) {
        let dmin = U.H_DIAG;
        let drange = U.H_DIAG;
        _.each(this.shrinkParticles, function (particle) {
            let angle = Math.random() * 2 * Math.PI;
            let dist = dmin + Math.random() * drange;
            particle.x = U.center.X + Math.sin(angle) * dist;
            particle.y = U.center.Y + Math.cos(angle) * dist;
            particle.shrink(U.center.X - hwidth + Math.random() * 2 * hwidth,
                U.center.Y - hheight + 15 + Math.random() * 2 * hheight);
        });
        _.each(this.particles, function (particle) {
            particle.shrink(U.center.X, U.center.Y);
        });
        _.each(this.micParticles, function (particle) {
            particle.shrink(U.center.X, U.center.Y);
        });
    },

    activate: function () {
        _.each(this.micParticles, function (particle) {
            setTimeout(function () {
                particle.activate();
            },Math.random() * S.MIC_TIME_RANGE);
        });
    },

    actFinish: function () {
        _.each(this.micParticles, function (particle) {
            particle.micFinished();
        });
    }
};

var TEXT_RENDERER = {
    // user settings
    SEPARATOR : ' ',
    LINE_LIMIT : 5,
    CHAR_PER_LINE : 8,
    FADEIN_STEP : 0.05,
    FADEOUT_STEP : 0.1,
    MOVE_ALPHA_STEP : 0.005,
    MAX_STEP_Y : 10,
    MIN_STEP_Y : 2,
    MOVE_SPEED_Y: 1,
    MOVE_TIME : 100,  // FRAME
    FONT_SIZE : 78,
    FONT_SIZE_STEP : 0.13,

    texts : [],
    numOfLines : 0,
    shrink_end : 0,
    shrink_lock : false,

    DEFAULTS : ["复杂语言", "八卦能力", "虚构故事", "认知与思考", "交流与想象", "描述与重塑", "讲述历史", "记录当下", "描绘未来", "认知革命"],

    init : function() {
        this.canvas = RENDERER.initCanvasById("textCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.moveSpeedCurve = function (t) {
            return this.MAX_STEP_Y * cubicBezierGenerator(1,0,.7,0)(1-t/this.MOVE_TIME);
        };

        this.default = false;
        this.prev_last_determined = '';
        this.cursor = TEXT_RENDERER.CHAR_PER_LINE;
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
        if (this.texts.length === 0 && this.default === true && SHAPE_RENDERER.state === SHAPE_RENDERER.HIDE)
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

    setText : function (text, greyIdx) {
        this.default = false;
        // if (_.isUndefined(greyIdx)) {
        //     greyIdx = text.length;
        // }
        // let determined = text.slice(0, greyIdx).split(this.SEPARATOR);
        // let undetermined = text.slice(greyIdx, text.length);
        // if (determined[determined.length - 1]==='') determined.pop();
        // let last_determined = determined[determined.length-1];

        // 1. update determined

        // if (last_determined !== this.prev_last_determined && last_determined !== '') {
        //     if (last_determined === '') {
        //         // add new undertermined text
        //     } else {
        //         if (this.cursor < 0) {
        //             // update two lines
        //             if (this.cursor + undetermined.length > TEXT_RENDERER.CHAR_PER_LINE) {
        //                 // add new:
        //                 // undetermined.slice(TEXT_RENDERER.CHAR_PER_LINE - this.cursor, undetermined.length);
        //             }
        //         } else if (this.cursor === 0) {
        //             console.log('something goes wrong');
        //         } else {
        //             // update one line
        //             if (this.cursor + undetermined.length > TEXT_RENDERER.CHAR_PER_LINE) {
        //                 // add new
        //                 // undetermined.slice(TEXT_RENDERER.CHAR_PER_LINE - this.cursor, undetermined.length);
        //             }
        //         }
        //     }
        //     // update new
        // }
        // // update current and prev
        // this.cursor += last_determined.length;
        // if (this.cursor > TEXT_RENDERER.CHAR_PER_LINE) {
        //     // add lines
        // }

        // 2. update undetermined

        let orgTexts = text.split(this.SEPARATOR);
        if (orgTexts.length === 0) return;
        let currentTexts = this.squeezeLines(orgTexts);
        if (currentTexts.length === 0) return;
        if (currentTexts.length === this.numOfLines) { // same length
            for (let i = 1; i <= Math.min(this.texts.length , 2); ++i) { // update last two lines
                this.texts[this.texts.length - i].text = currentTexts[this.numOfLines - i];
                // console.log('update 2', i, currentTexts, this.texts[this.texts.length - i].text);
            }
        } else if (currentTexts.length > this.numOfLines) { // add lines
            // console.log(currentTexts, 'hey');
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
            if (typeof(currentTexts[currentTexts.length - 1]) !== "undefined") {
                TEXT_RENDERER.texts.push(new Textline(currentTexts[currentTexts.length - 1], time));
            } else {
                console.log('udf! at creation');
            }
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
        // if (typeof(lastLine.text) === "undefined") return false;
        if (lastLine.text.length <= 0 || !lastLine.state == lastLine.FRONT) return false;
        this.getTextPixelsFromCtx();
        this.numOfLines = 0;
        _.each(this.texts, function(textline) {
            if (textline.state === textline.FRONT) textline.startFadeOut();
            else textline.explode();
        });
        return true;
    }
};

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
        if (typeof(this.text) === "undefined") {
            return;
        }
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

        if (this.y < 0 || this.fontsize <= 0) {
            this.state = this.DEAD;
        }
        if (this.state !== this.HIDE) {
            this.draw(ctx);
        } else {
            this.delay -= S.FRAME_DUR;
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

function Particle(t, x, y) {
    this.type = t;
    this.direction_dir = 1;
    this.reborn();
    if (t === 'e') {
        this.x = x;
        this.y = y;
        this.alpha = this.a;
        this.state = PARTICLE_RENDERER.STABLE;
        this.velocity += 0.8; // 这样爆炸完之后可以尽快离开
        this.projection *= 2;
        this.projection += 0.08; // 尽量炸到外面
    } else if (t === 'm') {
        return;
    } else {
        this.state = PARTICLE_RENDERER.IDLE;
    }
}

Particle.prototype = {
    reborn: function () {
        this.x = Math.floor(Math.random() * U.WIDTH);
        this.y = Math.floor(Math.random() * U.HEIGHT);
        this.r = Math.floor(PARTICLE_RENDERER.R[0] + Math.random() * PARTICLE_RENDERER.R[1]);
        this.a = PARTICLE_RENDERER.A[0] + Math.random() * PARTICLE_RENDERER.A[1];
        this.alpha = 0;
        this.state = PARTICLE_RENDERER.APPEAR;
        this.direction = Math.random() * 2 * Math.PI;
        this.changeDirection = Math.random() * PARTICLE_RENDERER.CHANGE_DIR_MAX_FRAME;
        this.velocity = PARTICLE_RENDERER.V[0] + Math.random() * PARTICLE_RENDERER.V[1];
        if (this.type === 's') this.projection = 1;
        else this.projection = 0.2 * Math.sin(Math.random() * Math.PI);
        // this.fading = false;
    },

    draw : function (ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r , 0 , 2*Math.PI , true);
        ctx.fillStyle = "rgba(255,255,255,"+this.alpha+")";
        ctx.fill();
        ctx.restore();
    },

    update : function (ctx) {
        if (this.state === PARTICLE_RENDERER.IDLE) {
            if (this.type === 'p') {
                if (Math.random() >= 0.995) {
                    this.reborn();
                }
            } else if (this.type === 'm') {
                if (Math.random() >= 0.99) {
                    this.reborn();
                }
            }
        } else if (this.state === PARTICLE_RENDERER.FLOAT || this.state === PARTICLE_RENDERER.APPEAR) {
            if (this.alpha >= this.a) this.state = PARTICLE_RENDERER.FLOAT;
            else this.alpha += this.a/30;
            this.changeDirection -= 1;
            if (this.changeDirection <= 0) {
                this.changeDirection = Math.random() * PARTICLE_RENDERER.CHANGE_DIR_MAX_FRAME;
                this.direction_dir *= -1;
            }
            this.direction += Math.random() * PARTICLE_RENDERER.FLOAT_DIR_STEP * this.direction_dir;
            this.direction = this.direction % (Math.PI * 2);
            this.x += this.velocity * Math.cos(this.direction);
            this.y += this.velocity * Math.sin(this.direction);
            if (this.type === 'e') { // if explode then die else never die
                this.alpha -= 0.02;
                if (this.alpha <= 0 || this.x > U.WIDTH || this.y > U.HEIGHT || this.x < 0 || this.y < 0) {
                    this.state = PARTICLE_RENDERER.IDLE;
                }
            } else {
                if (this.x >= U.WIDTH || this.y >= U.HEIGHT) {
                    this.x = this.x % U.WIDTH;
                    this.y = this.y % U.HEIGHT;
                }
                if (this.x < 0 || this.y < 0) {
                    this.x += U.WIDTH;
                    this.y += U.HEIGHT;
                    this.x = this.x % U.WIDTH;
                    this.y = this.y % U.HEIGHT;
                }
            }
        } else if (this.state === PARTICLE_RENDERER.EXPLODE) {
            if (this.explode_frame < RENDERER.EXPLODE_TIME) {
                let v = this.velocity;
                this.explode_frame += 1;
                v += RENDERER.explodeSpeedCurve(this.explode_frame) * this.projection;
                this.x += v * Math.cos(this.direction);
                this.y += v * Math.sin(this.direction);
            } else {
                if (this.x > U.WIDTH || this.y > U.HEIGHT || this.x < 0 || this.y < 0) {
                    this.state = PARTICLE_RENDERER.IDLE;
                } else {
                    this.state = PARTICLE_RENDERER.FLOAT;
                }
            }
        } else if (this.state === PARTICLE_RENDERER.SHRINK) {
            if (this.alpha < this.a) this.alpha += this.a/20;
            this.shrink_frame += 1;
            let v = this.velocity;
            v += RENDERER.shrinkSpeedCurve(this.shrink_frame) * this.projection;
            let dy = v * Math.sin(this.direction);
            let dx = v * Math.cos(this.direction);
            this.y += dy;
            this.x += dx;
            if ((dx < 0 && this.x <= this.shrink_dest) || (dx > 0 && this.x >= this.shrink_dest)) {
                this.state = PARTICLE_RENDERER.SHRINK_FADEOUT;
            }
            if (this.shrink_frame >= S.SHRINK_TIME1 + S.SHRINK_TIME2) {
                if (this.type !== 's') {
                    this.state = PARTICLE_RENDERER.FLOAT;
                }
            }
        } else if (this.state === PARTICLE_RENDERER.SHRINK_FADEOUT) {
            if (this.alpha > 0) this.alpha -= 0.15;
            else this.state = this.IDLE;
        } else if (this.state === PARTICLE_RENDERER.MIC) {
            this.mic_frame += 1;
            if (this.r > S.CENTER_POINT_SIZE) this.r -= 0.1;
            if (this.mic_frame <= S.MIC_TIME) {
                this.x = this.toMicStart.x + this.toMic.x * this.mic_frame/S.MIC_TIME;//RENDERER.toMicX(this.mic_frame);
                this.y = this.toMicStart.y + this.toMic.y * RENDERER.toMicY(this.mic_frame);
            }
        }

        if (this.state !== PARTICLE_RENDERER.IDLE) {
            this.draw(ctx);
        }
    },

    explode : function () {
        if (this.type === 's') {
            console.log('shrink explodes');
            return;
        }
        if (this.state === PARTICLE_RENDERER.IDLE || this.state === PARTICLE_RENDERER.MIC) return;
        this.state = PARTICLE_RENDERER.EXPLODE;
        this.direction = Math.atan2(this.y - U.center.Y, this.x - U.center.X);
        this.explode_frame = 0;
    },

    shrink: function (x, y) {
        if (this.state === PARTICLE_RENDERER.IDLE ||
            this.state === PARTICLE_RENDERER.MIC ||
            this.state === PARTICLE_RENDERER.EXPLODE) {
            return;
        }
        if (this.type === 's') {
            this.alpha = 0;
        }
        this.shrink_dest = x;
        this.shrink_frame = 0;
        this.direction = Math.atan2(y - this.y, x - this.x);
        this.state = PARTICLE_RENDERER.SHRINK;
    },

    fadeout: function () {
        this.state = this.SHRINK_FADEOUT;
    },

    activate : function () {
        if (this.y > SHAPE_RENDERER.y || this.y < U.center.Y) return;
        this.state = PARTICLE_RENDERER.MIC;
        this.mic_frame = 0;
        this.toMicStart = {x:this.x,
            y:this.y};
        this.toMic = {x: SHAPE_RENDERER.x - this.x,
            y: SHAPE_RENDERER.y - S.SHAPE_R_MIN/2 + 4 - this.y};
    },

    micFinished : function () {
        if (this.state === PARTICLE_RENDERER.MIC) this.reborn();
    }
};

function animate() {
    PARTICLE_RENDERER.updateParticles();
    TEXT_RENDERER.updateTexts();
    SHAPE_RENDERER.update();
    requestAnimationFrame(animate);
}

function init() {
    testWebSocket();
    U.init();
    RENDERER.init();
    PARTICLE_RENDERER.init();
    TEXT_RENDERER.init();
    SHAPE_RENDERER.init();
    animate();
    waitEnd();
    setInterval(function () {TEXT_RENDERER.enterText();}, 5000);
    setInterval(function () {SHAPE_RENDERER.genWave();}, S.SHAPE_GEN_TIME);
    if (S.TEST > 0) test();
}

function test() {
    if (S.TEST === 1)
        mockContinuousInput();
    else
        mockInput();
}

window.onload = init;

function mockInput(baseTime) {
    SHAPE_RENDERER.enter();
    setTimeout(function () {
        SHAPE_RENDERER.leave();
    }, 8000);

    var baseTime = 2000;
    setTimeout(function() {
        enterText('你好', 4);
    }, baseTime);

    setTimeout(function() {
        enterText('你好，这是', 4);
    }, baseTime + 500);

    setTimeout(function() {
        enterText('你好，这是语言', 4);
    }, baseTime + 1000);
    setTimeout(function() {
        enterText('你好，这是语言爆炸', 4);
    }, baseTime + 1200);
    setTimeout(function() {
        enterText('你好，这是语言爆炸展示', 4);
    }, baseTime + 1400);
    setTimeout(function() {
        enterText('你好，这是语言爆炸展示装置。', 4);
    }, baseTime + 1600);

    // setTimeout(function() {
    //     enterText('马桑德', 4);
    // }, baseTime + 2000);
    //
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
    var seconds = 10;
    setTimeout(function() {
        mockContinuousInput();
    }, seconds * 1000);
}

function enterText(text, greyIdx) {
    TEXT_RENDERER.setText(text, greyIdx);
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
