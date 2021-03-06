/*
 *
 * Copyright 2015, Google Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

'use strict';

var assert = require('assert');

var grpc = require('..');
var math = grpc.load(__dirname + '/../../proto/math/math.proto').math;

/**
 * Client to use to make requests to a running server.
 */
var math_client;

/**
 * Server to test against
 */
var getServer = require('./math/math_server.js');

var server = getServer();

describe('Math client', function() {
  before(function(done) {
    var port_num = server.bind('0.0.0.0:0',
                               grpc.ServerCredentials.createInsecure());
    server.start();
    math_client = new math.Math('localhost:' + port_num,
                                grpc.credentials.createInsecure());
    done();
  });
  after(function() {
    server.forceShutdown();
  });
  it('should handle a single request', function(done) {
    var arg = {dividend: 7, divisor: 4};
    math_client.div(arg, function handleDivResult(err, value) {
      assert.ifError(err);
      assert.equal(value.quotient, 1);
      assert.equal(value.remainder, 3);
      done();
    });
  });
  it('should handle an error from a unary request', function(done) {
    var arg = {dividend: 7, divisor: 0};
    math_client.div(arg, function handleDivResult(err, value) {
      assert(err);
      done();
    });
  });
  it('should handle a server streaming request', function(done) {
    var call = math_client.fib({limit: 7});
    var expected_results = [1, 1, 2, 3, 5, 8, 13];
    var next_expected = 0;
    call.on('data', function checkResponse(value) {
      assert.equal(value.num, expected_results[next_expected]);
      next_expected += 1;
    });
    call.on('status', function checkStatus(status) {
      assert.strictEqual(status.code, grpc.status.OK);
      done();
    });
  });
  it('should handle a client streaming request', function(done) {
    var call = math_client.sum(function handleSumResult(err, value) {
      assert.ifError(err);
      assert.equal(value.num, 21);
    });
    for (var i = 0; i < 7; i++) {
      call.write({'num': i});
    }
    call.end();
    call.on('status', function checkStatus(status) {
      assert.strictEqual(status.code, grpc.status.OK);
      done();
    });
  });
  it('should handle a bidirectional streaming request', function(done) {
    function checkResponse(index, value) {
      assert.equal(value.quotient, index);
      assert.equal(value.remainder, 1);
    }
    var call = math_client.divMany();
    var response_index = 0;
    call.on('data', function(value) {
      checkResponse(response_index, value);
      response_index += 1;
    });
    for (var i = 0; i < 7; i++) {
      call.write({dividend: 2 * i + 1, divisor: 2});
    }
    call.end();
    call.on('status', function checkStatus(status) {
      assert.strictEqual(status.code, grpc.status.OK);
      done();
    });
  });
  it('should handle an error from a bidi request', function(done) {
    var call = math_client.divMany();
    call.on('data', function(value) {
      assert.fail(value, undefined, 'Unexpected data response on failing call',
                  '!=');
    });
    call.write({dividend: 7, divisor: 0});
    call.end();
    call.on('error', function checkStatus(status) {
      done();
    });
  });
});
