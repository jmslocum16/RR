var socket = io('http://localhost:3000');

var clientId;

var currentMenuGameId = -1;

var currentGameId = -1;
var currentGameName;

var gameState;
var visible;

// input

var moveLeft = false;
var moveRight = false;
var moveUp = false;
var moveDown = false;

window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);
 
function handleKeyDown(e) {
	switch(e.keyCode) {
		case 37:
			moveLeft = true;
			break;
		case 38:
			moveUp = true;
			break;
		case 39:
			moveRight = true;
			break;
		case 40:
			moveDown = true;
			break;
	}
}

function handleKeyUp(e) {
	switch(e.keyCode) {
		case 37:
			moveLeft = false;
			break;
		case 38:
			moveUp = false;
			break;
		case 39:
			moveRight = false;
			break;
		case 40:
			moveDown = false;
			break;
	}
}




var levelWidth;
var levelHeight;
var minimapCellWidth = 0;
var minimapCellHeight = 0;

function initVisible() {
	visible = new Array(gameState.rows);
	for (var i = 0; i < gameState.rows; i++) {
		visible[i] = new Array(gameState.cols);
		for (var j = 0; j < gameState.cols; j++) {
			visible[i][j] = false;
		}
	}
}

var startR;
var startC;

function redoVisible() {
	needBackgroundUpdate = true;
	// flood fill
	var visited = new Array(gameState.rows);
	for (var i = 0; i < gameState.rows; i++) {
		visited[i] = new Array(gameState.cols);
		for (var j = 0; j < gameState.cols; j++) {
			visited[i][j] = false;
		}
	}
	floodFillVisibleHelper(startR, startC, visited);
}

function floodFillVisibleHelper(r, c, visited) {
	// check if shouldn't be here
	if (r < 0 || r >= gameState.rows || c < 0 || c >= gameState.cols) return;
	if (gameState.grid[r][c].type != 1 && gameState.grid[r][c].type != 2) {
		// still set it to visible, but don't continue
		visible[r][c] = true;
		return;
	}
	if (visited[r][c]) return;
	
	// fill it
	visited[r][c] = true;
	visible[r][c] = true;
	
	// do neighbors
	for (var i = 0; i < gamestate.gridDeltas.length; i++) {
		var newr = r + gamestate.gridDeltas[i][0];
		var newc = c + gamestate.gridDeltas[i][1];
		floodFillVisibleHelper(newr, newc, visited);
	}
}

var messageQueue = {};
var nextMessageReadSN = 0;
var nextMessageWriteSN = 0;

function processMessages() {
	while (nextMessageReadSN < nextMessageWriteSN && messageQueue[""+nextMessageReadSN]) {
		var message = messageQueue[""+nextMessageReadSN];
		console.log("processing message " + nextMessageReadSN);
		nextMessageReadSN++;
		processMessage(message);
	}
}

function processMessage(message) {
	var estimatedTotalDelay = message.delay;
	if (message.clientRec != undefined) {
		estimatedTotalDelay += new Date().getTime() - message.clientRec;
	}
	gamestate.applyTransactions(gameState, message.transactionList);
	console.log(gameState.test);
}

function displayGamesMenu(gamesList) {
	console.log(gamesList);
	$("#pregame-div").show();
	if (gamesList) {
		for (var i = 0; i < gamesList.length; i++) {
			$("#gameids").append("<li onclick=\"currentMenuGameId=" + gamesList[i].id + "\">" + gamesList[i].name + "</li>");
		}
	}
}

function handleCanvasClick(i, j) {
	if (i < 0  || j < 0 || i >= gameState.rows || j >= gameState.cols) {
		return;
	}
	var oldRockType = gameState.grid[i][j].type;
	if (!visible[i][j] || oldRockType == 0 || oldRockType == 1) {
		return;
	}
	console.log("(" + i + ", " + j + ")");
	var t = gamestate.newGridTransaction(i, j, oldRockType, 1, gamestate.TYPE_CHANGE_ROCK_TYPE);
	sendMutations([t]);
}

function hideGamesMenu() {
	$("#pregame-div").hide();
}

function showGameUI(name) {
	$("#game-name-heading").html(name);
	$("#game-div").show();
	canvas = document.getElementById("mainCanvas");
	ctx = canvas.getContext("2d");
	mapCanvas = document.getElementById("mapCanvas");
	mapCtx = mapCanvas.getContext("2d");
	minimapCanvas = document.getElementById("minimapCanvas");
	minimapCtx = minimapCanvas.getContext("2d");
	$("#canvasdiv").click(function(evt) {
		var minimapOffsetX = evt.offsetX - minimapX;
		var minimapOffsetY = evt.offsetY - minimapY;
		var i;
		var j;
		if (minimapOffsetX >= 0 && minimapOffsetY >= 0 && minimapOffsetX < minimapCanvas.width && minimapOffsetY < minimapCanvas.height) {
			// click in minimap, translate to world coordinates
			i = Math.floor(minimapOffsetY / minimapCellHeight);
			j = Math.floor(minimapOffsetX / minimapCellWidth);
		} else {
			// click on main map
			i = Math.floor((viewportY + evt.offsetY) / gameState.cellSize);
			j = Math.floor((viewportX + evt.offsetX) / gameState.cellSize);
		}
		handleCanvasClick(i, j);
		
	});
	resizeCanvas();
	centerViewport(startC * gameState.cellSize, startR * gameState.cellSize);
}

var viewportX = 0;
var viewportY = 0;

function centerViewport(x, y) {
	viewportX = x - Math.floor(canvas.width / 2);
	viewportY = y - Math.floor(canvas.height / 2);
	clampViewport();
}

function translateViewport(dx, dy) {
	viewportX += dx;
	viewportY += dy;
	clampViewport();
}

function clampViewport() {
	if (viewportX + canvas.width > levelWidth) {
		viewportX = levelWidth - canvas.width;
	}
	if (viewportY + canvas.height > levelHeight) {
		viewportY = levelHeight - canvas.height;
	}
	if (viewportX < 0) {
		viewportX = 0;
	}
	if (viewportY < 0) {
		viewportY = 0;
	}

}

function joinGame() {
	if (currentMenuGameId == -1) return;
	console.log("joining game " + currentMenuGameId);
	socket.emit("joingame", {id: currentMenuGameId});
}

function newGame() {
	var name = $("#newgame-name").val();
	if (!name) return;
	console.log("creating game with name " + name);
	socket.emit("newgame", {name:name});
}

function updateLocal() {
	if (!gameState.visibleValid) {
		redoVisible();
		visibleValid = true;
	}	
}

// rendering stuffs
var canvas;
var ctx;
var minimapCanvas;
var minimapCtx;
var mapCanvas;
var mapCtx;
var minimapX;
var minimapY;
var viewportX;
var viewportY;

window.addEventListener('resize', resizeCanvas, false);

function resizeCanvas() {
	if (gameState) {
		gameState.visibleValid = false;
		if (minimapCanvas) {
			minimapCellWidth = Math.floor(minimapCanvas.width / gameState.cols);
			minimapCellHeight = Math.floor(minimapCanvas.height / gameState.rows);
			minimapCanvas.width = minimapCellWidth * gameState.cols;
			minimapCanvas.height = minimapCellHeight * gameState.rows;
		}
	}
	if (canvas && minimapCanvas) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		// place minimap in bottom left
		minimapX = canvas.width - minimapCanvas.width;
		minimapY = 0;
	}
}

viewportMoveSpeed = 200;

function moveViewport(dt) {
	var d = viewportMoveSpeed * dt / 1000.0;
	var dx = 0;
	var dy = 0;
	if (moveLeft) dx -= d;
	if (moveRight) dx += d;
	if (moveUp) dy -= d;
	if (moveDown) dy += d;
	translateViewport(dx, dy);
}


// styles
var invisibleStyle = "#000000";
var emptyStyle = "#FFFFFF";
var solidStyle = "#666666";
var drillableStyle = "#AAAAAA";

var oreStyle = "#663300";
var crystalStyle = "#22BB22";

var needBackgroundUpdate = true;

function renderBackground() {
	// draw the game state on the canvas
	// draw grid first
	mapCtx.fillStyle = invisibleStyle;
	mapCtx.fillRect(0, 0, canvas.width, canvas.height);
	minimapCtx.fillStyle = invisibleStyle;
	minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
	for (var i = 0; i < gameState.rows; i++) {
		for (var j = 0; j < gameState.cols; j++) {
			// set style
			if (!visible[i][j]) {
				continue;
			} else if (gameState.grid[i][j].type == 0) {
				mapCtx.fillStyle = solidStyle;
			} else if (gameState.grid[i][j].type == 1) {
				mapCtx.fillStyle = emptyStyle;
			} else if (gameState.grid[i][j].type == 3) {
				mapCtx.fillStyle = drillableStyle;
			} else {
				console.log("weirdass type at " + i + ", " + j + ": " + gameState.grid[i][j].type);
			}
			// draw rect
			mapCtx.fillRect(j * gameState.cellSize, i * gameState.cellSize, gameState.cellSize, gameState.cellSize);
			minimapCtx.fillStyle = mapCtx.fillStyle;
			minimapCtx.fillRect(j * minimapCellWidth, i * minimapCellHeight, minimapCellWidth, minimapCellHeight);
		}
	}
}

function drawLine(x, y, x2, y2) {
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

function drawCircle(x, y, r) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 2*Math.PI, false);
	ctx.fill();
}

function renderMain() {

	// draw background
	ctx.fillStyle = invisibleStyle;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	var drawX = Math.floor(viewportX);
	var drawY = Math.floor(viewportY);
        var drawWidth = Math.min(canvas.width, mapCanvas.width - drawX);
	var drawHeight = Math.min(canvas.height, mapCanvas.height - drawY);
	ctx.drawImage(mapCanvas, drawX, drawY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);

	// draw dynamic
	// TODO

	// draw ore
	var oreMap = gameState.freeOre;
	for (var oid in oreMap) {
		if (oreMap.hasOwnProperty(oid)) {
			drawOre(oreMap[oid]);
		}
	}

	// draw crystals
	var crystalMap = gameState.freeCrystals;
	for (var cid in crystalMap) {
		if (crystalMap.hasOwnProperty(cid)) {
			drawCrystal(crystalMap[cid]);
		}
	}
}

// TODO don't draw if not in viewport

function drawOre(ore) {
	ctx.fillStyle = oreStyle;
	drawCircle(ore.x - viewportX, ore.y - viewportY, 5);
}

function drawCrystal(crystal) {
	ctx.fillStyle = crystalStyle;
	ctx.beginPath();
	var width = 4;
	var height = 8;
	ctx.moveTo(-viewportX + crystal.x, -viewportY + crystal.y + height);
	ctx.lineTo(-viewportX + crystal.x + width, -viewportY +  crystal.y);
	ctx.lineTo(-viewportX + crystal.x, -viewportY + crystal.y - height);
	ctx.lineTo(-viewportX + crystal.x - width, -viewportY + crystal.y);
	ctx.lineTo(-viewportX + crystal.x, -viewportY + crystal.y + height);
	ctx.fill();
}

function viewToMiniX(x) {
	return x * minimapCanvas.width / levelWidth;
}

function viewToMiniY(y) {
	return y * minimapCanvas.height / levelHeight;
}

function renderMinimap() {
	// draw base image
	ctx.drawImage(minimapCanvas, minimapX, minimapY);

	// draw dynamic stuff
	// TODO

	// draw viewport
	ctx.strokeStyle = "#FFFF00";
	ctx.lineWidth = 1;
	ctx.strokeRect(minimapX + viewToMiniX(viewportX), minimapY + viewToMiniY(viewportY), viewToMiniX(canvas.width), viewToMiniY(canvas.height));
	
	// draw outline
	ctx.strokeStyle = "#FFFFFF";
	ctx.lineWidth = 2;
	drawLine(minimapX, minimapY, minimapX, minimapY + minimapCanvas.height);
	drawLine(minimapX, minimapY + minimapCanvas.height, minimapX + minimapCanvas.width, minimapY + minimapCanvas.height);
}

function render() {
	if (needBackgroundUpdate) {
		renderBackground();
		needBackgroundUpdate = false;
	}
	renderMain();
	renderMinimap();
}

var lastts = -1;

function mainLoop() {
	if (lastts == -1) {
		lastts = new Date().getTime();
	}

	var curtime = new Date().getTime();
	var msdif = curtime - lastts;
	lastts = curtime;

	moveViewport(msdif);
	
	processMessages();
	updateLocal();
	render();

	setTimeout(mainLoop, 10);
}

// network stuffs...

function sendMutations(tList) {
	socket.emit("mutategame", {gameId:currentGameId, transactionList: tList});
}

// contacted server for list of games, display them and let client either choose one or create a game
socket.on("start", function(data) {
	console.log("start", data);
	if (data.id == undefined) {
		console.log("no client id returned...");
	} else {	
		clientId = data.id;
		displayGamesMenu(data.games);
	}
});

// process attempt to join a game
socket.on("joinedgame", function(data) {
	if (data.error) {
		console.log("error joining game: ", data.error);
	} else if (data.id == undefined || data.state == undefined) {
		console.log("no id or state in game info: ", data);
	} else {
		console.log("successfully joined game " + data.id);
		console.log(data);
		currentGameId = data.id;
		gameState = data.state;
		initVisible();
		startR = data.start.r;
		startC = data.start.c;
		levelWidth = gameState.cols * gameState.cellSize;
		levelHeight = gameState.rows * gameState.cellSize;
		redoVisible();
		hideGamesMenu();
		showGameUI(data.name);
		if (mapCanvas) {
			mapCanvas.width = levelWidth;
			mapCanvas.height = levelHeight;
		}
		mainLoop();
	}
});

// process game mutation
socket.on("processmutation", function(data) {
	console.log("got mutation", data);
	var timeRecieved = new Date().getTime();
	// TODO add estimated delay from server to here to delay already in message
	data.clientRec = timeRecieved;
	messageQueue[""+nextMessageWriteSN] = data;
	nextMessageWriteSN++;
});
