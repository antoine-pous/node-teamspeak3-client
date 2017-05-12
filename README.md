# teamspeak3-client
TeamSpeak3 ServerQuery Client

[![Build Status](https://travis-ci.org/antoine-pous/node-teamspeak3-client.svg?branch=master)](https://travis-ci.org/antoine-pous/node-teamspeak3-client)
[![Dependency Status](https://gemnasium.com/badges/github.com/antoine-pous/node-teamspeak3-client.svg)](https://gemnasium.com/github.com/antoine-pous/node-teamspeak3-client)

## Installation
```console
$ npm install teamspeak3-client --save
```

## Connect to the server
```js
let ts3client = require('teamspeak3-client')
let ts3 = new ts3client(host, port)

// Wait for the connection event
ts3.on('connected', function() {

  // Do the stuff...

})

// Connect to the server localhost:10011
ts3client.connect('127.0.0.1', 10011)
```

## Querying the server
Each time the queries provide 3 objects to your callback :

- `err` An object wich contains the error `id` and `msg` from the server
- `rows` An array of objects, each offset is a row `[{row 1},{row 2},...]`
- `query` An object wich contains all informations about the query

### Debug your queries
During the development you can enable the verbose mode, it shown all the queries and the responses.

```js
let ts3client = require('teamspeak3-client')
let ts3 = new ts3client(host, port)
ts3.enableverbose()
```

### Build and send your query
You can build and escape your queries easily. If you want send the query in priority you can use `queryNow`.

```js
ts3client.query('serveredit', {virtualserver_name:'TeamSpeak ]|[ Server'}, [], function(err, rows, query) {

  // If the server return an error
  if(err.id > 0) {
    throw new Error(err.msg)
  }

  // Do the stuff
  console.log(rows)
})
```

### Send query
If you need you can send raw queries, they are **not** escaped. If you want send the query in priority you can use `sendNow`.
```js
let ts3utils = require('teamspeak3-utils')
let newName = ts3utils.escape('TeamSpeak ]|[ Server')

ts3client.send('serveredit virtualserver_name=' + newName, function(err, rows, query) {

  // If the server return an error
  if(err.id > 0) {
    throw new Error(err.msg)
  }

  // Do the stuff
  console.log(rows)
})
```

### Prepared queries
If you want execute the query in priority you can use `executeNow`.

**Note:** You must respect the arguments list order
```js
// Prepare the query
ts3client.prepare('serverEdit', 'serveredit virtualserver_name=%s virtualserver_password=%s')
ts3client.prepare('setVServerMaxClients', 'serveredit virtualserver_maxclients=%d')

// Execute the query, the values are automaticly escaped
ts3client.execute('serverEdit', ['TeamSpeak ]|[ Server', 'newPassword'], function(err, rows, query) {

  // If the server return an error
  if(err.id > 0) {
    throw new Error(err.msg)
  }

  // Do the stuff
  console.log(rows)
})
ts3client.execute('setVServerMaxClients', ['numbers expected'])
```
