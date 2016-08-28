// load environment vars
require('dotenv').load({silent: true});

// load libraries
const Promise = require('bluebird'); // eslint-disable-line no-unused-vars
const PromiseQueue = require('bluebird-queue');
const ProgressBar = require('progress');
const PromiseRetry = require('promise-retry');
const extend = require('extend');

const Contentful = require('contentful-management');



const defaultOpts = {
    locale: 'en-US',
    contentful_space: process.env.CONTENTFUL_SPACE,
    contentful_management_access_token: process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN,
    progress: true,
    retry_options: {},
    queue_options: {

    }
};

function setLocale (locale,value){
    const x = {};
    x[locale] = value;
    return x;
}

function progressBarFormat(prefix){
    return `${prefix} [:bar] :current/:total (:percent)`;
}

function ContentfulError(name,message) {
    this.name = name || "ContentfulError";
    this.message = typeof message === 'string' || jsFriendlyJSONStringify(message);
    console.log(this.message);
    console.log('Type::',typeof this.message);
}
ContentfulError.prototype = new Error();

function jsFriendlyJSONStringify (s) {
    return JSON.stringify(s,null,'  ')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}



module.exports = function contentfulContentManagement (opts){
    // merge options
    const options = extend(true, {}, defaultOpts, opts);
    // create client
    const client = Contentful.createClient({
      accessToken: options.contentful_management_access_token
    });


    // PRIVATE METHODS

    /* 
    *   @private
    *   @func queueFactory
    *   @param: items - the items to add to the queue
    *   @param: fn(item) — a function to call against each item. Takes an `item` as its parameter
    *   @param: progressDescription — the text to display in the queue progress bar
    */
    function queueFactory(items, fn, progressDescription = 'Processing...') {

        if (!Array.isArray(items)){
            console.log(items);
            throw new TypeError('Last argument of .queue() must be an array of items');
        }

        const bar = new ProgressBar(progressBarFormat(progressDescription), {
            total: items.length,
            clear: true
        });

        const queue = new PromiseQueue();
        items.forEach(function(item){
            // queue the promises
            queue.add(function(){
                // wrap promises in a retry function
                return PromiseRetry(function(retry){
                    // call the command on the main Contentful object
                    return fn(item)
                    .catch(function(err) {
                        try {
                            // try to decode a status message from the response
                            var errMessage = JSON.parse(err.message);
                            // retry if it's a server error
                            if (errMessage.status >= 500 && errMessage.status < 600) {
                                retry(err);
                            }
                            // throw a more compact error which just contains the most important fields
                            else {
                                var errorKeys = [
                                    'status',
                                    'statusText',
                                    'message',
                                    'details',
                                ];
                                var errorMessage = {};
                                errorKeys.forEach(function(key){
                                    errorMessage[key] = errMessage[key];
                                });
                                errorMessage = jsFriendlyJSONStringify(errorMessage);
                                var error = new Error(errorMessage);
                                error.name = err.name;
                                throw error;
                            }
                        }
                        catch (e) {
                            // throw the original error
                            throw err;
                        }
                        throw err;
                    });
                }, options.retry_options)
                .then(function(result){
                    bar.tick();
                    return result;
                });
            });
        });
        return queue.start()
    }

    // API

    const formatEntries = function(items){
        // handle a single object
        let singleton = false;
        if(!Array.isArray(items) && typeof items === 'object'){
            singleton = true;
            items = [items];
        }
        // set locale information
        const localisedItems = [];
        items.forEach(function(item){
            var localisedItem = Object.assign({}, item);
            Object.keys(localisedItem).forEach(function(prop){
                localisedItem[prop] = setLocale(options.locale, localisedItem[prop]);
            });
            // add to 'fields' key
            localisedItems.push({
                fields:localisedItem
            });
        });

        if (singleton) {
            return localisedItems[0];
        }

        return localisedItems;
    }

    /* 
    *   Get a Contentful space, inject additional 'queue' method
    *   @func
    *   @name space
    *   @param fn — callback wrapper for the promise. Means space doesn't have to be passed to new function via '.then()'
    */
    const space = function(fn) {
   
        // return a modified contentful space
        return client.getSpace(options.contentful_space)
        .then(function(space){
            // inject queue function into space
            space.queue = function(command, ...args) {
                // items will always be the last argument...
                var items = args.pop();
                // create the queue
                return queueFactory(items, function(item){
                    var itemArgs = args.slice();
                    itemArgs.push(item);
                    return space[command](...itemArgs);
                }, `<Space.${command}>`);
            };
            // return the modified space
            return fn(space);
        })
        .catch(function(err){
            throw err;
        });
    };


    /* 
    *   Create a queue method for multiple members (entries) of an EntryCollection, or an array of Entries
    *   @func
    *   @name space
    *   @param fn — callback wrapper for the promise. Means space doesn't have to be passed to new function via '.then()'
    */
    const entryQueue = function(command, entryCollection) {
        // we just have an array of entries
        if (Array.isArray(entryCollection) && !entryCollection.items) {
            return queueFactory(entryCollection, function(item){
                return item[command]();
            },`<Entry.${command}>`)
        }
        // we have an EntryCollection
        if (typeof entryCollection === 'object' && entryCollection.items){
            return queueFactory(entryCollection.items, function(item){
                return item[command]();
            },`<Entry.${command}>`);
        }
        // we don't know what we've got, throw an error
        throw new Error('entryQueue expects either an array of Entries or an EntryCollection');
    };


    // expose library
    return {
        space,
        formatEntries,
        entryQueue,
        client,
        options
    };
}