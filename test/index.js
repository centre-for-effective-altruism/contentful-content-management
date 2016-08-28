var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();

var Contentful = require('../lib/index.js');
var contentful = new Contentful({
    queue_options: {
        delay: 100,     // mimic slow API connection to see progress bar
    },
    retry_options: {
        retries: 1
    }

});


// TESTS

describe('Contentful Content Management', function(){
    
    this.timeout(4000);

    describe('Convenience functions', function(){
        
        it('formats a single entry', function(){
            var data = {
                title: 'Test',
                body:  'Test content...'
            };
            var data = contentful.formatItems(data);
            data.should.be.an('object');
            data.should.deep.equal({
                fields: {
                    title: {
                        'en-US': 'Test',
                    },
                    body: {
                        'en-US': 'Test content...'
                    }
                }
            });
        });

        it('formats multiple entries', function(){
            var data = [{
                title: 'Test',
                body:  'Test content...'
            },
            {
                title: 'Test 2',
                body:  'Test content 2...'
            }];
            var data = contentful.formatItems(data);
            data.should.be.an('array');
            data.should.deep.equal([
                {
                    fields: {
                        title: {
                            'en-US': 'Test',
                        },
                        body: {
                            'en-US': 'Test content...'
                        }
                    }
                },
                {
                    fields: {
                        title: {
                            'en-US': 'Test 2',
                        },
                        body: {
                            'en-US': 'Test content 2...'
                        }
                    }
                },
            ]);
        });

    })

    describe('Basic interactions', function(){

        it('gets all Entries in the Space', function(){
            return contentful.space(function(space){
                return space.getEntries();
            })
            .should.be.fulfilled
            .should.eventually.be.an('object')
            .should.eventually.have.property('items')
        });

        it('gets all Content Types of the Space', function(){
            return contentful.space(function(space){
                return space.getContentTypes()
            })
            .should.be.fulfilled
            .should.eventually.be.an('object')
            .should.eventually.have.property('items')
        });
    });

    describe('Queueing', function(){
        // vars used by multiple tests    
        var contentTypeNamesMap = {};
        var testData = [];
        var testEntries;
        // set a long timeout for tests in case there's a slow network connection
        this.timeout(30000);

        before(function(){
            // set up dummy data for inserts
            for (var i = 1; i <= 5; i++) {
                testData.push({
                    title: 'Test Post ' + i,
                    slug: 'test-post-' + i,
                    body: 'Some test content for Test Post ' +i,
                });
            }
            testData = contentful.formatItems(testData);
            // get all the content types of the space
            return contentful.space(function(space){
                return space.getContentTypes()
                .then(function(contentTypes){
                    contentTypes.items.forEach(function(contentType){
                        contentTypeNamesMap[contentType.name] = contentType;
                    })
                    return;
                });
            })
        })
       
        it('creates five new Posts', function(){


            return contentful.space(function(space){
                return space.queue('createEntry', contentTypeNamesMap['Post'].sys.id,testData)
                .then(function(entries){
                    testEntries = entries;
                    return entries;
                })
                .should.be.fulfilled
                .should.eventually.be.an('array')
                .should.eventually.have.length(5)
                .should.eventually.not.have.members([undefined])
            });
        });
        it('deletes the five test entries', function(){
            return contentful.itemQueue('delete',testEntries)
            .should.be.fulfilled
            .should.eventually.be.an('array')
            .should.eventually.have.length(5)
        });

        it('.itemQueue() — Gets all entries and runs a queue', function(){
            return contentful.space(function(space){
                return space.getEntries()
                .then(function(entries){
                    return contentful.itemQueue('unpublish',entries)
                })
                .then(function(entries){
                    return contentful.itemQueue('publish',entries);
                })
            })
            .should.be.fulfilled
        });
        
        it('.itemQueue() — Gets all assets and runs a queue', function(){
            return contentful.space(function(space){
                return space.getAssets()
                .then(function(assets){
                    return contentful.itemQueue('unpublish',assets)
                })
                .then(function(assets){
                    return contentful.itemQueue('publish',assets);
                })
            })
            .should.be.fulfilled
        });

    });

    describe('Exception handling', function(){
        it('Correctly throws an exception', function(){
            return contentful.space(function(space){
                return space.getEntries()
                .then(function(entries){
                    throw new Error;
                })
            })
            .should.be.rejectedWith(Error)
        });
    })


});