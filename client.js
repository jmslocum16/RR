var socket = io.connect('//localhost:3000');

var clientId;

var currentMenuGameId = -1;

var currentGameId = -1;

var gameState;

var messageQueue = {};
var nextMessageReadSN = 0;
var nextMessageWriteSN = 0;

function processMessages() {
	console.log("starting message processing");
	while (nextMessageReadSN < nextMessageWriteSN && messageQueue[""+nextMessageReadSN]) {
		var message = messageQueue[""+nextMessageReadSN];
		console.log("processing message " + nextMessageReadSN);
		nextMessageReadSN++;
		processMessage(message);
	}
	console.log("ending message processing");
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

function hideGamesMenu() {
	$("#pregame-div").hide();
}

function showGameUI() {
	$("#game-div").show();
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

function render() {
	// draw the game state on the canvas
}

function mainLoop() {
	processMessages();
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
		currentGameId = data.id;
		gameState = data.state;
		hideGamesMenu();
		showGameUI();
		mainLoop();
		setTimeout(spam, 5000, 0);
	}
});

// process game mutation
socket.on("processmutation", function(data) {
	console.log("got mutation", data);
	var timeRecieved = new Date().getTime();
	// TODO add estimated delay from server to here to delay already in message
	data.clientRec = timeRecieved;
	console.log("recieving message " + nextMessageWriteSN);
	messageQueue[""+nextMessageWriteSN] = data;
	nextMessageWriteSN++;
});
