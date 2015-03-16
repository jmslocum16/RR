var http = require('http');

var app = http.createServer(function(req, res) {
		console.log(res);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end();
});

var io = require('socket.io').listen(app);
var gamestate = require("./gamestate.js");

var games = {};

function getGame(gameId) {
	return games[""+gameId];
}

function deleteGame(gameId) {
	delete games[""+gameId];
}

var clients = {};

var maxPingCount = 10;

var nextClientId = 0;


function Client(sock) {
	this.id = nextClientId++;
	clients[""+this.id] = this;
	this.gameId = -1;
	this.pings = [];
	this.socket = sock;
}

function getClient(clientId) {
	return clients[""+clientId];
}

function deleteClient(clientId) {
	delete clients[""+clientId];
}

Client.prototype.addPing = function(ping) {
	// TODO
}

Client.prototype.getPing = function() {
	// TODO
}

var nextGameId = 0;

function Game(maxPlayers, name) {
	if (maxPlayers < 1) return null;
	this.id = nextGameId++;
	this.name = name;
	games[""+this.id] = this;
	this.players = [];
	this.maxPlayers = maxPlayers;
	this.state = gamestate.newGameState();
	this.nextSequenceNumber = 0;
}

Game.prototype.addPlayer = function(client) {
	if (this.players.length == this.maxPlayers) {
		console.log("not adding player " + client.id + " to game " + this.id + ", already full.");
		return false;
	}
	this.players.push(client);
	console.log("adding player " + client.id + " to game " + this.id + ".");
	return true;
}

Game.prototype.removePlayer = function(client) {
	if (this.players.length == 0) {
		return false;
	}
	var index = -1;
	for (var i = 0; i < this.players.length; i++) {
		if (this.players[i].id == client.id) {
			index = i;
			break;
		}
	}
	if (index == -1) {
		console.log("client " + client.id + " not in game " + this.id + ", not removing.");
		return false;
	} else {
		console.log("removing client " + client.id + " from game " + this.id + ".");
		this.players.splice(index, 1);
		return true;
	}
}

io.sockets.on('connection', function(socket) {
	// TODO assign client number

	var thisclient = new Client(socket);

	var gameIds = [];
	for (var gid in games) {
		game = getGame(gid);
		gameIds.push({id: game.id, name:game.name});
	}
	socket.emit("start", {id: thisclient.id, games:gameIds});

	// create new game
	socket.on("newgame", function(data) {
		if (thisclient.gameId != -1) {
      console.log("client " + thisclient.id + " tried to create a game while in game " + thisclient.gameId);
      socket.emit("joinedgame", {error: "already in game " + thisclient.gameid + "!"});
    } else {
			console.log("starting new game");
			var name = data.name;
			console.log(data);
			if (!name) name = "you didn't name your game l3l.";
			var game = new Game(2, name); // TODO better way to do level loading/number of players
			game.addPlayer(thisclient);
			thisclient.gameId = game.id;
			socket.emit("joinedgame", {id: game.id, state: game.state});
		}
	});

	// join existing game
	socket.on("joingame", function(data) {
		if (thisclient.gameId != -1) {
			console.log("client " + thisclient.id + " tried to join another game...");
			socket.emit("joinedgame", {error: "already in game " + thisclient.gameid + "!"});
		} else if (data.id == undefined) {
			console.log("can't join game when no gameid specified..");
			socket.emit("joinedgame", {error: "no game id specified"});
		} else {
			var game = getGame(data.id);
			thisclient.gameId = data.id;
			if (game) {
				var success = game.addPlayer(thisclient);
				if (success) {
					socket.emit("joinedgame", {id: game.id, state:game.state});
				} else {
					socket.emit("joinedgame", {error: "game " + data.gameId + " full!"});
				}
			} else {
				console.log("client trying to join invalid game id " + data.id);
				socket.emit("joinedgame", {error: "invalid game id " + data.id});
			}
		}
	});
	
	// mutate game property
	socket.on("mutategame", function(data) {
		if (data.gameId == undefined) {
			console.log("client passed no gameid to mutate..");
		} else if (thisclient.gameId != data.gameId) {
			console.log("client trying to mutate incorrect game id " + data.gameId);
		} else if (!getGame(data.gameId)) {
			console.log("client trying to mutate non-existing game");
		} else if (!data.transactionList) {
			console.log("ignoring empty transaction from client " + thisclient.id);
		} else {
			// try to process transaction
			var game = getGame(data.gameId);
			var success = gamestate.applyTransactions(game.state, data.transactionList);
			if (success) {
				var SN = game.nextSequenceNumber++;
				var message = {gameId:data.gameId, SN: SN, transactionList:data.transactionList, delay:0}; // TODO estimate message delay
				for (var i = 0; i < game.players.length; i++) {
					game.players[i].socket.emit("processmutation", message);
				}
			} else {
				console.log("transaction failed, not echoing to clients");
			}
		}
	});

	// leave game
	socket.on('disconnect', function () {
		console.log("disconnected");
		if (thisclient.gameId != -1) {
			console.log("client was in game " + thisclient.gameId);
			var game = getGame(thisclient.gameId);
			var success = game.removePlayer(thisclient);
			if (success && game.players.length == 0) {
				console.log("deleting empty game " + game.id);
				deleteGame(game.id);
			}
		}
  });
});

app.listen(3000);
