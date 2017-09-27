# teamspeak3-client
TeamSpeak3 ServerQuery Client

[![Build Status](https://travis-ci.org/antoine-pous/node-teamspeak3-client.svg?branch=master)](https://travis-ci.org/antoine-pous/node-teamspeak3-client)
[![Dependency Status](https://gemnasium.com/badges/github.com/antoine-pous/node-teamspeak3-client.svg)](https://gemnasium.com/github.com/antoine-pous/node-teamspeak3-client)
[![Donate](https://img.shields.io/badge/%E2%99%A5-donate-459042.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=MAKZLQGRSBCT2)

## Installation
```console
$ npm install teamspeak3-client --save
```

### Connect to the server
```js
let TS3Client = require('teamspeak3-client');

// Wait for the connection event
TS3Client.on('connected', function() {

  // Do the stuff...

});

TS3Client.connect(host, port, whitelisted);
```

### Querying the server
Each time the queries provide 3 objects to your callback :

- `err` An object wich contains the error `id` and `msg` from the server
- `rows` An array of objects, each offset is a row `[{row 1},{row 2},...]`
- `query` An object wich contains all informations about the query

#### Anti Flood
The client is provided with an anti-flood feature, when the client connect to the serverinstance it get the `instanceinfo`.

If these informations are not available the client use the default values. You can enforce theses values, ask your hoster about the flood rate 
limit if you are banned with the default values.

```js
// force the client to send 10 queries max each 3 seconds
ts3client.antiFlood(10, 3);
```
#### The whitelist
If your client is whitelisted on the serverinstance you can allow the client to perform each request ASAP by 
setting the third argument to `true`

```js
// Connect to the server
TS3Client.connect('127.0.0.1', 10011, true)
```

**Important:** If you enable this feature while you are not whitelisted the client will be banned.

#### Debug your queries
During the development you can listen the `verbose` event. This event provide a prefix and the log entry. The prefix is the component of the client wich emit the log

```js
TS3Client.on("verbose", function(prefix, entry) {
  let log = require("npmlogger"); // Use your favorite logger
  log.verbose(prefix, entry)
})
```

#### Build and send your query
You can build and escape your queries easily. If you want send the query in priority you can use `queryNow`.

```js
TS3Client.query('serveredit', {virtualserver_name:'TeamSpeak ]|[ Server'}, [], function(err, rows, query) {

  // If the server return an error
  if(err.id > 0) throw new Error(err.msg);
})
```

#### Send query
If you need you can send raw queries, they are **not** escaped. If you want send the query in priority you can use `sendNow`.
```js
let newName = TS3Client.utils.escape('TeamSpeak ]|[ Server');

TS3Client.send(`serveredit virtualserver_name=${newName}`, function(err, rows, query) {

  // If the server return an error
  if(err.id > 0) throw new Error(err.msg);
})
```

#### Prepared queries
For more efficience you can set a lots of prepared querie, this is a good way to reuse the same queries 
in many places with differents values.

If you want execute the query in priority you can use `executeNow`.

**Note:** You must respect the arguments list order used in your query
```js
// Prepare the queries
TS3Client.prepare('serverEdit', 'serveredit virtualserver_name=%s virtualserver_password=%s');
TS3Client.prepare('setVServerMaxClients', 'serveredit virtualserver_maxclients=%d');

// Execute the query, the values are escaped using teamspeak3-utils
TS3Client.execute('serverEdit', ['TeamSpeak ]|[ Server', 'newPassword'], function(err, rows, query) {

  // If the server return an error
  if(err.id > 0) throw new Error(err.msg);

  console.log(rows)
  // Do the stuff...
});

TS3Client.execute('setVServerMaxClients', ['numbers expected']);
```

### Listen server events
This client provide an simple way to listen the server events, the full event list is available in your server documentation.

**Note:** You have to register the event with the method `.notifyRegister(eventName)` and remove `notify` from the event name to catch them

```js
// Listen for clients enter in query client view
TS3Client.on("cliententerview", function(clients) {
    clients.forEach(client => {
        console.log(client.client_nickname + ' join the server !');
        // Do the stuff...
    })
});

// Subscribe to the server events
TS3Client.notifyRegister('server');

// Unsubscribe from all events
TS3Client.notifyUnregister();
```

### Use teamspeak3-utils
teamspeak3-utils is embedded to the client, this approach allow you to use it easily.

```js
let TS3Client = require('teamspeak3-client')

TS3Client.utils.escape('Hello World!') // Hello\sWorld!
```
