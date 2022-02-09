var displayCanvas = document.getElementById("displayCanvas");
var context = displayCanvas.getContext("2d");
var displayWidth = displayCanvas.width;
var displayHeight = displayCanvas.height;

var cellList;
var gridWidth;
var gridHeight;
var cellHeight;
var cellWidth;
var timer;

///////////////////////
//for speed, defining variables used in update function as global variables.
var i;
var cell;
var rAve, gAve, bAve;
var rVelAve, gVelAve, bVelAve;
var ease;
var rv, gv, bv, mag;
var rAccel, gAccel, bAccel;
var rSep, gSep, bSep;
var velMax;
var minDist;
var minDistSquare;
var dr, dg, db;
var neighbor;
var neighborPointer;
var f;
var sepMagRecip;
var sepNormMag;

///////////////////////
var last = performance.now() / 1000;
var fpsThreshold = 0;

var wallpaperSettings = {
    fps: 0
};

// track bounding user setting
var bounding = 25;

function run() {
    // Keep animating
    window.requestAnimationFrame(run);

    // Figure out how much time has passed since the last animation
    var now = performance.now() / 1000;
    var dt = Math.min(now - last, 1);
    last = now;

    // If there is an FPS limit, abort updating the animation if we have reached the desired FPS
    if (wallpaperSettings.fps > 0) {
        fpsThreshold += dt;
        if (fpsThreshold < 1.0 / wallpaperSettings.fps) {
            return;
        }
        fpsThreshold -= 1.0 / wallpaperSettings.fps;
    }

    // FPS limit not reached, draw animation!

    /** Place your wallpaper animation logic here! **/
    onTimer()
}

window.onload = function () {
    // init wallpaper
    init();

    // start FPS limiter wrapper, to call animation function
    window.requestAnimationFrame(run);
};

function init() {
    /*
    gridWidth = 60;
    gridHeight = 36;
    */
    gridWidth = 120;
    gridHeight = 72;
    
    cellWidth = displayWidth / gridWidth;
    cellHeight = displayHeight / gridHeight;

    ease = 0.67;
    velMax = 255;
    minDist = 8;
    minDistSquare = minDist * minDist;
    sepNormMag = 4;

    createCells();

    displayCanvas.addEventListener("click", resetCellData, false);
}

window.wallpaperPropertyListener = {
    applyGeneralProperties: function (properties) {
        if (properties.fps) {
            wallpaperSettings.fps = properties.fps;
        }
    },
    applyUserProperties: function (properties) {
        if (properties.customimage) {
            if (properties.customimage.value) {
                // Read the file
                var customImageFile = 'file:///' + properties.customimage.value;
                loadUserImage(customImageFile);
            }
        }

        if (properties.bounding) {
            bounding = properties.bounding.value;
        }
    },
};

function loadUserImage(customImageFile) {
    var sourceImageObj = new Image();
    sourceImageObj.onload = function () {
        
        var sourcecanvas = document.createElement("canvas");
        sourcecanvas.width = gridWidth;
        sourcecanvas.height = gridHeight;

        var sourcectx = sourcecanvas.getContext("2d");

        // scale image by drawing to sized hidden canvas
        sourcectx.drawImage(this, 0, 0, gridWidth, gridHeight);

        // preliminary paint of image to canvas, painting scaled image at full display width/height
        let painting = new Image();
        painting.src = sourcecanvas.toDataURL()
        context.drawImage(painting, 0, 0, displayWidth, displayHeight);

        // read pixel data from hidden canvas
        cell = cellList.first;
        while (cell != null) {
            // get pixel data
            let data = sourcectx.getImageData(cell.i, cell.j, 1, 1).data;
            
            // write appropriate cell rgb values
            cell.r_ = data[0];
            cell.g_ = data[1];
            cell.b_ = data[2];

            console.log(data);

            cell = cell.next;
        }

        // reset animation to utilise new initial cell values
        resetCellData();
    }
    sourceImageObj.src = customImageFile;
}

function createCells() {
    var i, j;
    var r, g, b;
    var cellArray = [];
    cellList = {};

    for (i = 0; i < gridWidth; i++) {
        cellArray.push([]);
        for (j = 0; j < gridHeight; j++) {
            // initialise as random
            r = Math.random() * 255;
            g = Math.random() * 255;
            b = Math.random() * 255;

            var newCell = {
                i: i,
                j: j,
                x: i * displayWidth / gridWidth,
                y: j * displayHeight / gridHeight,
                r_: r,
                g_: g,
                b_: b,
                r: r,
                g: g,
                b: b,
                bufferR: r,
                bufferG: g,
                bufferB: b,
                rVel: 0,
                gVel: 0,
                bVel: 0,
                bufferRVel: 0,
                bufferGVel: 0,
                bufferBVel: 0,
                neighbors: [],
                neighborPointerList: {}
            }

            //set neighbors
            if (i > 0) {
                newCell.neighbors.push(cellArray[i - 1][j]);
                cellArray[i - 1][j].neighbors.push(newCell);
            }
            if (j > 0) {
                newCell.neighbors.push(cellArray[i][j - 1]);
                cellArray[i][j - 1].neighbors.push(newCell);
            }

            //store cells in a 2D array only for the sake of setting neighbors
            cellArray[i].push(newCell);

            //store cells in a more efficient linked list, for use in update loop
            if ((i == 0) && (j == 0)) {
                cellList.first = newCell;
            }
            else {
                newCell.next = cellList.first;
                cellList.first = newCell;
            }
        }
    }

    //convert neighbor arrays to linked lists - linked list just has pointer objects.
    var cell = cellList.first;
    var numNeighbors;
    while (cell != null) {
        numNeighbors = 1;
        cell.neighborPointerList.first = {};
        cell.neighborPointerList.first.neighbor = cell.neighbors[0];
        for (i = 1; i < cell.neighbors.length; i++) {
            var newPointer = {};
            newPointer.next = cell.neighborPointerList.first;
            cell.neighborPointerList.first = newPointer;
            newPointer.neighbor = cell.neighbors[i];
            ++numNeighbors;
        }
        cell.numNeighbors = numNeighbors;
        cell = cell.next;
    }
}

function resetCellData() {
    cell = cellList.first;
    while (cell != null) {

        cell.r = cell.r_;
        cell.g = cell.g_;
        cell.b = cell.b_;

        cell.bufferR = cell.r;
        cell.bufferG = cell.g;
        cell.bufferB = cell.b;

        cell.bufferRVel = cell.rVel = 0;
        cell.bufferGVel = cell.gVel = 0;
        cell.bufferBVel = cell.bVel = 0;
        
        cell = cell.next;
    }
}

function onTimer(evt) {
    cell = cellList.first;
    while (cell != null) {
        rAve = 0;
        gAve = 0;
        bAve = 0;
        rVelAve = 0;
        gVelAve = 0;
        bVelAve = 0;
        rSep = 0;
        gSep = 0;
        bSep = 0;
        neighborPointer = cell.neighborPointerList.first;

        while (neighborPointer != null) {
            neighbor = neighborPointer.neighbor;
            rAve += neighbor.r;
            gAve += neighbor.g;
            bAve += neighbor.b;
            rVelAve += neighbor.rVel;
            gVelAve += neighbor.gVel;
            bVelAve += neighbor.bVel;
            dr = cell.r - neighbor.r;
            dg = cell.g - neighbor.g;
            db = cell.b - neighbor.b;
            if (dr * dr + dg * dg + db * db < minDistSquare) {
                rSep += dr;
                gSep += dg;
                bSep += db;
            }
            neighborPointer = neighborPointer.next;
        }

        rAve *= (f = 1 / cell.numNeighbors);
        gAve *= f;
        bAve *= f;
        rVelAve *= f;
        gVelAve *= f;
        bVelAve *= f;

        //normalize separation vector
        if ((rSep != 0) || (gSep != 0) || (bSep != 0)) {
            rSep *= (sepMagRecip = sepNormMag / Math.sqrt(rSep * rSep + gSep * gSep + bSep * bSep));
            gSep *= sepMagRecip;
            bSep *= sepMagRecip;
        }

        //Update velocity by combining separation, alignment and cohesion effects. Change velocity only by 'ease' ratio. 
        cell.bufferRVel += ease * (rSep + rVelAve + rAve - cell.r - cell.bufferRVel);
        cell.bufferGVel += ease * (gSep + gVelAve + gAve - cell.g - cell.bufferGVel);
        cell.bufferBVel += ease * (bSep + bVelAve + bAve - cell.b - cell.bufferBVel);


        //Code for clamping velocity commented out because in my testing, the velocity never went over the max. (But you may wish to restore this
        //code if you experiment with different parameters.)
        /*
        if ((mag = Math.sqrt(cell.bufferRVel*cell.bufferRVel + cell.bufferGVel*cell.bufferGVel + cell.bufferBVel*cell.bufferBVel))> velMax) {
            cell.bufferRVel *= (f = velMax/mag);
            cell.bufferGVel *= f;
            cell.bufferBVel *= f;
            console.log("clamped");
        }
        */

        //update colors according to color velocities
        cell.bufferR += cell.bufferRVel;
        cell.bufferG += cell.bufferGVel;
        cell.bufferB += cell.bufferBVel;

        
        

        // bounce colors off of boundaries relative to initial state
        if (cell.bufferR < cell.r_-bounding) {
            cell.bufferR = cell.r_-bounding;
            cell.bufferRVel *= -1;
        }
        else if (cell.bufferR > cell.r_+bounding) {
            cell.bufferR = cell.r_+bounding;
            cell.bufferRVel *= -1;
        }
        if (cell.bufferG < cell.g_-bounding) {
            cell.bufferG = cell.g_-bounding;
            cell.bufferGVel *= -1;
        }
        else if (cell.bufferG > cell.g_+bounding) {
            cell.bufferG = cell.g_+bounding;
            cell.bufferGVel *= -1;
        }
        if (cell.bufferB < cell.b_-bounding) {
            cell.bufferB = cell.b_-bounding;
            cell.bufferBVel *= -1;
        }
        else if (cell.bufferB > cell.b_+bounding) {
            cell.bufferB = cell.b_+bounding;
            cell.bufferBVel *= -1;
        }

        // also catch moving outside color boundaries
        // bounce colors off of color cube boundaries
        if (cell.bufferR < 0) {
            cell.bufferR = 0;
            cell.bufferRVel *= -1;
        }
        else if (cell.bufferR > 255) {
            cell.bufferR = 255;
            cell.bufferRVel *= -1;
        }
        if (cell.bufferG < 0) {
            cell.bufferG = 0;
            cell.bufferGVel *= -1;
        }
        else if (cell.bufferG > 255) {
            cell.bufferG = 255;
            cell.bufferGVel *= -1;
        }
        if (cell.bufferB < 0) {
            cell.bufferB = 0;
            cell.bufferBVel *= -1;
        }
        else if (cell.bufferB > 255) {
            cell.bufferB = 255;
            cell.bufferBVel *= -1;
        }

        cell = cell.next;
    }

    //now loop through again, copy buffer values and draw
    cell = cellList.first;
    while (cell != null) {
        
        cell.r = cell.bufferR;
        cell.g = cell.bufferG;
        cell.b = cell.bufferB;
        
        cell.rVel = cell.bufferRVel;
        cell.gVel = cell.bufferGVel;
        cell.bVel = cell.bufferBVel;

        context.fillStyle = "rgb(" + ~~cell.r + "," + ~~cell.g + "," + ~~cell.b + ")";
        context.fillRect(cell.x, cell.y, cellWidth, cellHeight);

        cell = cell.next;
    }
}