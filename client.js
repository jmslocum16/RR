var socket = io('http://localhost:3000');

var clientId;

var currentMenuGameId = -1;

var currentGameId = -1;
var currentGameName;

var gameState;
var visible;


var cellSize = 48;
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
			i = Math.floor(evt.offsetY / cellSize);
			j = Math.floor(evt.offsetX / cellSize);
		}
		handleCanvasClick(i, j);
		
	});
	resizeCanvas();
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
	if (canvas && minimapCanvas && mapCanvas) {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		mapCanvas.width = canvas.width;
		mapCanvas.height = canvas.height;
		// place minimap in bottom left
		minimapX = canvas.width - minimapCanvas.width;
		minimapY = 0;
	}
}


// styles
var invisibleStyle = "#000000";
var emptyStyle = "#FFFFFF";
var solidStyle = "#666666";
var drillableStyle = "#AAAAAA";

function renderBackground() {
	// draw the game state on the canvas
	// draw grid first
	ctx.fillStyle = invisibleStyle;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	minimapCtx.fillStyle = invisibleStyle;
	minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
	for (var i = 0; i < gameState.rows; i++) {
		for (var j = 0; j < gameState.cols; j++) {
			// set style
			if (!visible[i][j]) {
				continue;
			} else if (gameState.grid[i][j].type == 0) {
				ctx.fillStyle = solidStyle;
			} else if (gameState.grid[i][j].type == 1) {
				ctx.fillStyle = emptyStyle;
			} else if (gameState.grid[i][j].type == 3) {
				ctx.fillStyle = drillableStyle;
			} else {
				console.log("weirdass type at " + i + ", " + j + ": " + gameState.grid[i][j].type);
			}
			// draw rect
			ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
			minimapCtx.fillStyle = ctx.fillStyle;
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

function renderMain() {
	// draw background images to screen
	ctx.drawImage(canvas, 0, 0);
}

function renderMinimap() {
	// draw base image
	ctx.drawImage(minimapCanvas, minimapX, minimapY);

	// draw dynamic stuff
	// TODO
	
	// draw outline
	ctx.strokeStyle = "#FFFFFF";
	ctx.lineWidth = 2;
	drawLine(minimapX, minimapY, minimapX, minimapY + minimapCanvas.height);
	drawLine(minimapX, minimapY + minimapCanvas.height, minimapX + minimapCanvas.width, minimapY + minimapCanvas.height);
}

function render() {
	if (!gameState.visibleValid) {
		renderBackground();
	}
	renderMain();
	renderMinimap();
}

function mainLoop() {
	processMessages();
	updateLocal();
	render();
	setTimeout(mainLoop, 1);
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
		redoVisible();
		hideGamesMenu();
		showGameUI(data.name);
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
