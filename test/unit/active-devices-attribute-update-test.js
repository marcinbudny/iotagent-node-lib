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
                // commands are not defined
                active: [
                    {
                        name: 'pressure',
                        type: 'Hgmm'
                    }
                ]
            }
        },
        service: 'smartGondor',
        subservice: 'gardens',
        providerUrl: 'http://smartGondor.com',
        deviceRegistrationDuration: 'P1M',
        throttling: 'PT5S'
    },
    device = {
        id: 'somelight',
        type: 'Light'
    };

describe('Update attribute functionalities', function() {

    beforeEach(function(done) {
        logger.setLevel('FATAL');

        nock.cleanAll();

        contextBrokerMock = nock('http://10.11.128.16:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', 'gardens')
            .post('/NGSI9/registerContext',
                utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgentAttributeUpdates.json'))
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

    describe('When a attribute update arrives to the IoT Agent as Context Provider', function() {
        var options = {
            url: 'http://localhost:' + iotAgentConfig.server.port + '/v1/updateContext',
            method: 'POST',
            json: {
                contextElements: [
                    {
                        type: 'Light',
                        isPattern: 'false',
                        id: 'somelight:Light',
                        attributes: [
                            {
                                name: 'pressure',
                                type: 'Hgmm',
                                value: '200'
                            }
                        ]
                    }
                ],
                updateAction: 'UPDATE'
            }
        };

        beforeEach(function(done) {
            iotAgentLib.register(device, function(error) {
                if (error) {
                    done('Device registration failed');
                }
                done();
            });
        });

        it('should call the client handler with correct values, even if commands are not defined', function(done) {
            var handlerCalled = false;

            iotAgentLib.setDataUpdateHandler(function(id, type, attributes, callback) {
                id.should.equal('somelight:Light');
                type.should.equal('Light');
                should.exist(attributes);
                attributes.length.should.equal(1);
                attributes[0].name.should.equal('pressure');
                attributes[0].value.should.equal('200');
                handlerCalled = true;

                callback(null, {
                    id: id,
                    type: type,
                    attributes: attributes
                });
            });


            request(options, function(error, response, body) {
                should.not.exist(error);
                handlerCalled.should.equal(true);
                done();
            });
        });
    });
});
