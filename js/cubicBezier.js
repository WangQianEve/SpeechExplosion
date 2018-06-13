/**
 * Created by rbzhou on 2/6/18.
 */

function derivativeOfCubicBezier(p0, p1, p2, p3) {
    var a = 3 * (p1 - p0);
    var b = 6 * (p2 - p1);
    var c = 3 * (p3 - p2);
    return function(t) {
        return a * t * (1 - t) * (1 - t) + b * (1 - t) * t + c * t * t;
    }
}


function solveQuadraticEquation(a, b, c) {

    var discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return [];

    } else {
        return [
            (-b + Math.sqrt(discriminant)) / (2 * a),
            (-b - Math.sqrt(discriminant)) / (2 * a)
        ];
    }
}

function solveCubicEquation(a, b, c, d) {

    if (!a) return solveQuadraticEquation(b, c, d);

    b /= a;
    c /= a;
    d /= a;

    var p = (3 * c - b * b) / 3;
    var q = (2 * b * b * b - 9 * b * c + 27 * d) / 27;

    if (p === 0) {
        return [ Math.pow(-q, 1 / 3) ];

    } else if (q === 0) {
        return [Math.sqrt(-p), -Math.sqrt(-p)];

    } else {

        var discriminant = Math.pow(q / 2, 2) + Math.pow(p / 3, 3);

        if (discriminant === 0) {
            return [Math.pow(q / 2, 1 / 3) - b / 3];

        } else if (discriminant > 0) {
            return [Math.pow(-(q / 2) + Math.sqrt(discriminant), 1 / 3) - Math.pow((q / 2) + Math.sqrt(discriminant), 1 / 3) - b / 3];

        } else {

            var r = Math.sqrt( Math.pow(-(p/3), 3) );
            var phi = Math.acos(-(q / (2 * Math.sqrt(Math.pow(-(p / 3), 3)))));

            var s = 2 * Math.pow(r, 1/3);

            return [
                s * Math.cos(phi / 3) - b / 3,
                s * Math.cos((phi + 2 * Math.PI) / 3) - b / 3,
                s * Math.cos((phi + 4 * Math.PI) / 3) - b / 3
            ];

        }

    }
}

function roundToDecimal(num, dec) {
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}

function solveCubicBezier(p0, p1, p2, p3, x) {

    p0 -= x;
    p1 -= x;
    p2 -= x;
    p3 -= x;

    var a = p3 - 3 * p2 + 3 * p1 - p0;
    var b = 3 * p2 - 6 * p1 + 3 * p0;
    var c = 3 * p1 - 3 * p0;
    var d = p0;

    var roots = solveCubicEquation(
        p3 - 3 * p2 + 3 * p1 - p0,
        3 * p2 - 6 * p1 + 3 * p0,
        3 * p1 - 3 * p0,
        p0
    );

    var result = [];
    var root;
    for (var i = 0; i < roots.length; i++) {
        root = roundToDecimal(roots[i], 15);
        if (root >= 0 && root <= 1) result.push(root);
    }

    return result; 
}

function cubicBezierInterceptor(p0, p1, p2, p3) {
    if(arguments.length === 3) {
        p3 = p0[3];
        p2 = p0[2];
        p1 = p0[1];
        p0 = p0[0];
    }
    var cx = 3 * (p1[0] - p0[0]);
    var bx = 3 * (p2[0] - p1[0]) - cx;
    var ax = p3[0] - p0[0] - cx - bx;

    var cy = 3 * (p1[1] - p0[1]);
    var by = 3 * (p2[1] - p1[1]) - cy;
    var ay = p3[1] - p0[1] - cy - by;

    return function(t) {
        var tSquare = t * t;
        var tCubic = tSquare * t;

        var x = ax * tCubic + bx * tSquare + cx * t + p0[0];
        var y = ay * tCubic + by * tSquare + cy * t + p0[1]; 
        
        return [x, y];
    }
}

function simplifiedCubicBezier(p1x, p1y, p2x, p2y) {
    return cubicBezierInterceptor([0,0], [p1x, p1y], [p2x, p2y], [1, 1]);
}



