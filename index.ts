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
import {iAntiFlood, iError, iPrepared, iQuery, iUploadInit} from "./interfaces";
import {readFile, stat, Stats} from "fs";

export default class TS3QueryClient extends EventEmitter2 {

    private socket: any;

    /**
     * Carriage return
     * @type {string}
     */
    private cr: string = "\r";

    private data: string = "";

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
     * Return the amount of queued pending queries
     * @returns {number}
     */
    public getPendingQueryCount(): number {
        return this.queue.length;
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
        this.emit("warn", "AntiFlood disabled, if your Query Client IP is not whitelisted it probably be banned by the server!");
        return this.AntiFlood;
    }

    /**
     * Enable the anti flood feature
     * @returns {iAntiFlood}
     */
    public enableAntiFlood(): iAntiFlood {
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
    public setAntiFloodLimits(commands: number, time: number): iAntiFlood {

        if(!isInteger(commands))
            throw new Error("Command parameter must be an integer!");

        if(!isInteger(time))
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

                if(!this.isFlood(this.queue[0])) {

                    this.currentQuery = this.queue.shift();

                    if(!this.currentQuery) {
                        this.emit("info", "Haven't current query!");
                        return;
                    }

                    if (!this.currentQuery.query.endsWith("\n")) {
                        this.currentQuery.query = `${this.currentQuery.query}\n`;
                    }

                    if(!this.socket) {
                        this.emit("error", {id: 9000, msg: "Socket is not open!"});
                        return;
                    }

                    if(this.currentQuery.query.startsWith("help")) {
                        let err: iError = {id: 9000, msg: "Help command cannot be parsed, read the TS Server Query manual"};
                        this.emit("error", err);
                        this.currentQuery.reject(err);
                        this.processQueue();
                        return;
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
     *
     * @param data {string} Data to parse
     */
    private readData(data: string) {
        if(this.currentQuery && data.startsWith("error")) {
            let res: any = parseResponse(data.substr("error".length));
            res[0].query = this.currentQuery.query;
            if(res[0].id > 0) this.currentQuery.reject(res[0]);
            if(res[0].id === 0 && this.currentQuery.isResolved === false) {
                this.currentQuery.resolve(true);
            }
            this.emit("error", res[0]);
            delete this.currentQuery;
        } else if(data.indexOf("notify") === 0) {
            let evt = data.substr("notify".length);
            let evtName = evt.substr(0, evt.indexOf(" "));
            let res: any = parseResponse(evt.substr(evtName.length, evt.length));
            this.emit(evtName, res);
        } else if(this.currentQuery) {
            let res: any = parseResponse(data);
            this.currentQuery.resolve(res);
            this.currentQuery.isResolved = true;
        }

        this.processQueue();
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

        return new Promise<any>((resolve, reject) => {

            let query = buildQuery(cmd, params, flags);

            this.queuePush(query, resolve, reject);
            this.processQueue();
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
            this.processQueue();
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
                let err = {id: 9000, msg: `${name} is not a valid prepared query!`};
                this.emit("error", err);
                return reject(err);
            }

            // Escape all the values
            let p: string[] = params.map((v: string) => {
                return escape(v)
            });

            p.unshift(this.prepared[name]);

            this.queuePush(util.format.apply(util, p), resolve, reject);
            this.processQueue();
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
            this.processQueue();
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
     * Upload a file through the TeamSpeak 3 files interface
     * @param name
     * @param dest
     * @param cid
     * @param overwrite
     * @param resume
     * @param cpw
     * @returns {Promise<any>}
     */
    public uploadFile(src: string, dest: string, cid: number, overwrite: 0|1, resume: 0|1, cpw?: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {

            stat(src, (err: NodeJS.ErrnoException, stats: Stats) => {

                if(err)
                    return reject({id: 9000, msg: err.message});

                if(!stats.isFile())
                    return reject({id: 9000, msg: "uploadFile expect a file path!"});

                if(!dest.startsWith('/'))
                    dest = `/${dest}`;

                let cfg: iUploadInit = { clientftfid: this.queryCount + 1, name: dest, cid, size: stats.size, overwrite, resume, cpw: cpw || '' };

                this.query("ftinitupload", cfg, []).then((ftinit: any) => {
                    let ft = ftinit[0];

                    if(ft.status)
                        reject({id: ft.status, msg: ft.msg});

                    let ftsocket = net.connect(ft.port, this.socket.address().address);

                    ftsocket.on('error', (err: Error) => {
                        this.emit('error', {id: 9000, msg: `(FT) ${err.message}`});
                        reject({id: 9000, msg: `(FT) ${err.message}`});
                    });

                    ftsocket.on('end', () => {
                        this.emit('ftend');
                        resolve(true);
                    });

                    ftsocket.on('close', () => {
                        this.emit('ftclose');
                        reject({id: 9000, msg: "CLOSE"});
                    });

                    ftsocket.on("connect", () => {
                        this.emit("ftconnect");

                        readFile(src, (err: NodeJS.ErrnoException, data: Buffer) => {

                            if(err)
                                reject({id: 9000, msg: `(FT) ${err.message}`})

                            ftsocket.write(ft.ftkey);
                            ftsocket.read();
                            ftsocket.write(data);
                        });
                    });


                }, (e: iError) => {
                    reject(e);
                });
            });

        });

    }

    /**
     * Connect to the server and wait for instructions
     * @param host
     * @param port
     * @returns {Promise}
     */
    public connect(host: string, port: number): Promise<any> {

        return new Promise<any>((resolve, reject) => {

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
                this.emit("connect");
                resolve(true);
            });

            this.socket.on("data", (chunk: string) => {

                this.data += chunk;
                let lines: string[] = this.data.split("\n");
                this.data = lines.pop() || "";

                lines.forEach(line => {

                    if(line === this.cr || line === "") return;

                    if(line.startsWith(this.cr))
                        line = line.substr(this.cr.length, line.length);

                    if(line.endsWith(this.cr))
                        line = line.substr(0, line.length - this.cr.length);

                    this.readData(line);
                });

            });

        })
    }

}
