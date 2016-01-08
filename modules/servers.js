/* jshint node: true, esversion: 6, eqeqeq: true, latedef: true, undef: true, unused: true */
"use strict";

var Chance = require('chance');
var config = require('config');
var lodash = require('lodash');
var ms = require('ms');
var RCON = require('srcds-rcon');

var chance = new Chance();
var database = require('../database');

module.exports = function(app, io, self, server) {
    var serverPool = config.get('app.servers.pool');
    var serverTimeout = config.get('app.servers.timeout');

    self.on('getAvailableServers', function(callback) {
        Promise.all(lodash.map(serverPool, function(server, name) {
            let rcon = RCON({
                address: server.address,
                password: server.rcon
            });

            return Promise.race([
                rcon.connect().then(function() {
                    return rcon.command('pugchamp_game_info');
                }),
                new Promise(function(resolve, reject) {
                    setTimeout(reject, ms(serverTimeout), 'timed out');
                })
            ]).then(function(result) {
                let gameID = result.trim();

                if (gameID) {
                    return new Promise(function(resolve, reject) {
                        database.Game.findById(gameID, function(err, game) {
                            if (err) {
                                resolve(false);
                                return;
                            }

                            if (game.status === 'completed' || game.status === 'aborted') {
                                resolve(false);
                            }
                            else {
                                resolve(name);
                            }
                        });
                    });
                }
                else {
                    return name;
                }
            }, function() {
                return false;
            });
        })).then(function(results) {
            callback(lodash.compact(results));
        });
    });

    function setUpServer(game) {
        // TODO: set up the game server for the next game
    }

    function retryGameLaunch(game) {
        self.emit('getAvailableServers', function(servers) {
            if (lodash.size(servers) === 0) {
                self.emit('sendSystemMessage', {
                    action: 'server not available for drafted game, aborting game'
                });

                game.status = 'aborted';
                game.save();

                return;
            }

            game.server = chance.pick(servers);
            game.save();

            setUpServer(game);
        });
    }

    self.on('launchGame', function(game) {
        self.emit('getAvailableServers', function(servers) {
            if (lodash.size(servers) === 0) {
                self.emit('sendSystemMessage', {
                    action: 'server not available for drafted game, retrying soon'
                });

                setTimeout(retryGameLaunch, ms(config.get('app.servers.retryInterval')), game);

                return;
            }

            game.server = chance.pick(servers);
            game.save();

            setUpServer(game);
        });
    });
};
