var http = require('http');

var app = http.createServer(function(req, res) {
		console.log(res);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end();
});

var io = require('socket.io').listen(app);
var fs = require('fs');
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

function Game(name, level) {
	if (level.playerInfo.num < 1) return null;
	this.id = nextGameId++;
	this.name = name;
	games[""+this.id] = this;
	this.maxPlayers = level.playerInfo.num;
	this.players = new Array(this.maxPlayers);
	this.currentPlayers = 0;
	this.state = gamestate.newGameState(level);
	this.starts = level.playerInfo.starts;
	this.nextSequenceNumber = 0;
}

Game.prototype.addPlayer = function(client) {
	if (this.currentPlayers == this.maxPlayers) {
		console.log("not adding player " + client.id + " to game " + this.id + ", already full.");
		return -1;
	}
	var index = -1;
	for (var i = 0; i < this.maxPlayers; i++) {
		if (this.players[i] == undefined) {
			index = i;
			break;
		}
	}
	if (index == -1) {
		console.log("players array is corrupt......");
		return -1;
	}
	this.players[index] = client;
	this.currentPlayers++;
	console.log("adding player " + client.id + " to game " + this.id + ".");
	return index;
}

Game.prototype.removePlayer = function(client) {
	if (this.currentPlayers == 0) {
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
	}
	console.log("removing client " + client.id + " from game " + this.id + ".");
	this.players[index] = undefined;
    this.currentPlayers--;
	return true;
}



// respond to clients
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
			var level = loadLevel(levelList[0]);
			if (!level) {
				console.log("loading level " + levelList[0] + " failed..");
				socket.emit("joinedgame", {error: "invalid level file.."});
			} else {
				var game = new Game(name, level);
				var index = game.addPlayer(thisclient);
				thisclient.gameId = game.id;
				socket.emit("joinedgame", {id: game.id, name: game.name, state: game.state, start:game.starts[index]});
			}
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
				var index = game.addPlayer(thisclient);
				if (index != -1) {
					socket.emit("joinedgame", {id: game.id, name: game.name, state:game.state, start:game.starts[index]});
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
					if (game.players[i] != undefined) {
						game.players[i].socket.emit("processmutation", message);
					}
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
			if (success && game.currentPlayers == 0) {
				console.log("deleting empty game " + game.id);
				deleteGame(game.id);
			}
		}
  });
});

var levelList = [];

function loadLevel(name) {
	// check that everything is there and that it is valid
	console.log("loading level " + name);
	level = JSON.parse(fs.readFileSync("levels/"+name, "utf8"));
	console.log(level);
	console.log(level.numRows);
	console.log(level.numCols);
	console.log(level.playerInfo);
	console.log(level.rocktypes);
	if (!level.numRows || !level.numCols || !level.playerInfo || !level.rocktypes) {
		console.log("level doesn't have top level properties..");
		return null;
	}
	if (!level.playerInfo.num || level.playerInfo.starts.length != level.playerInfo.num) {
		console.log("level playerInfo inconsistent");
		return null;
	}
	
	var players = level.playerInfo.starts;
	for (var i = 0; i < players.length; i++) {
		if (players[i].r == undefined || players[i].c == undefined) {
			console.log("player start " + i + " doesn't have r and c.");
			return null;
		}
		if (players[i].r < 0 || players[i].r >= level.numRows) {
			console.log("player start " + i + " has invalid row.");
			return null;
		}
		if (players[i].c < 0 || players[i].c >= level.numCols) {
			console.log("player start " + i + " has invalid column.");
			return null;
		}
	}

	if (level.rocktypes.length != level.numRows) {
		console.log("rocktypes has incorrect number of rows.");
		return null;
	}
	for (var i = 0; i < level.numRows; i++) {
		if (level.rocktypes[i].length != level.numCols) {
			console.log("rocktypes row " + i + " has incorrect number of columns");
			return null;
		}
		for (var j = 0; j < level.numCols; j++) {
			// TODO check validity of rock type at [i][j]
		}
	}

	return level;
}
	
function doStartup() {
	// load level list
	var fnames = fs.readdirSync("levels");
	for (var i = 0; i < fnames.length; i++) {
		levelList.push(fnames[i]);
	}
	console.log(levelList);

	// load resources? TODO
}

doStartup();

app.listen(3000);
