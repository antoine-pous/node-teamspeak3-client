import { EventEmitter2 } from "eventemitter2";
import { iAntiFlood, iQuery } from "./interfaces";
export default class TS3QueryClient extends EventEmitter2 {
    private socket;
    /**
     * Carriage return
     * @type {string}
     */
    private cr;
    private data;
    /**
     * Pending queue
     * @type {Array}
     * @access private
     */
    private queue;
    /**
     * Prepared queries
     * @type {{}}
     * @access private
     */
    private prepared;
    /**
     * Total amount of performed queries
     * @type {number}
     */
    private queryCount;
    /**
     * Waiting time when antiflood limits are reached
     * @type {number}
     */
    private waitingTime;
    /**
     * Query currently executed
     * @type {iQuery|null}
     */
    private currentQuery;
    /**
     * Antiflood configuration
     * @type {{config: {commands: number; time: number}; last: {query: number; time: number}; enabled: boolean}}
     */
    private AntiFlood;
    /**
     * Return the next query ID
     * @returns {number}
     */
    getNextQueryID(): number;
    /**
     * Return the amount of queued pending queries
     * @returns {number}
     */
    getPendingQueryCount(): number;
    /**
     * Return the current anti flood configuration
     * @returns {iAntiFlood}
     */
    getAntiFloodStatus(): iAntiFlood;
    /**
     * Disable the anti flood feature
     * @returns {iAntiFlood}
     */
    disableAntiFlood(): iAntiFlood;
    /**
     * Enable the anti flood feature
     * @returns {iAntiFlood}
     */
    enableAntiFlood(): iAntiFlood;
    /**
     * Set the new limits for the anti flood feature
     * @param commands
     * @param time
     * @returns {iAntiFlood}
     */
    setAntiFloodLimits(commands: number, time: number): iAntiFlood;
    /**
     * Determine if the client has reach the flood limits
     * @param query
     * @returns {boolean}
     */
    private isFlood(query);
    /**
     * Push the query into the queue list
     * @param query
     * @param resolve
     * @param reject
     */
    private queuePush(query, resolve, reject);
    /**
     * Unshift the query intor the queue list
     * @param query
     * @param resolve
     * @param reject
     */
    private queueUnshift(query, resolve, reject);
    /**
     * Process queue
     */
    private processQueue();
    /**
     *
     * @param data {string} Data to parse
     */
    private readData(data);
    /**
     * Return the queue
     * @returns {iQuery[]}
     */
    getQueue(): iQuery[];
    /**
     * Clear the queue list
     * @returns {boolean}
     */
    clearQueue(): boolean;
    /**
     * Build a query from parameters and append it to the queue list
     * @param cmd
     * @param params
     * @param flags
     * @returns {Promise}
     */
    query(cmd: string, params: object, flags: string[]): Promise<any>;
    /**
     * Build a query from parameters and prepend it to the queue list
     * @param cmd
     * @param params
     * @param flags
     * @returns {Promise}
     */
    queryNow(cmd: string, params: object, flags: string[]): Promise<any>;
    /**
     * Prepare a query and store it into the prepared list
     * @param name
     * @param query
     * @returns {boolean}
     */
    prepare(name: string, query: string): boolean;
    /**
     * Append a prepared query to the queue list
     * @param name
     * @param params
     * @returns {Promise}
     */
    execute(name: string, params: any[]): Promise<any>;
    /**
     * Prepend a prepared query to the queue list
     * @param name
     * @param params
     * @returns {Promise}
     */
    executeNow(name: string, params: any[]): Promise<any>;
    /**
     * Append the query to the queue
     * @param query
     * @returns {Promise}
     */
    send(query: string): Promise<any>;
    /**
     * Prepend the query to the queue
     * @param query
     * @returns {Promise}
     */
    sendNow(query: string): Promise<any>;
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
    uploadFile(src: string, dest: string, cid: number, overwrite: 0 | 1, resume: 0 | 1, cpw?: string): Promise<any>;
    /**
     * Connect to the server and wait for instructions
     * @param host
     * @param port
     * @returns {Promise}
     */
    connect(host: string, port: number): Promise<any>;
}
