///////////////////////////////////////////
/// CONSTANTS
///////////////////////////////////////////

var canvasSize = {width: 1000, height: 600}; //Given in pixels
var pillarLocation = [500, 300];
var pillarRadius = 10;
var pillarStrokeStyle = "black";
var pillarFillStyle = "#999999";
var mousePathColor = "black";
var guessPathColor = "grey";
var connectPathColor = "black";
var connectPathDashPattern = [1, 2]; //1 pixel on, 2 pixels off
var pathMarkerSize = 4; //It's a square
var particleDispRadius = 2;
var particleDispHeadingLength = 5; //Length of the direction marker for each particle
var playbackMarkerRadius = 6;
var tickRate = 25; //Given in ticks/second
var numParticles = 500;
var particleSpeedNoise = 0.5; //Up to 1.5x or down to half speed
var particleHeadingNoise = Math.PI / 8; //Up to 45 degrees to either side
var numSamplesToDisplay = 25; //How many markers on the path should be kept.
var weightColorMultiplier = 200;
var errorWeightColorDivisor = 300;
var explorationFactor = 0.01; //0.0 means no particles are randomly placed for exploration, 0.5 means 50%, 1.0 means 100%
var useExplorationParticlesGuess = false; //Whether or not to use exploration particles when estimating mouse location.

///////////////////////////////////////////
/// GLOBAL VARIABLES
///////////////////////////////////////////

var canvas; //The html object for the canvas
var frameListCont; //The html object for the div where frames and frame information is listed
var frameListTableHeader; //The html object for the header row of the frame list table
var currentFrameCont = {}; //Contains the html objects for the current frame display
var parameterElts = []; //Contains the html elements for the parameter text fields
var ctx; //2D drawing context for the canvas
var inCanvas = false; //Whether or not the mouse is in the canvas
var rawMousePos = [0, 0]; //[x, y] location of the mouse in the canvas
var rawMouseTime = 0; //The time when mousePos was taken
var mousePos = [0, 0];
var mouseTime = 0;
var oldMousePos = [0, 0];
var oldMouseTime = 0;
var mouseVel = [0, 0];
var mouseHeading = 0; //Given in radians, -PI to +PI
var pillarDist2 = 0; //Distance-squared from the mouse to the pillar
var pillarHeading = 0; //Angle between the mouse heading and the mouse->pillar line, given in radians, -PI to +PI
var mousePath = []; //List of [x, y] locations the mouse was at each sample
var guessPath = []; //The particle filter's best guess of the mouse's path
var particles = []; //Array of the particles used for the filter
var frames = []; //An array of each frame, with all interesting information
var running = false; //Whether or not the particle filter is running.
var stop = false; //Whether or not to stop running the particle filter.
var currentFrame = -1;

///////////////////////////////////////////
/// CLASSES
///////////////////////////////////////////

function Particle(pos=[0,0], heading=0) {
	this.pos = pos.slice();
	this.heading = heading;
	this.weight = 0;
	this.predictedDist2 = 0;
	this.predictedHeading = 0;
	this.isExploration = false;

	this.randomize = function() {
		this.pos = [Math.random() * canvasSize.width, Math.random() * canvasSize.height];
		this.heading = Math.random() * 2 * Math.PI - Math.PI;
		this.isExploration = true;
	}
}
function Frame(id, particles_in, mousePos_in, mouseHeading_in, mousePathAtTime, guessPathAtTime) {
	this.id = id;
	this.particles = particles_in.slice();
	this.mousePos = mousePos_in.slice();
	this.mouseHeading = mouseHeading_in;
	this.guessPos = guessPathAtTime[guessPathAtTime.length-1];
	this.mousePath = mousePathAtTime.slice();
	this.guessPath = guessPathAtTime.slice();

	this.log = function() {
		var row = document.createElement("tr");

		function addCell(row, contents) {
			var eltCont = document.createElement("td");
			var eltText = document.createTextNode(contents);
			eltCont.appendChild(eltText);
			eltCont.style.padding = "2px 8px";
			row.appendChild(eltCont);
		}

		var error = Math.sqrt(dist2(this.mousePos, this.guessPos));

		addCell(row, "Frame " + this.id);
		addCell(row, " [ " + this.mousePos[0].toFixed(2) + ", " + this.mousePos[1].toFixed(2) + " ] ");
		addCell(row, " [ " + this.guessPos[0].toFixed(2) + ", " + this.guessPos[1].toFixed(2) + " ] ");
		addCell(row, error.toFixed(2));
		addCell(row, "");

		row.setAttribute("id", "frame" + this.id);
		row.lastChild.style.backgroundColor = errorColor(error);
		row.addEventListener("click", function() {
			if(running) {
				return;
			}
			currentFrame = this.id.slice(5);
			drawFrame(frames[currentFrame], true);

			currentFrameCont.error.scrollIntoView();
			window.scrollBy(0, -25);
		});

		frameListTableHeader.parentNode.insertBefore(row, frameListTableHeader.nextSibling);
	}

	this.showCurrent = function() {
		currentFrameCont.number.innerHTML = this.id;
		currentFrameCont.actualPos.innerHTML = " [ " + this.mousePos[0].toFixed(2) + ", " + this.mousePos[1].toFixed(2) + " ] ";
		currentFrameCont.guessPos.innerHTML = " [ " + this.guessPos[0].toFixed(2) + ", " + this.guessPos[1].toFixed(2) + " ] ";
		var error = Math.sqrt(dist2(this.mousePos, this.guessPos));
		currentFrameCont.error.innerHTML = error.toFixed(2);
		currentFrameCont.color.style.backgroundColor = errorColor(error);
	}
}

///////////////////////////////////////////
/// FUNCTIONS
///////////////////////////////////////////

function setup() {
	canvas = document.getElementById("canvas");
	canvas.setAttribute("width", String(canvasSize.width) + "px");
	canvas.setAttribute("height", String(canvasSize.height) + "px");
	canvas.addEventListener("mouseenter", mouseEnterCanvas);
	canvas.addEventListener("mouseleave", mouseLeaveCanvas);
	canvas.addEventListener("mousemove", function(event) { mouseMoveCanvas(event); });
	canvas.addEventListener("click", mouseClickCanvas);

	frameListCont = document.getElementById("frameListCont");
	frameListTableHeader = document.getElementById("frameListTableHeader");

	currentFrameCont.number = document.getElementById("currentFrameNumber");
	currentFrameCont.actualPos = document.getElementById("currentFrameActual");
	currentFrameCont.guessPos = document.getElementById("currentFrameGuess");
	currentFrameCont.error = document.getElementById("currentFrameError");
	currentFrameCont.color = document.getElementById("currentFrameColor");

	var parElts = document.getElementsByClassName("parameterForm");
	for(var i=0; i<parElts.length; ++i) {
		parameterElts.push(parElts[i]);
	}

	document.addEventListener("keydown", function(e) {
		var keyId = e.which;
		console.log("Key down: " + keyId);
		if(keyId == 39) {
			++currentFrame;
			if(currentFrame >= frames.length) {
				--currentFrame;
			}
			drawFrame(frames[currentFrame], true);
		}
		else if(keyId == 37) {
			--currentFrame;
			if(currentFrame < 0) {
				++currentFrame;
			}
			drawFrame(frames[currentFrame], true);
		}
		else if(keyId == 48) {
			currentFrame = 0;
			drawFrame(frames[currentFrame], true);
		}
		else if(keyId == 57) {
			currentFrame = frames.length-1;
			drawFrame(frames[currentFrame], true);
		}
	});

	ctx = canvas.getContext("2d");
	drawPillar();
}

function mouseEnterCanvas() {
	// console.log("Mouse enter canvas");
	inCanvas = true;
}
function mouseLeaveCanvas() {
	// console.log("Mouse leave canvas");
	inCanvas = false;
}
function mouseMoveCanvas(event) {
	var rect = canvas.getBoundingClientRect();
	var x = event.clientX - rect.left;
	var y = event.clientY - rect.top;
	rawMousePos = [x, y];
	rawMouseTime = window.performance.now();
}
function mouseClickCanvas() {
	if(running) {
		stop = true;
		return;
	}
	readonly(true);
	reset();
	running = true;
	generateParticles();
	updateMouseData();
	window.setTimeout(tick, Math.floor(1000 / tickRate));
}
function updateMouseData() {
	oldMousePos = mousePos.slice();
	oldMouseTime = mouseTime;

	mousePos = rawMousePos.slice();
	mouseTime = rawMouseTime;

	mouseVel = mousePos.slice();
	mouseVel[0] -= oldMousePos[0]; mouseVel[0] /= (mouseTime - oldMouseTime);
	mouseVel[1] -= oldMousePos[1]; mouseVel[1] /= (mouseTime - oldMouseTime);

	if(mouseTime == oldMouseTime) {
		mouseVel[0] = 0;
		mouseVel[1] = 0;
	}

	mouseHeading = Math.atan2(mouseVel[1], mouseVel[0]);

	pillarDist2 = dist2(pillarLocation, mousePos);
	pillarHeading = calcPillarHeading(mousePos, mouseHeading);

	// console.log("Mouse coordinates: [" + mousePos[0] + "," + mousePos[1] + "]");
	// console.log("Mouse velocity: [" + mouseVel[0] + "," + mouseVel[1] + "]");
	// console.log("Mouse speed: " + Math.sqrt((mouseVel[0]*mouseVel[0]) + (mouseVel[1]*mouseVel[1])));
	// console.log("Mouse heading: " + String(180*mouseHeading/Math.PI));
	// console.log("Pillar heading: " + String(180*pillarHeading/Math.PI));
}

function drawPillar() {
	ctx.strokeStyle = pillarStrokeStyle;
	ctx.beginPath();
	ctx.moveTo(pillarLocation[0] + pillarRadius, pillarLocation[1]);
	ctx.arc(pillarLocation[0], pillarLocation[1], pillarRadius, 0, 2*Math.PI, true);
	ctx.closePath();
	ctx.stroke();

	ctx.fillStyle = pillarFillStyle;
	ctx.fill();
}
function drawPath(path, color) {
	ctx.strokeStyle = color;
	ctx.fillStyle = color;

	//Draw edges
	if(path.length > 1) {
		ctx.beginPath();
		ctx.moveTo(path[0][0], path[0][1]);
		for(var i=1; i<path.length; ++i) {
			ctx.lineTo(path[i][0], path[i][1]);
		}
		ctx.stroke();
	}

	//Draw markers
	var foo = pathMarkerSize;
	for(var i=0; i<path.length; ++i) {
		ctx.fillRect(path[i][0] - (foo/2), path[i][1] - (foo/2), foo, foo);
	}
}
function connectPaths(path1, path2, color) {
	if(path1.length != path2.length) {
		throw("Path lengths do not match!");
	}

	ctx.strokeStyle = color;
	ctx.setLineDash(connectPathDashPattern);
	for(var i=0; i<path1.length; ++i) {
		ctx.beginPath();
		ctx.moveTo(path1[i][0], path1[i][1]);
		ctx.lineTo(path2[i][0], path2[i][1]);
		ctx.stroke();
	}
	ctx.setLineDash([]); //Reset dashed lines.
}
function errorColor(error) {
	var errorWeight = error / errorWeightColorDivisor;
	if(errorWeight < 0) { errorWeight = 0; }
	if(errorWeight > 1) { errorWeight = 1; }
	errorWeight = 1 - errorWeight;
	return weightToColor(errorWeight);
}
function weightToColor(weight) {
	if(weight > 1) {
		weight = 1;
	}

	//Create HSL
	var h = ((1-weight)*240)/360;
	var s = 1;
	var l = 0.5;

	//Convert to RGB (from https://gist.github.com/mjackson/5311256)
	var r, g, b;

	function hue2rgb(p, q, t) {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1/6) return p + (q - p) * 6 * t;
		if (t < 1/2) return q;
		if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
		return p;
	}

	var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	var p = 2 * l - q;

	r = hue2rgb(p, q, h + 1/3);
	g = hue2rgb(p, q, h);
	b = hue2rgb(p, q, h - 1/3);

	r = Math.floor(r * 255);
	g = Math.floor(g * 255);
	b = Math.floor(b * 255);

	//Convert to RGB color code
	function componentToHex(c) {
		var hex = c.toString(16);
		return hex.length == 1 ? "0" + hex : hex;
	}
	function rgbToHex(r, g, b) {
		return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
	}

	return rgbToHex(r, g, b);
}
function drawParticle(p) {
	color = weightToColor(p.weight * weightColorMultiplier);
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(p.pos[0], p.pos[1]);
	ctx.arc(p.pos[0], p.pos[1], particleDispRadius, 0, 2*Math.PI, true);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(p.pos[0], p.pos[1]);
	ctx.lineTo(p.pos[0] + (particleDispHeadingLength*Math.cos(p.heading)),
		p.pos[1] + (particleDispHeadingLength*Math.sin(p.heading)));
	ctx.stroke();
}
function drawPlaybackBigMarker(loc, color) {
	ctx.strokeStyle = color;
	ctx.fillStyle = color;

	ctx.beginPath();
	ctx.moveTo(loc[0], loc[1]);
	ctx.arc(loc[0], loc[1], playbackMarkerRadius, 0, 2*Math.PI, true);
	ctx.closePath();
	ctx.fill();
}
function clearCanvas() {
	//
	ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
}
function drawFrame(frame, isPlayback=false) {
	clearCanvas();
	drawPillar();
	for(var i=0; i<frame.particles.length; ++i) {
		drawParticle(frame.particles[i]);
	}
	drawPath(frame.mousePath, mousePathColor);
	drawPath(frame.guessPath, guessPathColor);
	connectPaths(frame.mousePath, frame.guessPath, connectPathColor);
	if(isPlayback) {
		drawPlaybackBigMarker(frame.mousePath[frame.mousePath.length-1], mousePathColor);
		drawPlaybackBigMarker(frame.guessPath[frame.guessPath.length-1], guessPathColor);
	}
	frame.showCurrent();
}

function tick() {
	if(!inCanvas || stop) {
		running = false;
		stop = false;
		readonly(false);
		return;
	}

	// console.log("Mouse coordinates: [" + mousePos[0] + "," + mousePos[1] + "]");
	// console.log("Mouse velocity: [" + mouseVel[0] + "," + mouseVel[1] + "]");
	// console.log("Mouse speed: " + Math.sqrt((mouseVel[0]*mouseVel[0]) + (mouseVel[1]*mouseVel[1])));
	// console.log("Mouse heading: " + String(180*mouseHeading/Math.PI));
	console.log("Mouse speed: " + String(Math.sqrt((mouseVel[0]*mouseVel[0]) + (mouseVel[1]*mouseVel[1]))) + "\t\tMouse mouseHeading: " + String(180*mouseHeading/Math.PI));

	updateMouseData();
	mousePath.push(mousePos.slice());

	measureParticles();
	calculateWeights();
	makePathGuess();
	
	saveFrame();
	frames[frames.length-1].log();

	resample();
	translateParticles();
	measureParticles();
	calculateWeights();


	if(mousePath.length > numSamplesToDisplay) {
		mousePath.shift();
		guessPath.shift();
	}

	currentFrame = frames.length-1;
	drawFrame(frames[currentFrame]);

	window.setTimeout(tick, Math.floor(1000 / tickRate));
}
function reset() {
	mousePath = [];
	guessPath = [];
	particles = [];
	frames = [];
	while(frameListTableHeader.nextSibling) {
		//Delete all children of frameListCont.
		frameListTableHeader.parentNode.removeChild(frameListTableHeader.nextSibling);
	}
}

function generateParticles() {
	for(var i=0; i<numParticles; ++i) {
		particles[i] = new Particle();
		particles[i].randomize();
	}
}
function measureParticles() {
	for(var i=0; i<particles.length; ++i) {
		particles[i].predictedDist2 = dist2(particles[i].pos, pillarLocation);
		particles[i].predictedHeading = calcPillarHeading(particles[i].pos, particles[i].heading);
	}
}
function calculateWeights() {
	//Calculate individual
	var dist2Data = particles.map(a => a.predictedDist2);
	var dist2Weights = normalizeWeight(calculateWeight(dist2Data, pillarDist2, false));

	var headingData = particles.map(a => a.predictedHeading);
	var headingWeights = normalizeWeight(calculateWeight(headingData, pillarHeading, true));

	//Combine
	var combinedWeights = dist2Weights.slice();
	for(var i=0; i<combinedWeights.length; ++i) {
		combinedWeights[i] *= headingWeights[i];
	}

	//Normalize again
	combinedWeights = normalizeWeight(combinedWeights);

	for(var i=0; i<particles.length; ++i) {
		particles[i].weight = combinedWeights[i];
	}
}
function resample() {
	var weightData = particles.map(a => a.weight);
	var newParticles = [];
	var cs = cumsum(weightData);
	var step = 1/((numParticles * (1 - explorationFactor))+1);
	var chkVal = step;
	var chkIndex = 0;
	for(var i=0; i<numParticles * (1 - explorationFactor); ++i) {
		while(cs[chkIndex] < chkVal) {
			++chkIndex;
		}
		chkVal += step;
		newParticles[i] = new Particle(particles[chkIndex].pos, particles[chkIndex].heading);
	}
	for(var i=newParticles.length; i<numParticles; ++i) {
		newParticles[i] = new Particle();
		newParticles[i].randomize();
	}
	particles = newParticles.slice();
}
function translateParticles() {
	var heading = mouseHeading;
	var speed = Math.sqrt(Math.pow(mouseVel[0], 2) + Math.pow(mouseVel[1], 2));
	for(var i=0; i<particles.length; ++i) {
		var headingNoise = (Math.random() * particleHeadingNoise * 2) - particleHeadingNoise;
		var speedNoise = (Math.random() * particleSpeedNoise * 2) - particleSpeedNoise;
		particles[i].pos[0] += (speed + speedNoise) * (mouseTime - oldMouseTime) * Math.cos(heading + headingNoise);
		particles[i].pos[1] += (speed + speedNoise) * (mouseTime - oldMouseTime) * Math.sin(heading + headingNoise);
		particles[i].heading = heading + headingNoise;
	}
}
function makePathGuess() {
	var total = [0, 0];
	var numUsed = 0;
	for(var i=0; i<particles.length; ++i) {
		if(!particles[i].isExploration || useExplorationParticlesGuess) {
			total[0] += particles[i].pos[0];
			total[1] += particles[i].pos[1];
			++numUsed;
		}
	}
	if(numUsed == 0) {
		numUsed = 1;
	}
	total[0] /= numUsed;
	total[1] /= numUsed;
	guessPath.push(total);
}

function saveFrame() {
	var frame = new Frame(frames.length, particles, mousePos, mouseHeading, mousePath, guessPath);
	frames.push(frame);
}

function dist2(a, b) {
	var dx = b[0]-a[0];
	var dy = b[1]-a[1];
	return (dx*dx) + (dy*dy);
}
function calcPillarHeading(pos, heading) {
	var pillarVec = pillarLocation.slice();
	pillarVec[0] -= mousePos[0];
	pillarVec[1] -= mousePos[1];
	
	var angle = Math.atan2(pillarVec[1], pillarVec[0]);
	// console.log("Pillar angle: " + String(180*angle/Math.PI));

	var result = heading - angle;
	if(result > Math.PI) {
		result -= 2*Math.PI;
	}
	return result;
}
function mean(arr) {
	var total = 0;
	for(var i=0; i<arr.length; ++i) {
		total += arr[i];
	}
	return total / arr.length;
}
function variance(arr) {
	var v = 0;
	var m = mean(arr);
	for(var i=0; i<arr.length; ++i) {
		v += arr[i]*arr[i];
	}
	v /= arr.length;
	v -= m*m;
	return v;
}
function angleDist(a, b) {
	var diff = a - b;
	function specialMod(lhs, rhs) {
		return lhs - (Math.floor(lhs/rhs) * rhs);
	}
	return (specialMod(diff + Math.PI, Math.PI*2)) - Math.PI;
}
function calculateWeight(raw, actual, isAngle) {
	var v = variance(raw);
	var m = 1/(Math.sqrt(2*Math.PI*v));
	var weights = [];
	if(isAngle) {
		for(var i=0; i<raw.length; ++i) {
			weights[i] = Math.pow(Math.E, -(Math.pow((angleDist(raw[i], actual)), 2) / (2*v))) * m;
		}
	}
	else {
		for(var i=0; i<raw.length; ++i) {
			weights[i] = Math.pow(Math.E, -(Math.pow((raw[i]-actual), 2) / (2*v))) * m;
		}
	}
	return weights;
}
function normalizeWeight(arr) {
	var total = 0;
	for(var i=0; i<arr.length; ++i) {
		total += arr[i];
	}
	for(var i=0; i<arr.length; ++i) {
		arr[i] /= total;
	}
	return arr;
}
function cumsum(arr) {
	for(var i=1; i<arr.length; ++i) {
		arr[i] += arr[i-1];
	}
	return arr;
}

function readonly(doMakeReadonly) {
	for(var i=0; i<parameterElts.length; ++i) {
		if(doMakeReadonly) {
			parameterElts[i].readOnly = "true";
			parameterElts[i].style.color = "grey";
		}
		else {
			parameterElts[i].removeAttribute("readonly");
			parameterElts[i].style.color = "black";
		}
	}
}

///////////////////////////////////////////
/// EXECUTED CODE
///////////////////////////////////////////

setup();