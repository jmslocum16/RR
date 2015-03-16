// game state module that both client and server modify

(function(exports){

var NUM_TRANSACTION_TYPES = 1;
var TYPES = [];

exports.TYPE_TEST = {
	ID: 0,
	PRE: function(state, value) {
		return state.test == value;
	},
	POST: function(state, value) {
		state.test = value;
	}
};

TYPES[exports.TYPE_TEST.ID] = exports.TYPE_TEST;

function Transaction(pre, post, type) {
	this.precondition = pre;
	this.postcondition = post;
	this.type = type;
}

function Rock(type) {
	this.type = type;
	this.rubbleLevel = 0;
	this.currentlyDrilled = false;
	this.oreGenerated = 0;
	this.crystalsGenerated = 0;
}

function GameState(r, c, rockinfo) {
  this.rows = r;
	this.cols = c;
	this.grid = rockinfo;
	for (var i = 0; i < this.rows; i++) {
		for (var j = 0; j < this.rows; j++) {
			var type = rockinfo[i][j];
			rockinfo[i][j] = new Rock(type);
		}
	}
}

exports.gridDeltas = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [0, 1], [-1, 0], [0, -1]];

exports.applyTransactions = function(state, transactionList) {
	console.log("applying transactions");
	console.log("game state", state);
	console.log("transactionList", transactionList);
	for (var i = 0; i < transactionList.length; i++) {
		var transType = TYPES[transactionList[i].type];
		if (!transType.PRE(state, transactionList[i].precondition)) {
			return false;
		}
	}
	for (var i = 0; i < transactionList.length; i++) {
		var transType = TYPES[transactionList[i].type];
		transType.POST(state, transactionList[i].postcondition);
	}
	return true;
}

exports.newGameState = function(level) {
  return new GameState(level.numRows, level.numCols, level.rocktypes);
}

exports.newTransaction = function(pre, post, type) {
	return new Transaction(pre, post, type);
}

})(typeof exports === "undefined"? this["gamestate"]={}: exports);
