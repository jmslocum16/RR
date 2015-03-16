var socket = io.connect('//localhost:3000');

var clientId;

var currentMenuGameId = -1;

var currentGameId = -1;

var gameState;

function displayGamesMenu(gamesList) {
	console.log(gamesList);
	$("#pregame-div").show();
	if (gamesList) {
		for (var i = 0; i < gamesList.length; i++) {
			$('#gameids').append("<li onclick=\"currentMenuGameId=" + gamesList[i].id + "\">" + gamesList[i].name + "</li>");
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

socket.on("start", function(data) {
	console.log("start", data);
	if (data.id == undefined) {
		console.log("no client id returned...");
	} else {	
		clientId = data.id;
		displayGamesMenu(data.games);
	}
});

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
	}
});
