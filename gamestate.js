// game state module that both client and server modify

(function(exports){

var NUM_TYPES = 1;
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

function GameState() {
  this.test = 0;
}

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

exports.newGameState = function() {
  return new GameState();
}

exports.newTransaction = function(pre, post, type) {
	return new Transaction(pre, post, type);
}

})(typeof exports === "undefined"? this["gamestate"]={}: exports);
