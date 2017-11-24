import { EventEmitter2 } from "eventemitter2";
export interface iAntiFlood {
    config: {
        commands: number;
        time: number;
    };
    last: {
        query: number;
        time: number;
    };
    enabled: boolean;
}
export interface iError {
    id: number;
    msg: string;
    query?: string;
}
export interface iHost {
    host: string;
    port: number;
}
export interface iQuery {
    id: number;
    query: string;
    resolve: any;
    reject: any;
    isResolved: boolean;
}
export interface iPrepared {
    [key: string]: string;
}
declare class TS3QueryClient extends EventEmitter2 {
    private socket;
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
     * Connect to the server and wait for instructions
     * @param host
     * @param port
     * @returns {Promise<iError>}
     */
    connect(host: string, port: number): Promise<iError>;
}
export default TS3QueryClient;
