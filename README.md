# Contentful Content Management

This is a wrapper for the Contentful's [Content Management API Node.js library](https://github.com/contentful/contentful-management.js). 

It provides syntactic sugar for getting connected to a Space quickly, and adds queuing/retry functionality for when you need to send large numbers of API requests and don't want to lose data to Contentful's rate limiting.

## Getting started

Install as normal:

```sh
$ npm install --save contentful-content-management
```

Use as follows:

```js

var ContentfulManagement = require('contentful-content-management');

var contentful = new ContentfulManagement();

// Set up some data to insert
var items = [
    {title: 'Page 1', body: 'Content for Page 1'},
    {title: 'Page 2', body: 'Lorem ipsum.'},
    {title: 'Page 3', body: 'Dolor sit amet.'},
];

// use the .formatItems() method to add localisation to the data
items = contentful.formatItems(items);

// the .space() method quickly creates a Contentful Space
contentful.space(function(space){

    // standard API calls work as normal
    space.getEntries()
    .then(function(entries){
        console.log(entries);
    })

    // the Space now has a .queue() method for queueing calls
    space.queue('createEntry', 'myContentTypeId', items)
    .then(function(entries){
        // returns an array of whatever you would expect the function to return, in this case the newly-created Entries
        console.log(entries);
        // the .itemQueue() method allows you to queue method calls on an array of Entries or an EntryCollection:
        contentful.itemQueue('publish', entries)
    });

})

```


## API

You should call the library function as you require it, to avoid having to pass options with subsequent calls.

### .space(_fn_)

This is just a wrapper for `contentful.createClient` then `contentful.getSpace`, with an additional `queue` method injected into the Space object (see below).

The method returns a Promise that resolves the connected Space, which is passed to the callback function.

```js
contentful.space(function(space){
    space.getEntries()
    .then(function(entries){
        console.log(entries);
    });
})
```

### Space.queue(_method, [...args], items_)

The library injects a `.queue()` function into the resolved Space. Returns a Promise that resolves to an Array of whatever the `method` you're calling is supposed to return.

**Parameters:**
- **method** _[String]_: the Contentful API method you wish to call on `items`.
- **args** _[Mixed]_: Additional arguments to pass to the API method
- **items** _[Array]_: an Array of data you wish to use with the API.

```js
contentful.space(function(space){
    // note that the method is called on the Space, not on the Contentful library directly
    space.queue('createEntries', 'contentTypeID', data)
    .then(function(entries){
        console.log(entries);
    });
});
```

See [the Contentful JS SDK docs](https://contentful.github.io/contentful-management.js/contentful-management/1.1.11/ContentfulSpaceAPI.html) for a list of methods you can call on a Space.

## .itemQueue(_method, items_)

Allows you to queue method calls on a collection of Entries or Assets.

**Parameters**
- **method** _[String]_: The method you wish to call on each Item
- **items** _[Array/Collection]_: The Items that you wish to call `method` on, either as an Array of Entries/Assets (e.g. returned from `Space.queue()` or a Contentful EntryCollection (e.g. returned from `Space.getEntries()`).

```js

contentful.space(function(space){
    space.getEntries({status:'draft'})
    .then(function(entries){
        contentful.itemQueue('publish', entries);
    });
});

```

See the Contenful JS SDK docs for a list of methods you can call on [Entries](https://contentful.github.io/contentful-management.js/contentful-management/1.1.11/Entry.html) or [Assets](https://contentful.github.io/contentful-management.js/contentful-management/1.1.11/Asset.html).

## .formatItems(_items, locale_)

Convenience method for formatting entry data, and adding locale information.

Contentful expects entry data to be stored in the `fields` key, and to contain localisation information:

```js
    {
        fields: {
            title: {
                'en-US': 'My Title'
            },
            body: {
                'en-US': 'My body text...'
            }
        }
    }
```

This is annoying if you're mostly working with data in a simpler format:

```js
    {
        title: 'My title',
        body:  'My body text...'
    }
```

Enter `.formatItems()`...

```js
    
    var data = [{
        title: 'Test',
        body:  'Test content...'
    },
    {
        title: 'Test 2',
        body:  'Test content 2...'
    }];
    var data = contentful.formatItems(data);
    /*
    data.should.deep.equal(
        [
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
        ]
    );
    */

```

**Parameters:**
- **items** _[Array/Object]_: Array containing items to format. Each item should be a hash of the fields and field values you wish to submit to Contentful. Can also be a single Entry object, in which case the function also returns a single Entry.

Uses the `locale` option specified in the constructor, which defaults to `en-US`.

### .client

Reference to the underlying Contentful client created by Contentful.createClient()

## Options

You can specify options in the constructor:

```js
var contentful = new ContentfulManagement({
    progress: false
});
```

### Auto-Loading Environment Vars

The library uses [dotenv]() to add environment variables. You should never store API tokens in source code, so it's better to use a `.env` file in your project that isn't checked into `git`.

`.env` should look like the following:

```
CONTENTFUL_MANAGEMENT_ACCESS_TOKEN=<your contentful CMA key>
CONTENTFUL_SPACE=<your contentful space>
```

You can get your personal Contentful Content Management API key by opening the Space, clicking on the '*APIs*' button in the toolbar, clicking on the '*Content Management Keys*' tab, then following the link to the documentation. You should be able to copy your key from there.

### Option reference

#### `contentful_space`
_String:_ The ID of your Contentful space. If should probably specify this as an environment variable instead. Defaults to `process.env.CONTENTFUL_SPACE`

#### `contentful_management_access_token`
_String:_ Your Contentful Content Management API access token. If should probably specify this as an environment variable instead. Defaults to `process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN`

#### `locale`
_String:_ The locale that you wish to use in calls to `.formatItems()`. Defaults to `en-US`npm.

#### `progress`
_Boolean:_ Display a progress bar when using queues.

#### `queue_options`
_Object:_ Passed directly to the [bluebird-queue](https://www.npmjs.com/package/bluebird-queue) library. If nothing is specified, you'll get _promise-queue_'s default behaviour.

#### `retry_options`
_Object:_ Passed directly to the [promise-retry](https://www.npmjs.com/package/promise-retry) library. If nothing is specified, you'll get _promise-retry_'s default behaviour.


### Default options

```js
{
    locale: 'en-US',
    contentful_space: process.env.CONTENTFUL_SPACE,
    contentful_management_access_token: process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN,
    progress: true,
    queue_options: {
        concurrency: 15
    },
    retry_options: {}
}
```

## Testing

```sh
$ npm run test
```

Before you can run tests, you'll need to create a Contentful space to test with, and add a `.env` file to the project root (see above).

The test data is designed to work with Contentful's demo 'Blog' space. Click 'Add a new Space' in the Spaces menu, choose the '*Use an example space*' radio button, click the '*Blog*' tab, then click '*Create Space*'.
