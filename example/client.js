'use strict'
let log = require('npmlogger')
let TS3Client = require('../teamspeak3-client')
let TS3Utils = require('teamspeak3-utils')
let TS3Definitions = require('teamspeak3-utils/definitions')

// Client configuration
let host = '127.0.0.1'
let port = 10011
let login = 'serveradmin'
let pass = 'myPassword'
let whitelisted = false

log.fileLevel = 'silent'

TS3Client.on("error", function(prefix, id, msg) {
  log.error(prefix, id, msg)
})

TS3Client.on("info", function(prefix, entry) {
  log.info(prefix, entry)
})

TS3Client.on("warn", function(prefix, entry) {
  log.warn(prefix, entry)
})

TS3Client.on("verbose", function(prefix, entry) {
  log.verbose(prefix, entry)
})

// Prepare some usefull queries
TS3Client.prepare('login', 'login client_login_name=%s client_login_password=%s')
TS3Client.prepare('kickFromServer', 'clientkick clid=%d reasonid=' + TS3Definitions.REASON_KICK_SERVER + ' reasonmsg=%s')
TS3Client.prepare('usePort', 'use port=%d')

// Wait for the connection
TS3Client.on("connected", function() {

  // Login with account (see prepared query)
  TS3Client.execute('login', [login, pass], function(err, res, query) {

    // If we have an error
    if(err.id > 0) {
      log.error(err.msg) // log the error (see npmlogger)
      return // Don't continue
    }

    // Use virtual server
    TS3Client.execute('usePort', [9987], function(err, res, query) {

      // If we have an error
      if(err.id > 0) {
        log.error(err.msg) // log the error (see npmlogger)
        return // Don't continue
      }

      TS3Client.query('servernotifyregister', {event:'server'}, [], function(err, rows, query) {
        if(err.id > 0) {
          log.error(err.msg) // log the error (see npmlogger)
          return // Don't continue
        }

        TS3Client.on("cliententerview", function(clients) {
          for(let i = 0; i < clients.length; i++) {
            console.log(clients[i].client_nickname + ' join the server !')
          }
        })
      })
    })

  })

})

// Init the client
TS3Client.connect(host, port, whitelisted)
