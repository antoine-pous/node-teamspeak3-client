# TeamSpeak 3 TypeScript Query Client
TeamSpeak3 ServerQuery Client

[![Build Status](https://travis-ci.org/antoine-pous/node-teamspeak3-client.svg?branch=master)](https://travis-ci.org/antoine-pous/node-teamspeak3-client)
[![Dependency Status](https://gemnasium.com/badges/github.com/antoine-pous/node-teamspeak3-client.svg)](https://gemnasium.com/github.com/antoine-pous/node-teamspeak3-client)
![](https://img.shields.io/badge/TS3_server_version-3.0.13.8-blue.svg)
[![Donate](https://img.shields.io/badge/%E2%99%A5-donate-459042.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=MAKZLQGRSBCT2)

This client is designed to help you to create your own application wich need to communicate with the TeamSpeak 3 Server through the ServerQuery API.

// TODO : Socket error are emitted with id `9000`

## Installation
```console
$ npm install @ts3/query-client --save
```

## Introduction
Since the version 3, the client do not use anymore the callback and implement exclusively the promises. 

Promises are resolved when the error ID is equal to 0 and rejected when the error ID is equal or greater than 1.

Promises resolved without received data from the server return true, if the promise return data it's always in an Array.

### Events
The client emit a lot of events, they allow you to debug and write your logfiles as you want.

| Event name | Arguments | Description
---|---|---
info | {string} msg | Give info message
error | {iError} err | Error object wich contain the `id`, the `msg` and the `query`.
warn | {string} msg | Warning messages are emitted when you update some sensitive features.
connect | `none` | [See Net Event connect](https://nodejs.org/api/net.html#net_event_connect)
end | `none` | [See Net Event end](https://nodejs.org/api/net.html#net_event_end)
close | `none` | [See Net Event close](https://nodejs.org/api/net.html#net_event_close)

### Interfaces
Some interfaces are available to type your data, you can load them from `@ts3/query-client/interfaces`

### Errors
Errors are provided with 3 parameters:

- {number} `id`: The error ID, if the error comes from the socket the ID is always `9000`
- {string} `msg`: The error message
- {string} `query`: The query which occur the error

**Note**: The query is not available when the error is not occurred by a query.

### Data
The data are always given when the promise is resolved, this is always an object wich contains these informations:

```typescript
{
    query: {
        id: number,
        query: string
    },
    data: [{..row1..}, {..row2..}] 
}
```

##### TODO
This client is a work in progress, i have some ideas to implement when i had the time :
- Interfaces for each kind of data
- Attach an event name on query
- Each server command as a method
- Implement filetransfert methods and interfaces
- Units tests

Feel free to open a pull request to improve the client.

#### Anti Flood
The client is provided with an anti-flood feature, when the client connect to the serverinstance it get the `instanceinfo` properties.

If these informations are not available the client use the default values. You can enforce theses values, ask your hoster about the flood rate 
limit if you are banned with the default values.

// TODO explain methods and interface

If your client is whitelisted you can disable this feature.

#### .connect
Connect the QueryClient to the TS3 server, the event `connect` is emitted when the QueryClient is successfully connected to the server.

```typescript
import TS3QueryClient from "@ts3/query-client";
import {iError} from "@ts3/query-client/interfaces";


(async () => {
    
    let TS3Client = new TS3QueryClient();
    
    // Connect to the server
    let connected = await TS3Client.connect("127.0.0.1", 10011).catch((err: iError) => {
        
        if(err.id > 0) {
            console.log(err.id, err.msg);
            process.exit(1); // Connection failed, kill the process
        }
    
    });
    
});
```

#### Build and send your query
You can build and escape your queries easily. If you want send the query in priority you can use `queryNow`.

```typescript
TS3Client.query('serveredit', {virtualserver_name:'TeamSpeak ]|[ Server'}, []).then(
    (renamed: boolean) => { // serveredit don't return data, get true when the query is resolved
       if(renamed)
           console.log("Virtualserver name edited!");
    },
    (err: iError) => {

        // If the server return an error
        if(err.id > 0)
            // do the stuff
      
    }
);
```

#### Send query
If you need you can send raw queries, they are **not** escaped. If you want send the query in priority you can use `sendNow`.
```js
let clientlist = await TS3Client.send(`clientlist`).catch((err: iError) => {

  // If the server return an error
  if(err.id > 0)
      // do the stuff
});

if(clientlist.data.length > 0)
    // Perform treatment on the clientlist
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
TS3Client.execute('serveredit', ['TeamSpeak ]|[ Server', 'newPassword']).catch((err) => {

  // If the server return an error
  if(err.id > 0) throw new Error(err.msg);

  console.log(rows)
  // Do the stuff...
});

TS3Client.execute('setVServerMaxClients', ['numbers expected']);
```

### TeamSpeak 3 Query Utilities
The client use the `@ts3/query-utils` package, so you can import it in your application.
