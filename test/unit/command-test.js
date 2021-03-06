/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of fiware-iotagent-lib
 *
 * fiware-iotagent-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * fiware-iotagent-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with fiware-iotagent-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */
'use strict';

var iotAgentLib = require('../../'),
    utils = require('../tools/utils'),
    should = require('should'),
    logger = require('fiware-node-logger'),
    nock = require('nock'),
    mongoUtils = require('./mongoDBUtils'),
    request = require('request'),
    contextBrokerMock,
    statusAttributeMock,
    iotAgentConfig = {
        contextBroker: {
            host: '10.11.128.16',
            port: '1026'
        },
        server: {
            port: 4041
        },
        types: {
            'Light': {
                commands: [],
                lazy: [
                    {
                        name: 'temperature',
                        type: 'centigrades'
                    }
                ],
                active: [
                    {
                        name: 'pressure',
                        type: 'Hgmm'
                    }
                ]
            },
            'Termometer': {
                commands: [],
                lazy: [
                    {
                        name: 'temp',
                        type: 'kelvin'
                    }
                ],
                active: [
                ]
            },
            'Motion': {
                commands: [],
                lazy: [
                    {
                        name: 'moving',
                        type: 'Boolean'
                    }
                ],
                staticAttributes: [
                    {
                        'name': 'location',
                        'type': 'Vector',
                        'value': '(123,523)'
                    }
                ],
                active: []
            },
            'Robot': {
                commands: [
                    {
                        name: 'position',
                        type: 'Array'
                    }
                ],
                lazy: [],
                staticAttributes: [],
                active: []
            }
        },
        service: 'smartGondor',
        subservice: 'gardens',
        providerUrl: 'http://smartGondor.com',
        deviceRegistrationDuration: 'P1M',
        throttling: 'PT5S'
    },
    device3 = {
        id: 'r2d2',
        type: 'Robot'
    };

describe('Command functionalities', function() {
    beforeEach(function(done) {
        logger.setLevel('FATAL');

        nock.cleanAll();

        contextBrokerMock = nock('http://10.11.128.16:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', 'gardens')
            .post('/NGSI9/registerContext',
            utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgentCommands.json'))
            .reply(200,
            utils.readExampleFile('./test/unit/contextAvailabilityResponses/registerIoTAgent1Success.json'));

        iotAgentLib.activate(iotAgentConfig, done);
    });

    afterEach(function(done) {
        iotAgentLib.clearAll(function() {
            iotAgentLib.deactivate(function() {
                mongoUtils.cleanDbs(function() {
                    nock.cleanAll();
                    iotAgentLib.setDataUpdateHandler();
                    iotAgentLib.setCommandHandler();
                    done();
                });
            });
        });
    });

    describe('When a device is preregistered with commands', function() {
        it('should register as Context Provider of the commands', function(done) {
            iotAgentLib.register(device3, function(error) {
                should.not.exist(error);
                contextBrokerMock.done();
                done();
            });
        });
    });
    describe('When a command update arrives to the IoT Agent as Context Provider', function() {
        var options = {
            url: 'http://localhost:' + iotAgentConfig.server.port + '/v1/updateContext',
            method: 'POST',
            json: {
                contextElements: [
                    {
                        type: 'Robot',
                        isPattern: 'false',
                        id: 'r2d2:Robot',
                        attributes: [
                            {
                                name: 'position',
                                type: 'Array',
                                value: '[28, -104, 23]'
                            }
                        ]
                    }
                ],
                updateAction: 'UPDATE'
            }
        };

        beforeEach(function(done) {
            statusAttributeMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/v1/updateContext',
                utils.readExampleFile('./test/unit/contextRequests/updateContextCommandStatus.json'))
                .reply(200,
                utils.readExampleFile('./test/unit/contextResponses/updateContextCommandStatusSuccess.json'));

            iotAgentLib.register(device3, function(error) {
                done();
            });
        });

        it('should call the client handler', function(done) {
            var handlerCalled = false;

            iotAgentLib.setDataUpdateHandler(function(id, type, attributes, callback) {
                callback(null, {
                    id: id,
                    type: type,
                    attributes: []
                });
            });


            iotAgentLib.setCommandHandler(function(id, type, attributes, callback) {
                id.should.equal(device3.id + ':' + device3.type);
                type.should.equal(device3.type);
                attributes[0].name.should.equal('position');
                attributes[0].value.should.equal('[28, -104, 23]');
                handlerCalled = true;
                callback(null, {
                    id: id,
                    type: type,
                    attributes: [
                        {
                            name: 'position',
                            type: 'Array',
                            value: '[28, -104, 23]'
                        }
                    ]
                });
            });

            request(options, function(error, response, body) {
                should.not.exist(error);
                handlerCalled.should.equal(true);
                done();
            });
        });
        it('should create the attribute with the "_status" prefix in the Context Broker', function(done) {
            iotAgentLib.setDataUpdateHandler(function(id, type, attributes, callback) {
                callback(null, {
                    id: id,
                    type: type,
                    attributes: [
                        {
                            name: 'position',
                            type: 'Array',
                            value: '[28, -104, 23]'
                        }
                    ]
                });
            });

            request(options, function(error, response, body) {
                should.not.exist(error);
                statusAttributeMock.done();
                done();
            });
        });
    });
    describe('When an update arrives from the south bound for a registered command', function() {
        beforeEach(function(done) {
            statusAttributeMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/v1/updateContext',
                utils.readExampleFile('./test/unit/contextRequests/updateContextCommandFinish.json'))
                .reply(200,
                utils.readExampleFile('./test/unit/contextResponses/updateContextCommandFinishSuccess.json'));

            iotAgentLib.register(device3, function(error) {
                done();
            });
        });

        it('should update its value and status in the Context Broker', function(done) {
            iotAgentLib.setCommandResult('r2d2', 'Robot', '', 'position', '[72, 368, 1]', 'FINISHED',
                function(error) {
                    should.not.exist(error);
                    statusAttributeMock.done();
                    done();
                });
        });
    });
    describe('When an error command arrives from the south bound for a registered command', function() {
        beforeEach(function(done) {
            statusAttributeMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/v1/updateContext',
                utils.readExampleFile('./test/unit/contextRequests/updateContextCommandError.json'))
                .reply(200,
                utils.readExampleFile('./test/unit/contextResponses/updateContextCommandStatusSuccess.json'));

            iotAgentLib.register(device3, function(error) {
                done();
            });
        });

        it('should update its status in the Context Broker', function(done) {
            iotAgentLib.setCommandResult('r2d2', 'Robot', '', 'position', 'Stalled', 'ERROR',
                function(error) {
                    should.not.exist(error);
                    statusAttributeMock.done();
                    done();
                });
        });
    });
});
