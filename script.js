///////////////////////////////////////////
/// CONSTANTS
///////////////////////////////////////////

var canvasSize = {width: 1000, height: 600}; //Given in pixels
var pillarLocation = [500, 300];
var pillarRadius = 10;
var pillarFillStyle = "#999999";

///////////////////////////////////////////
/// GLOBAL VARIABLES
///////////////////////////////////////////

var canvas;            //The html object for the canvas
var ctx;               //2D drawing context for the canvas
var inCanvas = false;  //Whether or not the mouse is in the canvas
var mousePos = [0, 0]; //[x, y] location of the mouse in the canvas

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
	ctx.beginPath();
	ctx.moveTo(pillarLocation[0] + pillarRadius, pillarLocation[1]);
	ctx.arc(pillarLocation[0], pillarLocation[1], pillarRadius, 0, 2*Math.PI, true);
	ctx.closePath();
	ctx.stroke();

	ctx.fillStyle = pillarFillStyle;
	ctx.fill();
}

///////////////////////////////////////////
/// EXECUTED CODE
///////////////////////////////////////////

setup();