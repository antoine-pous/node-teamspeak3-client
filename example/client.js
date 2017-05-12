'use strict'
let log = require('npmlogger')
let ts3client = require('../teamspeak3-client')
let ts3utils = require('teamspeak3-utils')
let ts3defs = require('teamspeak3-utils/definitions')

// Client configuration
let host = '127.0.0.1'
let port = 10011
let login = 'serveradmin'
let pass = 'myPassword'

// Init the client
let ts3 = new ts3client(host, port)

// Enable verbose for debug purpose
ts3.enableVerbose()

// Prepare some usefull queries
ts3.prepare('login', 'login client_login_name=%s client_login_password=%s')
ts3.prepare('kickFromServer', 'clientkick clid=%d reasonid=' + ts3defs.REASON_KICK_SERVER + ' reasonmsg=%s')
ts3.prepare('usePort', 'use port=%d')

// When the client is connected
ts3.on('connected', function() {

  // Login with account (see prepared query)
  ts3.execute('login', [login, pass], function(err, res, query) {

    // If we have an error
    if(err.id > 0) {
      log.error(err.msg) // log the error (see npmlogger)
      return // Don't continue
    }

    // Use virtual server
    ts3.execute('usePort', [9987], function(err, res, query) {

      // If we have an error
      if(err.id > 0) {
        log.error(err.msg) // log the error (see npmlogger)
        return // Don't continue
      }

    })

  })

})
