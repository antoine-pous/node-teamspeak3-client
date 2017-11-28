import QueryClient from "../index";
import {iError} from "../interfaces";

let host: string = "127.0.0.1";
let port: number = 10011;
let vport: number = 9987;
let user: string = "serveradmin";
let pass: string = "fernand";

let shutdown = (i: number = 1) => {
    console.log(`Process exit ${i}`);
    process.exit(i);
};

(async () => {

    let TS3Client = new QueryClient;

    TS3Client.on("connect", () => {
        console.log(`connected to ${host}:${port}!`)
    });

    TS3Client.on("error", (error) => {

        if(error.id > 0) console.log(error);
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

    await TS3Client.connect(host, port).catch((e: iError) => {
        console.log(e.id, e.msg);
        shutdown();
    });

    let logged = await TS3Client.execute("login", [user, pass]).catch((e: iError) => {
        console.log(e.id, e.msg);
        shutdown();
    });

    if(!logged) return shutdown();

    console.log("logged in!");

    await TS3Client.send(`use port=${vport}`).catch((e: iError) => {
        console.log(e.id, e.msg);
    });

    console.log(`Used ${vport}!`);

    let clientlist = await TS3Client.execute(`clientlist`, []).catch((e: iError) => {
        console.log(e.id, e.msg);
     });

    console.log(clientlist.length);

})();
