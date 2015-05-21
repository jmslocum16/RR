// game state module that both client and server modify

(function(exports){

// Transaction type definitions

var NUM_TRANSACTION_TYPES = 2;
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

exports.TYPE_CHANGE_ROCK_TYPE = {
	ID: 1,
	PRE: function(state, r, c, value) {
		return state.grid[r][c].type == value;
	},
	POST: function(state, r, c, value) {
		state.grid[r][c].type = value;
		if (value == 1) {
			state.visibleValid = false;
		}
	}
};

TYPES[exports.TYPE_CHANGE_ROCK_TYPE.ID] = exports.TYPE_CHANGE_ROCK_TYPE;

// Transaction object definitions

function Transaction(pre, post, type, ig, r, c) {
	this.precondition = pre;
	this.postcondition = post;
	this.type = type;
	this.isGrid = ig;
	if (r !== undefined) {
		this.row = r;
	}
	if (c !== undefined) {
		this.col = c;
	}
}

function checkPre(state, t) {
	if (t.isGrid) {
		return checkGridPre(state, t);
	} else {
		return checkNormalPre(state, t);
	}
}

function checkNormalPre(state, t) {
	var transType = TYPES[t.type];
	return transType.PRE(state, t.precondition);
}

function checkGridPre(state, t) {
	var transType = TYPES[t.type];
	if (t.row === undefined || t.col === undefined) {
		return false;
	}
	if (t.row < 0 || t.col < 0 || t.row >= state.grid.length || t.col >= state.grid[t.row].length) {
		return false;
	}
	return transType.PRE(state, t.row, t.col, t.precondition); 
}

function applyPost(state, t) {
	if (t.isGrid) {
		applyGridPost(state, t);
	} else {
		applyNormalPost(state, t);
	}
}

function applyNormalPost(state, t) {
	var transType = TYPES[t.type];
	transType.POST(state, t.postcondition);
}

function applyGridPost(state, t) {
	var transType = TYPES[t.type];
	transType.POST(state, t.row, t.col, t.postcondition);
}

// GameState Object definitions

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
	this.grid = [];
	for (var i = 0; i < this.rows; i++) {
		this.grid.push([]);
		for (var j = 0; j < this.rows; j++) {
			var type = rockinfo[i][j];
			this.grid[i].push(new Rock(type));
		}
	}
	this.visibleValid = false;
}

exports.gridDeltas = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [0, 1], [-1, 0], [0, -1]];

exports.applyTransactions = function(state, transactionList) {
	console.log("applying transactions", transactionList);
	for (var i = 0; i < transactionList.length; i++) {
		if (!checkPre(state, transactionList[i])) {
			return false;
		}
	}
	for (var i = 0; i < transactionList.length; i++) {
		applyPost(state, transactionList[i]);
	}
	return true;
};

exports.newGameState = function(level) {
  return new GameState(level.numRows, level.numCols, level.rocktypes);
};

exports.newTransaction = function(pre, post, type) {
	return new Transaction(pre, post, type.ID, false);
};

exports.newGridTransaction = function(r, c, pre, post, type) {
	return new Transaction(pre, post, type.ID, true, r, c);
};


})(typeof exports === "undefined"? this["gamestate"]={}: exports);
