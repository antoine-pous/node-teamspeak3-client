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

import * as net from "net";
import * as util from "util";
import {buildQuery, escape, parseResponse} from "@ts3/query-utils";
import {EventEmitter2} from "eventemitter2";
import {isInteger} from "lodash";

export interface iAntiFlood {
    config: {
        commands: number,
        time: number,
    },
    last: {
        query: number,
        time: number,
    },
    enabled: boolean,
}

export interface iError {
    id: number,
    msg: string,
    query?: string,
}

export interface iHost {
    host: string,
    port: number,
}

export interface iQuery {
    id: number,
    query: string,
    resolve: any,
    reject: any,
    isResolved: boolean,
}

export interface iPrepared {
    [key: string]: string
}

class TS3QueryClient extends EventEmitter2 {

    private socket: any;

    /**
     * Pending queue
     * @type {Array}
     * @access private
     */
    private queue: iQuery[] = [];

    /**
     * Prepared queries
     * @type {{}}
     * @access private
     */
    private prepared: iPrepared = {};

    /**
     * Total amount of performed queries
     * @type {number}
     */
    private queryCount: number = 0;

    /**
     * Waiting time when antiflood limits are reached
     * @type {number}
     */
    private waitingTime: number = 0;

    /**
     * Query currently executed
     * @type {iQuery|null}
     */
    private currentQuery: iQuery|undefined = undefined;

    /**
     * Antiflood configuration
     * @type {{config: {commands: number; time: number}; last: {query: number; time: number}; enabled: boolean}}
     */
    private AntiFlood: iAntiFlood = {
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

    /**
     * Return the next query ID
     * @returns {number}
     */
    public getNextQueryID(): number {
        return this.queryCount + 1;
    }

    /**
     * Return the current anti flood configuration
     * @returns {iAntiFlood}
     */
    public getAntiFloodStatus(): iAntiFlood {
        return this.AntiFlood;
    }

    /**
     * Disable the anti flood feature
     * @returns {iAntiFlood}
     */
    public disableAntiFlood(): iAntiFlood {
        this.AntiFlood.enabled = false;
        return this.AntiFlood;
    }

    /**
     * Enable the anti flood feature
     * @returns {iAntiFlood}
     */
    public enableAntiFlood(): iAntiFlood {
        this.AntiFlood.enabled = true;
        return this.AntiFlood;
    }

    /**
     * Set the new limits for the anti flood feature
     * @param commands
     * @param time
     * @returns {iAntiFlood}
     */
    public setAntiFloodLimits(commands: number, time: number): iAntiFlood {

        if(!isInteger(commands))
            throw new Error("Command parameter must be an integer!");

        if(!isInteger(time))
            throw new Error("Time parameter must be an integer!");

        this.AntiFlood.config.commands = commands;
        this.AntiFlood.config.time = time;

        return this.getAntiFloodStatus();
    }

    /**
     * Determine if the client has reach the flood limits
     * @param query
     * @returns {boolean}
     */
    private isFlood(query: iQuery): boolean {

        // Anti flood disabled
        if(!this.AntiFlood.enabled)
            return false;

        let currentTime = new Date().getTime() / 1000;

        if((this.AntiFlood.last.time + this.AntiFlood.config.time) < currentTime) {
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
    private queuePush(query: string, resolve: object, reject: object): void {
        this.queryCount = this.queryCount + 1;
        this.queue.push({
            id: this.queryCount,
            query,
            resolve,
            reject,
            isResolved: false
        });
        this.emit("info", `Query #${this.queryCount} appended! "${query}"`);
    };

    /**
     * Unshift the query intor the queue list
     * @param query
     * @param resolve
     * @param reject
     */
    private queueUnshift(query: string, resolve: object, reject: object): void {
        this.queryCount = this.queryCount + 1;
        this.queue.unshift({
            id: this.queryCount,
            query,
            resolve,
            reject,
            isResolved: false
        });
        this.emit("info", `Query #${this.queryCount} prepended! "${query}"`);
    };

    /**
     * Process queue
     */
    private processQueue() {

        if(!this.currentQuery) {

            if(this.queue.length >= 1) {

                if (!this.isFlood(this.queue[0])) {

                    this.currentQuery = this.queue.shift();

                    if(!this.currentQuery) {
                        this.emit("info", "khjh")
                        return;
                    }

                    if (!this.currentQuery.query.endsWith("\n")) {
                        this.currentQuery.query = `${this.currentQuery.query}\n`;
                    }

                    this.emit("info", `Query #${this.currentQuery.id} sent! ${this.currentQuery.query.replace("\n", "")}`);
                    this.socket.write(this.currentQuery.query);

                } else {

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
     * Return the queue
     * @returns {iQuery[]}
     */
    public getQueue(): iQuery[] {
        return this.queue;
    }

    /**
     * Clear the queue list
     * @returns {boolean}
     */
    public clearQueue(): boolean {
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
    public query(cmd: string, params: object, flags: string[]): Promise<any> {

        return new Promise((resolve, reject) => {

            let query = buildQuery(cmd, params, flags);

            this.queuePush(query, resolve, reject);
        });

    };

    /**
     * Build a query from parameters and prepend it to the queue list
     * @param cmd
     * @param params
     * @param flags
     * @returns {Promise}
     */
    public queryNow(cmd: string, params: object, flags: string[]): Promise<any> {

        return new Promise<any>((resolve, reject) => {

            let query = buildQuery(cmd, params, flags);

            this.queueUnshift(query, resolve, reject);
        });

    };

    /**
     * Prepare a query and store it into the prepared list
     * @param name
     * @param query
     * @returns {boolean}
     */
    public prepare(name: string, query: string): boolean {

        if(this.prepared.hasOwnProperty(name)) {
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
    public execute(name: string, params: any[]): Promise<any> {

        return new Promise<any>((resolve, reject) => {

            if(!this.prepared.hasOwnProperty(name)) {
                let err = `${name} is not a valid prepared query!`;
                this.emit("error", err);
                return reject(err);
            }

            // Escape all the values
            let p: string[] = params.map((v: string) => {
                return escape(v)
            });

            p.unshift(this.prepared[name]);

            this.queuePush(util.format.apply(util, p), resolve, reject);
        });
    };

    /**
     * Prepend a prepared query to the queue list
     * @param name
     * @param params
     * @returns {Promise}
     */
    public executeNow(name: string, params: any[]): Promise<any> {

        return new Promise<any>((resolve, reject) => {

            if(!this.prepared.hasOwnProperty(name)) {
                let err = `${name} is not a valid prepared query!`;
                this.emit("error", err);
                return reject(err);
            }

            // Escape all the values
            let p: string[] = params.map((v: string) => {
                return escape(v)
            });

            p.unshift(this.prepared[name]);

            this.queueUnshift(util.format.apply(util, p), resolve, reject);
        });
    };

    /**
     * Append the query to the queue
     * @param query
     * @returns {Promise}
     */
    public send(query: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.queuePush(query, resolve, reject);
            this.processQueue();
        });
    }

    /**
     * Prepend the query to the queue
     * @param query
     * @returns {Promise}
     */
    public sendNow(query: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.queueUnshift(query, resolve, reject);
            this.processQueue();
        });
    }

    /**
     * Connect to the server and wait for instructions
     * @param host
     * @param port
     * @returns {Promise<iError>}
     */
    public connect(host: string, port: number) {

        return new Promise<iError>((resolve, reject) => {

            if(!isInteger(port))
                throw new Error('Port must be an integer!');

            this.socket = net.connect(port, host);

            this.socket.on('error', (error: Error) => {
                this.emit('error', {id: 9000, msg: error.message});
                reject({id: 9000, msg: error.message});
            });

            this.socket.on('end', () => {
                this.emit('end');
                reject({id: 9000, msg: "END"});
            });

            this.socket.on('close', () => {
                this.emit('close');
                reject({id: 9000, msg: "CLOSE"});
            });

            this.socket.on("connect", () => {
                this.emit("connect", host, port);
                resolve({id: 0, msg: "ok"});
            });

            this.socket.on("data", (chunk: string) => {

                let lines = `${chunk}`.split("\n");

                lines.forEach(data => {

                    if(data === "\r") return;

                    let res: any;
                    let evtName: string = '';

                    if(this.currentQuery && data.startsWith("error")) {
                        evtName = "error";
                        res = parseResponse(data.substr(evtName.length));
                        res[0].query = this.currentQuery.query;
                        if(res[0].id > 0) this.currentQuery.reject(res[0]);
                        if(res[0].id === 0 && this.currentQuery.isResolved === false) {
                            this.currentQuery.resolve(true);
                        }
                    } else if(this.currentQuery && data.indexOf("notify") === 0) {
                        let evt = data.substr("notify".length);
                        evtName = evt.substr(0, evt.indexOf(" "));
                        res = parseResponse(evt.substr(evt.indexOf(" ", evt.length)));
                        this.currentQuery.resolve(res[0]);
                        this.currentQuery.isResolved = true;
                    } else if(this.currentQuery) {
                        res = parseResponse(data);
                        evtName = this.currentQuery.query.substr(0, this.currentQuery.query.indexOf(" "));
                        this.currentQuery.resolve(res);
                    }

                    this.emit(`${evtName}`, res);
                    if(evtName === "error") this.currentQuery = undefined;
                    this.processQueue();
                });

            });

        })
    }

}

export default TS3QueryClient;