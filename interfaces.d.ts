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
