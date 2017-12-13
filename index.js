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
Object.defineProperty(exports, "__esModule", { value: true });
const net = require("net");
const util = require("util");
const query_utils_1 = require("@ts3/query-utils");
const eventemitter2_1 = require("eventemitter2");
const lodash_1 = require("lodash");
class TS3QueryClient extends eventemitter2_1.EventEmitter2 {
    constructor() {
        super(...arguments);
        /**
         * Carriage return
         * @type {string}
         */
        this.cr = "\r";
        this.data = "";
        /**
         * Pending queue
         * @type {Array}
         * @access private
         */
        this.queue = [];
        /**
         * Prepared queries
         * @type {{}}
         * @access private
         */
        this.prepared = {};
        /**
         * Total amount of performed queries
         * @type {number}
         */
        this.queryCount = 0;
        /**
         * Waiting time when antiflood limits are reached
         * @type {number}
         */
        this.waitingTime = 0;
        /**
         * Query currently executed
         * @type {iQuery|null}
         */
        this.currentQuery = undefined;
        /**
         * Antiflood configuration
         * @type {{config: {commands: number; time: number}; last: {query: number; time: number}; enabled: boolean}}
         */
        this.AntiFlood = {
            config: {
                commands: 10,
                time: 3,
            },
            last: {
                query: 0,
                time: 0,
            },
            enabled: true,
        };
    }
    /**
     * Return the next query ID
     * @returns {number}
     */
    getNextQueryID() {
        return this.queryCount + 1;
    }
    /**
     * Return the amount of queued pending queries
     * @returns {number}
     */
    getPendingQueryCount() {
        return this.queue.length;
    }
    /**
     * Return the current anti flood configuration
     * @returns {iAntiFlood}
     */
    getAntiFloodStatus() {
        return this.AntiFlood;
    }
    /**
     * Disable the anti flood feature
     * @returns {iAntiFlood}
     */
    disableAntiFlood() {
        this.AntiFlood.enabled = false;
        this.emit("warn", "AntiFlood disabled, if your Query Client IP is not whitelisted it probably be banned by the server!");
        return this.AntiFlood;
    }
    /**
     * Enable the anti flood feature
     * @returns {iAntiFlood}
     */
    enableAntiFlood() {
        this.AntiFlood.enabled = true;
        this.emit("info", "AntiFlood enabled, the client may become slow if you try to perform too much queries at the same time");
        return this.AntiFlood;
    }
    /**
     * Set the new limits for the anti flood feature
     * @param commands
     * @param time
     * @returns {iAntiFlood}
     */
    setAntiFloodLimits(commands, time) {
        if (!lodash_1.isInteger(commands))
            throw new Error("Command parameter must be an integer!");
        if (!lodash_1.isInteger(time))
            throw new Error("Time parameter must be an integer!");
        this.AntiFlood.config.commands = commands;
        this.AntiFlood.config.time = time;
        this.emit("info", `AntiFlood policy updated to ${commands} commands in ${time} seconds`);
        return this.getAntiFloodStatus();
    }
    /**
     * Determine if the client has reach the flood limits
     * @param query
     * @returns {boolean}
     */
    isFlood(query) {
        // Anti flood disabled
        if (!this.AntiFlood.enabled)
            return false;
        let currentTime = new Date().getTime() / 1000;
        if ((this.AntiFlood.last.time + this.AntiFlood.config.time) < currentTime) {
            this.AntiFlood.last.time = currentTime;
            this.AntiFlood.last.query = query.id;
            return false;
        }
        return (query.id - this.AntiFlood.config.commands) >= this.AntiFlood.last.query;
    }
    /**
     * Push the query into the queue list
     * @param query
     * @param resolve
     * @param reject
     */
    queuePush(query, resolve, reject) {
        this.queryCount = this.queryCount + 1;
        this.queue.push({
            id: this.queryCount,
            query,
            resolve,
            reject,
            isResolved: false
        });
        this.emit("info", `Query #${this.queryCount} appended! "${query}"`);
    }
    ;
    /**
     * Unshift the query intor the queue list
     * @param query
     * @param resolve
     * @param reject
     */
    queueUnshift(query, resolve, reject) {
        this.queryCount = this.queryCount + 1;
        this.queue.unshift({
            id: this.queryCount,
            query,
            resolve,
            reject,
            isResolved: false
        });
        this.emit("info", `Query #${this.queryCount} prepended! "${query}"`);
    }
    ;
    /**
     * Process queue
     */
    processQueue() {
        if (!this.currentQuery) {
            if (this.queue.length >= 1) {
                if (!this.isFlood(this.queue[0])) {
                    this.currentQuery = this.queue.shift();
                    if (!this.currentQuery) {
                        this.emit("info", "Haven't current query!");
                        return;
                    }
                    if (!this.currentQuery.query.endsWith("\n")) {
                        this.currentQuery.query = `${this.currentQuery.query}\n`;
                    }
                    if (!this.socket) {
                        this.emit("error", { id: 9000, msg: "Socket is not open!" });
                        return;
                    }
                    this.emit("info", `Query #${this.currentQuery.id} sent! ${this.currentQuery.query.replace("\n", "")}`);
                    this.socket.write(this.currentQuery.query);
                }
                else {
                    let waitingTime = (new Date().getTime() / 1000) - this.AntiFlood.last.time;
                    this.emit("warn", `AntiFlood limit reached! Waiting ${this.waitingTime} seconds`);
                    setTimeout(() => {
                        this.processQueue();
                    }, this.waitingTime * 1000);
                }
            }
        }
    }
    /**
     *
     * @param data {string} Data to parse
     */
    readData(data) {
        if (this.currentQuery && data.startsWith("error")) {
            let res = query_utils_1.parseResponse(data.substr("error".length));
            res[0].query = this.currentQuery.query;
            if (res[0].id > 0)
                this.currentQuery.reject(res[0]);
            if (res[0].id === 0 && this.currentQuery.isResolved === false) {
                this.currentQuery.resolve(true);
            }
            this.emit("error", res[0]);
            delete this.currentQuery;
        }
        else if (this.currentQuery && data.indexOf("notify") === 0) {
            let evt = data.substr("notify".length);
            let evtName = evt.substr(0, evt.indexOf(" "));
            let res = query_utils_1.parseResponse(evt.substr(evt.indexOf(" ", evt.length)));
            this.currentQuery.resolve(res);
            this.currentQuery.isResolved = true;
            this.emit(evtName, res);
        }
        else if (this.currentQuery) {
            let res = query_utils_1.parseResponse(data);
            this.currentQuery.resolve(res);
        }
        this.processQueue();
    }
    /**
     * Return the queue
     * @returns {iQuery[]}
     */
    getQueue() {
        return this.queue;
    }
    /**
     * Clear the queue list
     * @returns {boolean}
     */
    clearQueue() {
        this.queue = [];
        return this.queue === [];
    }
    /**
     * Build a query from parameters and append it to the queue list
     * @param cmd
     * @param params
     * @param flags
     * @returns {Promise}
     */
    query(cmd, params, flags) {
        return new Promise((resolve, reject) => {
            let query = query_utils_1.buildQuery(cmd, params, flags);
            this.queuePush(query, resolve, reject);
            this.processQueue();
        });
    }
    ;
    /**
     * Build a query from parameters and prepend it to the queue list
     * @param cmd
     * @param params
     * @param flags
     * @returns {Promise}
     */
    queryNow(cmd, params, flags) {
        return new Promise((resolve, reject) => {
            let query = query_utils_1.buildQuery(cmd, params, flags);
            this.queueUnshift(query, resolve, reject);
            this.processQueue();
        });
    }
    ;
    /**
     * Prepare a query and store it into the prepared list
     * @param name
     * @param query
     * @returns {boolean}
     */
    prepare(name, query) {
        if (this.prepared.hasOwnProperty(name)) {
            this.emit("error", `${name} is already a registered prepared query`);
            return false;
        }
        this.prepared[name] = query;
        this.emit("info", `Prepared query ${name}: ${query}`);
        return true;
    }
    /**
     * Append a prepared query to the queue list
     * @param name
     * @param params
     * @returns {Promise}
     */
    execute(name, params) {
        return new Promise((resolve, reject) => {
            if (!this.prepared.hasOwnProperty(name)) {
                let err = `${name} is not a valid prepared query!`;
                this.emit("error", err);
                return reject(err);
            }
            // Escape all the values
            let p = params.map((v) => {
                return query_utils_1.escape(v);
            });
            p.unshift(this.prepared[name]);
            this.queuePush(util.format.apply(util, p), resolve, reject);
            this.processQueue();
        });
    }
    ;
    /**
     * Prepend a prepared query to the queue list
     * @param name
     * @param params
     * @returns {Promise}
     */
    executeNow(name, params) {
        return new Promise((resolve, reject) => {
            if (!this.prepared.hasOwnProperty(name)) {
                let err = `${name} is not a valid prepared query!`;
                this.emit("error", err);
                return reject(err);
            }
            // Escape all the values
            let p = params.map((v) => {
                return query_utils_1.escape(v);
            });
            p.unshift(this.prepared[name]);
            this.queueUnshift(util.format.apply(util, p), resolve, reject);
            this.processQueue();
        });
    }
    ;
    /**
     * Append the query to the queue
     * @param query
     * @returns {Promise}
     */
    send(query) {
        return new Promise((resolve, reject) => {
            this.queuePush(query, resolve, reject);
            this.processQueue();
        });
    }
    /**
     * Prepend the query to the queue
     * @param query
     * @returns {Promise}
     */
    sendNow(query) {
        return new Promise((resolve, reject) => {
            this.queueUnshift(query, resolve, reject);
            this.processQueue();
        });
    }
    /**
     * Connect to the server and wait for instructions
     * @param host
     * @param port
     * @returns {Promise}
     */
    connect(host, port) {
        return new Promise((resolve, reject) => {
            if (!lodash_1.isInteger(port))
                throw new Error('Port must be an integer!');
            this.socket = net.connect(port, host);
            this.socket.on('error', (error) => {
                this.emit('error', { id: 9000, msg: error.message });
                reject({ id: 9000, msg: error.message });
            });
            this.socket.on('end', () => {
                this.emit('end');
                reject({ id: 9000, msg: "END" });
            });
            this.socket.on('close', () => {
                this.emit('close');
                reject({ id: 9000, msg: "CLOSE" });
            });
            this.socket.on("connect", () => {
                this.emit("connect");
                resolve(true);
            });
            this.socket.on("data", (chunk) => {
                this.data += chunk;
                let lines = this.data.split("\n");
                this.data = lines.pop() || "";
                lines.forEach(line => {
                    if (line === this.cr || line === "")
                        return;
                    if (line.startsWith(this.cr))
                        line = line.substr(this.cr.length, line.length);
                    if (line.endsWith(this.cr))
                        line = line.substr(0, line.length - this.cr.length);
                    this.readData(line);
                });
            });
        });
    }
}
exports.default = TS3QueryClient;
