"use strict";

/**
 * ISC License
 *
 * Copyright (c) 2017, Antoine Pous <gecko@dvp.io>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
 * OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

let net = require("net");
let TS3Utils = require("teamspeak3-utils");
let LineInputStream = require("line-input-stream");
let ev = require("eventemitter2").EventEmitter2;
let util = require("util");

let TeamSpeak3Client = function() {
    ev.call(this);

    let self = this;
    let socket;
    let status = -2;
    let prepared = {};
    let queue = [];
    let queryCount = 0;
    let q = null;
    let AFLTime = 0;
    let AFLQuery = 0;
    let AFLConfig = {
        whitelisted: false,
        commands: 10,
        time: 3
    };

    /**
     * Embedded ts3utils for more convenience
     *
     * @since 1.2.0
     */
    TeamSpeak3Client.prototype.utils = TS3Utils;

    /**
     * Anti Flood Limit Reached
     *
     * @description
     * @since 1.1.0
     * @return boolean
     */
    let AFLReached = function(query) {

        if(AFLConfig.whitelisted === true) {
            return false
        }

        let currentTime = new Date().getTime() / 1000;

        // If the time limit is expired
        if((AFLTime + AFLConfig.time) < currentTime) {
            AFLTime = currentTime;
            AFLQuery = query.id;
            return false
        }

        // If the queryCount is reached
        if((query.id - AFLConfig.commands) >= AFLQuery) {
            setTimeout(function() {
                processQueue()
            }, (currentTime - AFLTime) * 1000);
            return true
        }

        return false
    };

    /**
     * Process queue
     *
     * @description Execute the first query from the queue
     * @since 1.0.0
     * @return null
     */
    let processQueue = function() {
        if(!q && queue.length >= 1) {
            if(!AFLReached(queue[0])) {
                q = queue.shift();
                self.emit("verbose", "Query sent", q.query.replace(/\n$/, ""));
                q.query = q.query.endsWith("\n") ? q.query : q.query + "\n";
                socket.write(q.query)
            }
        }
    };

    /**
     * Queue Push
     *
     * @description Append query into the pending queue
     * @since 1.0.0
     * @param data Object Query data
     * @return null
     */
    let queuePush = function(data) {
        queryCount++;
        data.id = queryCount;
        queue.push(data);
        self.emit("verbose", "Queued query #" + data.id, data.query.replace("\n", ""));
        if(status === 0) processQueue()
    };

    /**
     * Queue Unshift
     *
     * @description Prepend query into the pending queue
     * @since 1.0.0
     * @param data Object Query data
     * @return null
     */
    let queueUnshift = function(data) {
        queryCount++;
        data.id = queryCount;
        queue.unshift(data);
        self.emit("verbose", "Priority query queued #" + data.id, data.query.replace("\n", ""));
        if(status === 0) processQueue()
    };

    let toTheVoid = function(err, rows, raw) {};

    /**
     * Anti Flood
     *
     * @description Set the anti-flood parameters
     * @param commands Numbers Maximum command rate
     * @param time Numbers Duration rate in seconds
     * @return Array[AFLConfig.commands, AFLConfig.time]
     */
    TeamSpeak3Client.prototype.antiFlood = function(commands, time) {

        if(typeof commands !== "number") throw new Error("AntiFlood commands must be a number!");
        if(typeof time !== "number") throw new Error("AntiFlood duration must be a number!");

        AFLConfig.commands = commands;
        AFLConfig.time = time;

        self.emit("info", "Anti Flood", "Set to " + commands + " commands maximum in " + time + " seconds");

        return [AFLConfig.commands, AFLConfig.duration];
    };

    /**
     * Get Queue
     *
     * @description Return the pending queue
     * @since 1.0.0
     * @return Array <*>
     */
    TeamSpeak3Client.prototype.getQueue = function() {
        return queue.slice(0);
    };

    /**
     * Clear Queue
     *
     * @description Clear the pending queue
     * @since 1.0.0
     * @return Boolean
     */
    TeamSpeak3Client.prototype.clearQueue = function() {
        queue = [];
        return queue === []
    };

    /**
     * Query
     *
     * @description Build the query and push it into the queue
     * @param cmd String Command name
     * @param params Object Object contains {param: value}
     * @param flags Array Array contains ["-flag"]
     * @param cb Function Callback
     * @return Promise|null
     */
    TeamSpeak3Client.prototype.query = function(cmd, params, flags, cb) {

        if(typeof cb !== "function") {
            throw new Error("The callback must be a function!")
        }

        let query = TS3Utils.buildQuery(cmd, params, flags);

        if(query instanceof Error) {
            throw new Error(query)
        }

        queuePush({cmd: cmd, params: params, flags: flags, query: query, cb: cb})
    };

    /**
     * QueryNow
     *
     * @description Execute the query ASAP
     * @param cmd String Command name
     * @param params Object Object contains {param: value}
     * @param flags Array Array contains ["-flag"]
     * @param cb Function Callback
     * @return null
     */
    TeamSpeak3Client.prototype.queryNow = function(cmd, params, flags, cb) {

        if(typeof cb !== "function") {
            throw new Error("The callback must be a function!")
        }

        let query = TS3Utils.buildQuery(cmd, params, flags);

        if(query instanceof Error) {
            throw new Error(query)
        }

        queueUnshift({cmd: cmd, params: params, flags: flags, query: query, cb: cb})
    };

    /**
     * Prepare
     *
     * @description Prepare a query to be executed later
     * @param name String Prepared statement name
     * @param query String The query
     * @return Boolean
     */
    TeamSpeak3Client.prototype.prepare = function(name, query) {

        if(typeof prepared[name] !== "undefined") {
            throw new Error("Cannot prepare `" + name + "` already exists!")
        }

        prepared[name] = query;
        self.emit("verbose", "Prepared Query", name + ": " + query)
    };

    /**
     * Execute
     *
     * @description Execute a prepared query
     * @param name String Prepared statement name
     * @param params Array Parameters to apply
     * @param cb Function Callback function
     * @return null
     */
    TeamSpeak3Client.prototype.execute = function(name, params, cb) {

        if(typeof prepared[name] === "undefined") {
            throw new Error("Cannot execute `" + name + "`, statement not found!")
        }

        // Escape all the values
        let p = params.map(function(v) {
            return TS3Utils.escape(v)
        });

        p.unshift(prepared[name]);

        // Build the final query
        let query = util.format.apply(this, p);

        // Send the query to the server
        self.send(query, cb)
    };

    /**
     * ExecuteNow
     *
     * @description Execute ASAP a prepared query
     * @param name String Prepared statement name
     * @param params Array Parameters to apply
     * @param cb Function Callback function
     * @return null
     */
    TeamSpeak3Client.prototype.executeNow = function(name, params, cb) {

        if(typeof prepared[name] === "undefined") {
            throw new Error("Cannot execute `" + name + "`, statement not found!")
        }

        // Escape all the values
        let p = params.map(function(v) {
            return TS3Utils.escape(v)
        });

        p.unshift(prepared[name]);

        // Build the final query
        let query = util.format.apply(this, p);

        // Send the query to the server
        self.sendNow(query, cb)
    };


    /**
     * Send
     *
     * @description Send raw query
     * @param query String Raw query
     * @param cb Function Callback
     * @return null
     */
    TeamSpeak3Client.prototype.send = function(query, cb) {

        if(typeof cb !== "function") {
            throw new Error("The callback must be a function!")
        }

        queuePush({query: query, cb: cb})
    };

    /**
     * Send Now
     *
     * @description Send ASAP a raw query
     * @param query String Raw query
     * @param cb Function Callback
     * @return null
     */
    TeamSpeak3Client.prototype.sendNow = function(query, cb) {

        if(typeof cb !== "function") {
            throw new Error("The callback must be a function!")
        }

        queueUnshift({query: query, cb: cb})
    };


    /**
     * Register to an event
     *
     * @param event String Event name {server|channel|textserver|textchannel|textprivate}
     * @param id Number Channel ID
     */
    TeamSpeak3Client.prototype.notifyRegister = function(event, id) {
        if(!id) {
            self.queryNow('servernotifyregister', {event}, [], function(err, rows, raw) {
                if(err.id === 0) self.emit("info", "Notify", "Registered to `" + event + "`");
            });
        } else {
            self.queryNow('servernotifyregister', {event, id}, [], function(err, rows, raw) {
                if(err.id === 0) self.emit("info", "Notify", "Registered to `" + event + "` on channel ID " + id );
            });
        }
    };

    /**
     * Unregister from all events
     */
    TeamSpeak3Client.prototype.notifyUnregister = function() {
        self.queryNow("servernotifyunregister", {}, [], function(err, rows, raw) {
            if(err.id === 0) self.emit("info", "Notify", "Unregistered from all events");
        })
    };

    TeamSpeak3Client.prototype.connect = function(host, port, whitelisted) {

        AFLConfig.whitelisted = typeof whitelisted === "boolean" ? whitelisted : false;
        socket = net.connect(port, host);

        socket.on("error", function(e) {
            self.emit("error", "Socket", e.syscall + " " + e.errno + " on " + e.host + ":" + e.port)
        });

        socket.on("connect", function() {

            // Emit the connected event with host and port
            self.emit("connected", host, port);

            let input = LineInputStream(socket);

            input.on("line", function(line) {
                let l = line.trim();

                // Skip the first two messages
                if(status < 0) {
                    status++;
                    if(status === 0) processQueue();
                    return
                }

                // If the response is a error
                if(l.indexOf("error") === 0) {
                    q.err = TS3Utils.parseResponse(l.substr("error ".length).trim())[0];
                    q.cb(q.err, q.res || [], q);
                    if(q.err.id > 0) {
                        self.emit("error", "SERVER", q.err.id + " " + q.err.msg)
                    }
                    q = null;
                    processQueue()
                    // If we have a notification
                } else if(l.indexOf("notify") === 0) {
                    let n = l.substr("notify".length);
                    let evn = n.substr(0, n.indexOf(" "));
                    let evd = TS3Utils.parseResponse(l);
                    self.emit(evn, evd);
                    self.emit("verbose", "Event " + evn, JSON.stringify(evd))
                    // Normal data set
                } else if(q) {
                    q.res = TS3Utils.parseResponse(l);
                    q.raw = l;
                    self.emit("verbose", "response", l)
                }

            })

        });

        // If the client is not on whitelist
        if(!AFLConfig.whitelisted) {

            // Trying to get the instanceinfo before any other queries
            self.sendNow("instanceinfo", function(err, rows, query) {
                if(err.id > 0) {
                    self.emit("warn", "Anti-flood", "Cannot get instanceinfo, use default anti-flood policy");
                    return
                }

                self.antiFlood(
                    rows[0].serverinstance_serverquery_flood_commands,
                    rows[0].serverinstance_serverquery_flood_time
                )
            })
        } else self.emit("warn", "Anti-flood", "Whitelist enabled! If you are not whitelisted you will probably be banned by the server!");
    }
};

util.inherits(TeamSpeak3Client, ev);
exports = module.exports = new TeamSpeak3Client();
