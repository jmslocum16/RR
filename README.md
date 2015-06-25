RR
==

nodejs rock raiders

# Setup

Have node.js and npm installed.

run "npm install" in the base directory.

# run

To run the server, run "npm start" in the base directory.

To run the client, open up RR.html in your favorite web browser.

# Overview

This is a multiplayer, javascript based game. There will be multiple clients and one server. The clients send updates to the server, who echoes them back to all clients.
The clients render their local game state each frame in an html5 canvas.
The server supports multiple games, creating a game, and joining an existing game.

# Code architecture
server.js: the server code

client.js: the client code that runs in RR.html

gamestate.js: The game state code that is shared between the client and the server; where the bulk of the code will be.

levels/: holds all of the level files.

## Future code

resources/: holds all of the images the game needs to draw.

# Client-Server flow (joining a game)

When RR.html first loads, it polls the server for the existing games.

It then displays the pre-game UI. This consists of a space to create a new game, or a list of existing games to join.

The user either types in a game name to create, or selects an existing game, and then hits the respective button.

Once the user is in a game, they switch to the game UI, where they keep track of a game state, render it every frame, and update it with both local user input and incoming network messages.

## Improvements

This technically works, but there are multiple things to be improved.

1.	Layout is terrible, looks like a website from 1990 even though I tried to use bootstrap.
2.	Clicking on a game name selects the game, but there is no feedback to the user that they selected that specific game to join.
3.	Obviously this means anyone can join any game, so a simple feature to improve this would be to allow the game creator to specify an optional password on creation.

# In Game

## Game State

The server keeps its own copy of the game state for each game, and each client keeps a copy of its game's state.

The game state consists of two parts: local parts and shared parts.

### Local Parts

Each player has their own set of rock raiders, vehicles, and buildings, controllable by only them. This also includes each player's individual ore/crystal total, and the part of the map that is visible to them.
(currently, there is only a global crystal/ore total, which will need to change)

### Shared parts

Everything else. The actual map, the free ores/crystals within the map, monsters, etc...

### Actual game state structure
Game state is stored as a JSON object.

Currently, the object's top level properties are:

1.	Number of rows in game
2.	Number of columns in game
3.	2d grid of rock objects

Rock object:

1.	type ENUM  (integer) // what type of rock it is
2.	rubble level (integer)
3.	Whether the rock is being drilled currently (boolean)
4.	Ore produced
5.	Crystals produced

Rock types:

0.	Solid rock (undrillable)
1.	Empty (passable)
2.	Rubble (passable but at a slower speed)
3.	Dirt

Proposed other types: (rock types 3 and above intended to be in increasing order of time to drill)

4.	Clay
5.	Sandstone
6.	Limestone
7.	Granite
8.	Obsidian

Rubble level is 0-2, at 0 it disappears and becomes empty. Clearing a level of rubble produces 1 ore.

The time it takes to drill a type of rock will likely just be a function of its rock type.

The rest of the shared state will be top-level objects within the state.

The additional state required is:

1.	List of free ore + crystal objects
2.	List of monsters

etc...

Ore/Crystal objects have simple state

1.	Position

When they are picked up by a rock raider, they are removed from the game state.

The local state will be handled with a list of players.

Each player will have all of its local state there, containing:

1.	Count of ore + crystals

2.	List of rock raiders

Rock raider object:

1.	Position (not synchronized with server, interpolated from RR's current path and timing info)

2.	Object it is carrying (nothing, ore, crystal)

3.	Task (consists of a path, and an optional action after it gets there)

Example: move here, and pick up ore #31


### All of the transactions that may happen so far
Basically 3 classes of transactions

1.	Local

2.	Global

3.	Global Rock, referring to a cell of the grid (a single rock)

#### Local Transactions

1.	Set ore count

2.	Set crystal count

3.	Set RR task

4.	Set RR item carrying

#### Global transactions

1.	Create ore

2.	Create crystal

3.	Remove ore

4.	Remove crystal

TODO monster stuff

#### Grid transactions

1.	Change rock type

2.	Change rubble level

3.	Begin wall drilling

More logic will have to be implemented with the transitions, like on rock type change you may add transactions to the update, such as creating ore or changing the rubble level..
A big one will be on rock raider task change, the server will have to do a pathfinding algorithm to figure out the optimal path for the rock raider to move from point A to point B.

### Updating the game state

The general idea is that clients propose updates to the server, but only process them and change their own game state when they get an acknowledgement back from the server that the update is ok to do. Since the server processes the updates in order, and then the clients process those updates in the same order, and they run the same code, the game state should always be consistent. (Called state machine replication in distributed systems).

#### Client updating local state

The only reason this needs to touch the server is the other players probably want to see what your rock raiders are doing. But, there doesn't need to be any concurrency control on this state because only you are allowed to mutate your local state.

Thus, the only thing that happens for this is the client tells the server what to update, and the server echoes it to the rest of the players.

#### Client updating shared state

To make sure that the shared game state remains consistent, I have implemented a simple transaction system for shared updates.

Each shared update poses its updates in terms of a list of transactions. Each transaction has a precondition and a postcondition function that will be evaluated on the game state.

When the server receives a shared update, it goes through the list of transactions and checks all of the preconditions. If any fail, it aborts and does not apply the transaction or echo it to the other players. Otherwise, it applies the postcondition function to the game state, and echoes the update to all other players.

The purpose of this is that it guarantees that any concurrent updates to the shared part of the state happen exactly once, even if the network duplicates a message, but especially when multiple players try to update the same state, whether it be drilling the same wall, or rock raiders from two different players trying to pick up the same ore.

#### Server updating the game state.

For timing reasons, all of the shared state logic will happen on the server. For example, if it takes a rock raider 3 seconds to drill the wall, the initial update from the client will tell the server to change the wall from !drilled to drilled, and nothing more. If this transaction succeeds, the server will set a 3 second timer for itself, and on the timer it will send a transaction to all clients updating the wall from drilled to rubble.

#### Client local logic

The client will also have to do a little more than render a frame and process updates. Each client will have to do the logic for updating its local state. For example, moving around its rock raiders, and sending updates to the server when they finish their tasks. They also have to update what part of the map is visible to them when new walls are drilled.
Another big part will be giving the rock raiders tasks and managing what they do. A simple AI will likely need to be developed from this, managing tasks and assigning tasks to idle rock raiders.

#### Implementation

Since the game state code needs to be shared between the client and server side, it is in a node.js module. The syntax is gross, but it's basically a javascript file wrapped in a weird closure.
The only important thing to know is that if you want something to be visible outside the file, you need to put it on exports, otherwise it can be defined locally.

#### Core Improvements

1.	None of the server timing stuff is implemented, but that will come later once a lot is happening in game.

## Networking

Both sides use socket.io to communicate. socket.io is a simple callback-based network programming library. I have already implemented the basics of what needs to be done here.
It uses message types and json data to determine what to do.

### Server protocol

The server listens for 3 types of messages, besides the default socket.io stuffs.

1.	"newgame"

2.	"joingame"

3.	"mutategame"

#### New Game

The server does some validity checking on the client and the game, and then adds a new game to its set of games, loads the initial game state from a file, and tells the client to "joinedgame" on the new game it created.

#### Join Game

The server makes sure that the game the client is requesting to join exists and is not full, and if so it tells the client to "joinedgame" on the specified game, passing along the current game state.

#### Mutate Game

The server makes sure the game and list of transactions are valid. If so, it tries to process the transaction, and if succesful, echoes the transaction to all the clients in that game with "processmutation", and gives the update the next sequence number.

### Client Protocol

The client listens for two types of messages:

1.	"joinedgame"

2.	"processmutation"

#### Joined Game

When the client gets this message, it sets the game state, does some initial calculations such as computing the visible area, and then removes the pregame UI, changes to the game UI, and starts the main game loop.

#### Process Mutation

Since we want to make sure the client processes the messages in the same order as the server, we only process them in the order defined by the sequence numbers the server gives them. Thus, when we get a message, we just put it in a queue. The client keeps track of the sequence number it is waiting for, and each game loop processes messages in the queue until it cannot find one with the next sequence number.

## Game Loading

Game levels are stored in JSON files.

On start, the server looks at the levels directory to see what levels it has.

On game creation the game loads the first levels file, and if it doesn't have any errors, sends the game state to the client.

### File Format
The JSON object has the following format:

playerInfo: {

	num: // max players allowed

	starts: [{/* object containing row and column of start for player i*/}] // list is of size num

}

numRows: // number of rows in the grid

numCols: // number of columns in the grid

rocktypes: // 2d list of size numRows X numCols, each position has an integer that is the rock position at (i, j)

not currently implemented but required:

crystalcounts: // 2d list, each position has integer that is the number of crystals that rock produces when destroyed

orecounts: // 2d list, each postition has integer that is the number of ore that rock produces when destroyed

other stuff, like win conditions, etc...

### Improvements
1.	Enable clients to specify a level file on game creation.
2.	Develop procedural generation of levels (a lot of games do this now, it should be feasible and cool).

## Client rendering
Currently the client draws a viewport within the map, which is controlled by the arrow keys and visible in the minimap.
A minimap would also be nice, which would probably be drawn in a separate canvas to the side.

Right now there is just a mapping from rock type to color, but eventually there will be multiple image textures for each type of rock. These resources will need to be loaded before the game can begin, will need to look tiled, and will need to be drawn with a texture, which will be part of the client-side rock state.
Everything else (ore, crystals, rock raiders, buildings) is drawn over the rocks.

### Improvements
Currently the client has a separate canvas for the rocks, and only updates that when a rock is destroyed/rubble is changed. (could optimize rubble + crystals by drawing yet another intermediate canvas, currently crystals + ore are dynamic), and then dynamic objects such as rock raiders are drawn over it.

## User Input
TODO GUI, mouse and keyboard controls

## Buildings
Need to figure out how this fits into the game state.


# Current state
Right now the very core functionality is implemented. The networking with joining/creating games, loading the basic state from a file on create, transactions, both server and client processing updates, and client rendering the game state to its canvas. No updates occur to the game state besides the initial state.

#Roadmap forward
The state also needs to be more well defined. The interactions of rock raiders need to be better defined, and buildings need to be entirely defined.
Once that happens, I the next goal should being ble to select rock raiders and moving them around
This will require a lot of work on the server to make rock raider's tasks and pathing work, and work on the client to draw the rock raiders on their path properly.

The next step seems to be combining the last two and making rock raiders able to move around, and drill walls dynamically. This will require implementing the server timing system, client input capturing, and some of the grid transactions.

Next should be adding a basic building (the tool store) at start, and making rock raiders able to pick up ore/crystals, and making them return them to the tool store automatically.
This will require building out the start of the client's rock raider AI.

Then, a simple extension of this should be adding in rubble shoveling, which will require modifications to the client AI, rock raider tasks, and server transactions.

After this we will have a basic game, and can do all of the fun features like using image textures, adding more buildings, etc...

