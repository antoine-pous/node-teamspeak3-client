"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
let host = "127.0.0.1";
let port = 10011;
let vport = 9987;
let user = "serveradmin";
let pass = "fernand";
let shutdown = (i = 1) => {
    console.log(`Process exit ${i}`);
    process.exit(i);
};
(() => __awaiter(this, void 0, void 0, function* () {
    let TS3Client = new index_1.default;
    TS3Client.on("connect", () => {
        console.log(`connected to ${host}:${port}!`);
    });
    TS3Client.on("error", (error) => {
        if (error.id > 0)
            console.log(error);
    });
    TS3Client.on("warn", warn => {
        console.log(warn);
    });
    TS3Client.on("info", (info) => {
        console.log(info);
    });
    TS3Client.disableAntiFlood();
    TS3Client.prepare("login", "login %s %s");
    TS3Client.prepare("clientlist", "clientlist");
    yield TS3Client.connect(host, port).catch((e) => {
        console.log(e.id, e.msg);
        shutdown();
    });
    let logged = yield TS3Client.execute("login", [user, pass]).catch((e) => {
        console.log(e.id, e.msg);
        shutdown();
    });
    if (!logged)
        return shutdown();
    console.log("logged in!");
    yield TS3Client.send(`use port=${vport}`).catch((e) => {
        console.log(e.id, e.msg);
    });
    console.log(`Used ${vport}!`);
    let clientlist = yield TS3Client.execute(`clientlist`, []).catch((e) => {
        console.log(e.id, e.msg);
    });
    console.log(clientlist.length);
}))();
