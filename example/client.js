"use strict";

let TS3Client = require("../teamspeak3-client");
let TS3Definitions = require("teamspeak3-utils/definitions");

// Client configuration
let host = '127.0.0.1';
let port = 10011;
let login = 'serveradmin';
let pass = 'fernand';
let whitelisted = true;

// Listen for client enter in query client view
TS3Client.on("cliententerview", function(clients) {
    clients.forEach(client => {
        console.log(client.client_nickname + ' join the server !');

        // Send welcome message to the client
        TS3Client.execute('hi', [client.clid, client.client_nickname], (err, rows, raw) => {
            if(err.id > 0) console.log(err.msg);
        });
    });
});

// Listen for client left query client view
TS3Client.on("clientleftview", function(clients) {
    clients.forEach(client => {
        console.log('A client left the server !')
    });
});

// Listen text messages
TS3Client.on("textmessage", function(msg) {
    msg.forEach(entry => {
        // If we received `!unregister` from private messages we unregister from all events
        if(entry.msg === "!unregister" && entry.targetmode === TS3Definitions.TextMessageTarget_CLIENT) TS3Client.notifyUnregister();
    });
});

TS3Client.on("error", function(prefix, entry) {
    console.error(prefix, entry)
});

TS3Client.on("info", function(prefix, entry) {
    console.info(prefix, entry)
});

TS3Client.on("warn", function(prefix, entry) {
    console.warn(prefix, entry)
});

TS3Client.on("verbose", function(prefix, entry) {
    console.debug(prefix, entry)
});

// Prepare some usefull queries
TS3Client.prepare('login', 'login client_login_name=%s client_login_password=%s');
TS3Client.prepare('kickFromServer', `clientkick clid=%d reasonid=${TS3Definitions.REASON_KICK_SERVER} reasonmsg=%s`);
TS3Client.prepare('usePort', 'use port=%d');
TS3Client.prepare('hi', `sendtextmessage targetmode=${TS3Definitions.TextMessageTarget_CLIENT} target=%d msg=Hi\\s%s!`);

// Wait for the connection
TS3Client.on("connected", function() {

    //let [cmd, time] = TS3Client.antiFlood(10, 3);
    //console.log(`The new antiflood policy is ${cmd} in ${time}s`)

    // Login with account (see prepared query)
    TS3Client.executeNow('login', [login, pass], function(err, res, query) {

        // If we have an error
        if(err.id > 0) return;

        // Use virtual server
        TS3Client.executeNow('usePort', [9987], function(err, res, query) {

            // If we have an error
            if(err.id > 0) return;

            // Register to server events
            TS3Client.notifyRegister("server");
            TS3Client.notifyRegister("textprivate");

        })

    })

});

// Init the client
TS3Client.connect(host, port, whitelisted);
