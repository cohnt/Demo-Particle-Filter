///////////////////////////////////////////
/// CONSTANTS
///////////////////////////////////////////

var canvasSize = {width: 1000, height: 600}; //Given in pixels
var pillarLocation = [500, 300];
var pillarRadius = 10;
var pillarStrokeStyle = "black";
var pillarFillStyle = "#999999";
var mousePathColor = "black";
var guessPathColor = "red";
var pathMarkerSize = 4; //It's a square

///////////////////////////////////////////
/// GLOBAL VARIABLES
///////////////////////////////////////////

var canvas;            //The html object for the canvas
var ctx;               //2D drawing context for the canvas
var inCanvas = false;  //Whether or not the mouse is in the canvas
var mousePos = [0, 0]; //[x, y] location of the mouse in the canvas
var mousePath = [];    //List of [x, y] locations the mouse was at each sample
var guessPath = [];    //The particle filter's best guess of the mouse's path

///////////////////////////////////////////
/// CLASSES
///////////////////////////////////////////



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
	//TODO: Reset the demo if it's running
}
function mouseMoveCanvas(event) {
	var rect = canvas.getBoundingClientRect();
	var x = event.clientX - rect.left;
	var y = event.clientY - rect.top;
	mousePos = [x, y];
	// console.log("Mouse coordinates: [" + mousePos[0] + "," + mousePos[1] + "]");
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

///////////////////////////////////////////
/// EXECUTED CODE
///////////////////////////////////////////

setup();