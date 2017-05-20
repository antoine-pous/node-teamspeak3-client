'use strict'

/**
 * ISC License
 *
 * Copyright (c) 2017, Antoine Pous <gecko@dvp.io>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
 * OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

let net = require('net')
let _ = require('underscore')
let ts3utils = require('teamspeak3-utils')
let LineInputStream = require('line-input-stream')
let ev = require('eventemitter2').EventEmitter2
let log = require('npmlogger')
let util = require('util')

log.fileLevel = 'silent'
log.level = 'silent'

let TeamSpeak3Client = function(host, port) {
  ev.call(this);

  let self = this
 	let socket = net.connect(port, host)
 	let reader = null
 	let status = -2
  let prepared = {}
 	let queue = []
  let queryCount = 0
 	let q = null

  /**
   * Process queue
   *
   * @description Execute the first query from the queue
   * @since 1.0.0
   * @return null
   */
  let processQueue = function() {
 		if(!q && queue.length >= 1) {
 			q = queue.shift();
      log.verbose('send', q.query.replace(/\n$/, ''))
      q.query = q.query.endsWith('\n') ? q.query : q.query + '\n'
 			socket.write(q.query)
 		}
 	}

  /**
   * Queue Push
   *
   * @description Append query into the pending queue
   * @since 1.0.0
   * @param Object query Query data
   * @return null
   */
  let queuePush = function(data) {
    queryCount++
    data.id = queryCount
    queue.push(data)
    if(status === 0) processQueue()
  }

  /**
   * Queue Unshift
   *
   * @description Prepend query into the pending queue
   * @since 1.0.0
   * @param Object query Query data
   * @return null
   */
  let queueUnshift = function(data) {
    queryCount++
    data.id = queryCount
    queue.unshift(data)
    if(status === 0) processQueue()
  }

  /**
   * Log Level
   *
   * @description Set the log level
   * @since 1.0.0
   * @return null
   */
  TeamSpeak3Client.prototype.enableVerbose = function(lvl) {
 		log.level = lvl
 	}

  /**
   * Get Queue
   *
   * @description Return the pending queue
   * @since 1.0.0
   * @return null
   */
  TeamSpeak3Client.prototype.getQueue = function() {
 		return queue.slice(0);
 	}

  /**
   * Clear Queue
   *
   * @description Clear the pending queue
   * @since 1.0.0
   * @return null
   */
  TeamSpeak3Client.prototype.clearQueue = function() {
 		queue = []
 		return queue === [] ? true : false
 	}

  /**
   * Query
   *
   * @description Build the query and push it into the queue
   * @param String cmd Command name
   * @param Object params Object contains {param: value}
   * @param Array flags Array contains ['-flag']
   * @param Function cb Callback
   * @return null
   */
  TeamSpeak3Client.prototype.query = function(cmd, params, flags, cb) {

    if(typeof cb !== 'function') {
      throw new Error('The callback must be a function!')
    }

    let query = ts3utils.buildQuery(cmd, params, flags)

    if(query instanceof Error) {
      throw new Error(query)
    }

    queuePush({cmd: cmd, params: params, flags: flags, query: query, cb: cb})
  }

  /**
   * QueryNow
   *
   * @description Execute the query ASAP
   * @param String cmd Command name
   * @param Object params Object contains {param: value}
   * @param Array flags Array contains ['-flag']
   * @param Function cb Callback
   * @return null
   */
  TeamSpeak3Client.prototype.queryNow = function(cmd, params, flags, cb) {

    if(typeof cb !== 'function') {
      throw new Error('The callback must be a function!')
    }

    let query = ts3utils.buildQuery(cmd, params, flags)

    if(query instanceof Error) {
      throw new Error(query)
    }

    queueUnshift({cmd: cmd, params: params, flags: flags, query: query, cb: cb})
  }

  /**
   * Prepare
   *
   * @description Prepare a query to be executed later
   * @param String name Prepared statement name
   * @param String query The query
   * @return boolean
   */
  TeamSpeak3Client.prototype.prepare = function(name, query) {

    if(typeof prepared[name] !== 'undefined') {
      throw new Error('Cannot prepare `' + name + '` already exists!')
    }

    prepared[name] = query
    log.verbose('prepare', name + ': ' + query)
  }

  /**
   * Prepare
   *
   * @description Execute a prepared query
   * @param String name Prepared statement name
   * @param String query The query
   * @return boolean
   */
  TeamSpeak3Client.prototype.execute = function(name, params, cb) {

    if(typeof prepared[name] === 'undefined') {
      throw new Error('Cannot execute `' + name + '`, statement not found!')
    }

    // Escape all the values
    let p = params.map(function(v) {
      return ts3utils.escape(v)
    })

    p.unshift(prepared[name])

    console.log(p)

    // Build the final query
    let query = util.format.apply(this, p)

    // Send the query to the server
    self.send(query, cb)
  }

  /**
   * Send
   *
   * @description Send raw query
   * @param String query Raw query
   * @param Function cb Callback
   * @return null
   */
  TeamSpeak3Client.prototype.send = function(query, cb) {

    if(typeof cb !== 'function') {
      throw new Error('The callback must be a function!')
    }

    queuePush({query: query, cb: cb})
  }

  /**
   * Send Now
   *
   * @description Send ASAP a raw query
   * @param String query Raw query
   * @param Function cb Callback
   * @return null
   */
  TeamSpeak3Client.prototype.sendNow = function(query, cb) {

    if(typeof cb !== 'function') {
      throw new Error('The callback must be a function!')
    }

    queueUnshift({query: query, cb: cb})
  }

  socket.on('error', function(e) {
    log.error('socket', e.syscall, e.errno, 'on', e.host + ':' + e.port)
  })

  socket.on('connect', function() {

    // Emit the connected event with host and port
    self.emit('connected', host, port)

    let input = LineInputStream(socket)

 		input.on('line', function(line) {
      let l = line.trim()

      // Skip the first two messages
 			if(status < 0) {
 				status++
 				if(status === 0) processQueue()
 				return
 			}

      // If the response is an error
 			if(l.indexOf('error') === 0) {
 				q.err = ts3utils.parseResponse(l.substr("error ".length).trim())[0]
        q.cb(q.err, q.res || [], q)
        q = null
        processQueue()
      // If we have a notification
 			} else if(l.indexOf('notify') === 0) {
        log.verbose('notify', l)
 				let n = l.substr('notify'.length)
 				self.emit(n.substr(0, n.indexOf(' ')), ts3utils.parseResponse(l))
      // Normal data set
 			} else if(q) {
 				q.res = ts3utils.parseResponse(l)
 				q.raw = l
        log.verbose('res', l)
 			}

    })

  })

}

util.inherits(TeamSpeak3Client, ev)
exports = module.exports = TeamSpeak3Client
