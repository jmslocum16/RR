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
			// create ore/crystals
			// TODO read in info, right now make 2 ore 1 crystal
			exports.TYPE_CREATE_CRYSTAL_AT.POST(state, r, c);
			for (var i = 0; i < 2; i++)
				exports.TYPE_CREATE_ORE_AT.POST(state, r, c);
		}
	}
};

TYPES[exports.TYPE_CHANGE_ROCK_TYPE.ID] = exports.TYPE_CHANGE_ROCK_TYPE;

exports.TYPE_MODIFY_ORE_COUNT = {
	ID: 2,
	PRE: function(state, value) {
		return true;
	}, // don't want people returning ore to not get counted
	POST: function(state, value) {
		state.ore += value;
	}
};

TYPES[exports.TYPE_MODIFY_ORE_COUNT.ID] = exports.TYPE_MODIFY_ORE_COUNT;

exports.TYPE_MODIFY_CRYSTAL_COUNT = {
	ID: 3,
	PRE: function(state, value) {
		return true;
	}, // same as above
	POST: function(state, value) {
		state.crystals += value;
	}
};

TYPES[exports.TYPE_MODIFY_CRYSTAL_COUNT] = exports.TYPE_MODIFY_CRYSTAL_COUNT;

exports.TYPE_CREATE_ORE_AT = {
	ID: 4,
	PRE: function(state, r, c, value) {
		return true;
	}, // never a reason you can't create an ore somewhere (yet?)
	POST: function(state, r, c, value) {
		var o = new Ore(r, c, state);
		state.freeOre[""+o.id] = o;
	}
};

TYPES[exports.TYPE_CREATE_ORE_AT.id] = exports.TYPE_CREATE_ORE_AT; 

exports.TYPE_CREATE_CRYSTAL_AT = {
	ID: 5,
	PRE: function(state, r, c, value) {
		return true;
	},
	POST: function(state, r, c, value) {
		var c = new Crystal(r, c, state);
		state.freeCrystals[""+c.id] = c;
	}
};

TYPES[exports.TYPE_CREATE_CRYSTAL_AT.id] = exports.TYPE_CREATE_CRYSTAL_AT;

exports.TYPE_DESTROY_ORE = {
	ID: 6,
	PRE: function(state, value) {
		return state.freeOre[""+value];
	},
	POST: function(state, value) {
		delete state.freeOre[""+value];
	}
};

TYPES[exports.TYPE_DESTROY_ORE.id] = exports.TYPE_DESTROY_ORE;


exports.TYPE_DESTROY_CRYSTAL = {
	ID: 7,
	PRE: function(state, value) {
		return state.freeCrystals[""+value];
	},
	POST: function(state, value) {
		delete state.freeCrystals[""+value];
	}
};

TYPES[exports.TYPE_DESTROY_CRYSTAL.id] = exports.TYPE_DESTROY_CRYSTAL;

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

function Ore(r, c, state) {
	this.x = state.cellSize * c + exports.randomNext(state.random, state.cellSize);	
	this.y = state.cellSize * r + exports.randomNext(state.random, state.cellSize);
	this.id = state.nextOreId++;
}


function Crystal(r, c, state) {
	this.x = state.cellSize * c + exports.randomNext(state.random, state.cellSize);	
	this.y = state.cellSize * r + exports.randomNext(state.random, state.cellSize);
	this.id = state.nextCrystalId++;
}

// wrote my own shitty-ass random because existing ones suck and i wanted it to be determininstic across computers
function Random() {
	this.max = 1000000009;
	this.add = 573579630;
	this.xor = 735928559;
	this.seed = 0;
}

exports.randomNext = function(r, limit) {
	r.seed += r.add;
	r.seed ^= r.xor;
	r.seed %= r.max;
	return r.seed % limit;
};

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
	this.cellSize = 48;

	this.ore = 0;
	this.crystals = 0;
	this.freeOre = {};
	this.freeCrystals = {};
	this.nextOreId = 0;
	this.nextCrystalId = 0;

	this.random = new Random();
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
