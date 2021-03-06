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
    mongo = require('mongodb').MongoClient,
    nock = require('nock'),
    async = require('async'),
    mongoUtils = require('./mongoDBUtils'),
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
                commands: [
                    {
                        name: 'position',
                        type: 'Array'
                    }
                ],
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
                ],
                staticAttributes: [
                    {
                        name: 'location',
                        type: 'Vector'
                    }
                ],
                service: 'smartGondor',
                subservice: 'gardens',
                internalAttributes: {
                    customAttribute: 'customValue'
                }
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
                ],
                service: 'smartGondor',
                subservice: 'gardens'
            }
        },
        deviceRegistry: {
            type: 'mongodb',
            host: 'localhost',
            port: '27017',
            db: 'iotagent'
        },
        service: 'smartGondor',
        subservice: 'gardens',
        providerUrl: 'http://smartGondor.com',
        deviceRegistrationDuration: 'P1M',
        throttling: 'PT5S'
    },
    device1 = {
        id: 'light1',
        type: 'Light',
        resource: '/test',
        apikey: '2345678ikjhgfr678i'
    },
    device2 = {
        id: 'term2',
        type: 'Termometer',
        resource: '/',
        apikey: 'dsf8yy789iyushu786'
    },
    iotAgentDb;

describe('MongoDB Device Registry', function() {
    beforeEach(function(done) {
        logger.setLevel('FATAL');

        mongoUtils.cleanDbs(function() {
            mongo.connect('mongodb://localhost:27017/iotagent', function(err, db) {
                iotAgentDb = db;
                done();
            });
        });
    });

    afterEach(function(done) {
        iotAgentLib.deactivate(function(error) {
            iotAgentDb.collection('devices').remove(function(error) {
                iotAgentDb.close(function(error) {
                    mongoUtils.cleanDbs(done);
                });
            });
        });
    });

    describe('When a new device is connected to the IoT Agent', function() {
        beforeEach(function(done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/NGSI9/registerContext',
                    utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgent3.json'))
                .reply(200,
                    utils.readExampleFile('./test/unit/contextAvailabilityResponses/registerIoTAgent1Success.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                done();
            });
        });

        it('should be registered in mongodb with all its attributes', function(done) {
            iotAgentLib.register(device1, function(error) {
                should.not.exist(error);

                iotAgentDb.collection('devices').find({}).toArray(function(err, docs) {
                    should.not.exist(err);
                    should.exist(docs);
                    should.exist(docs.length);
                    docs.length.should.equal(1);
                    should.exist(docs[0].internalAttributes);
                    should.exist(docs[0].staticAttributes);
                    should.exist(docs[0].internalAttributes.customAttribute);
                    should.exist(docs[0].active);
                    should.exist(docs[0].commands);
                    should.exist(docs[0].resource);
                    should.exist(docs[0].apikey);
                    docs[0].active.length.should.equal(1);
                    docs[0].staticAttributes.length.should.equal(1);
                    docs[0].staticAttributes[0].name.should.equal('location');
                    docs[0].active[0].name.should.equal('pressure');
                    docs[0].commands[0].name.should.equal('position');
                    docs[0].internalAttributes.customAttribute.should.equal('customValue');
                    docs[0].resource.should.equal('/test');
                    docs[0].apikey.should.equal('2345678ikjhgfr678i');
                    done();
                });
            });
        });
    });

    describe('When a device with the same Device ID tries to register to the IOT Agent', function() {
        beforeEach(function(done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/NGSI9/registerContext',
                utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgent3.json'))
                .reply(200,
                utils.readExampleFile('./test/unit/contextAvailabilityResponses/registerIoTAgent1Success.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', 'gardens')
                .post('/NGSI9/registerContext',
                utils.readExampleFile('./test/unit/contextAvailabilityRequests/registerIoTAgent3.json'))
                .reply(200,
                utils.readExampleFile('./test/unit/contextAvailabilityResponses/registerIoTAgent1Success.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                done();
            });
        });

        it('should be registered in mongodb with all its attributes', function(done) {
            iotAgentLib.register(device1, function(error) {
                iotAgentLib.register(device1, function(error) {
                    should.exist(error);
                    error.name.should.equal('DUPLICATE_DEVICE_ID');
                    done();
                });
            });
        });
    });

    describe('When a device is removed from the IoT Agent', function() {
        beforeEach(function(done) {
            var expectedPayload3 = utils
                .readExampleFile('./test/unit/contextAvailabilityRequests/unregisterDevice3.json');

            nock.cleanAll();
            contextBrokerMock = nock('http://10.11.128.16:1026')
                .post('/NGSI9/registerContext')
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerNewDevice1Success.json'));

            contextBrokerMock
                .post('/NGSI9/registerContext')
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerNewDevice2Success.json'));

            contextBrokerMock
                .post('/NGSI9/registerContext', expectedPayload3)
                .reply(200, utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/unregisterDevice1Success.json'));

            iotAgentLib.activate(iotAgentConfig, function(error) {
                async.series([
                    async.apply(iotAgentLib.register, device1),
                    async.apply(iotAgentLib.register, device2)
                ], done);
            });
        });

        it('should be removed from MongoDB', function(done) {
            iotAgentLib.unregister(device1.id, function(error) {
                iotAgentDb.collection('devices').find({}).toArray(function(err, docs) {
                    should.not.exist(err);
                    should.exist(docs);
                    should.exist(docs.length);
                    docs.length.should.equal(1);
                    done();
                });
            });
        });
    });
});
