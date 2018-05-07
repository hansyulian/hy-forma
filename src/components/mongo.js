const connectionStringFormat = "mongodb://{{usernameAndPassword}}{{host}}:{{port}}/{{database}}{{authSource}}";

var MongoClient = require("mongodb").MongoClient;

module.exports = mongo;

function mongo(config) {
    var extension = mongo.extension || function () {};


    var connectionString = generateConnectionString();
    var collectionName = config.collection;
    var databaseName = config.database;
    var defaultLimit = config.defaultLimit;
    var maximumLimit = config.maximumLimit;
    var logger = config.logger || function () {};

    var wraps = {
        connect: connect, // object: connect()

        insert: insert, // object: insert(data)
        update: update, // object: update(query,values)
        delete: del, // object: delete(query)
        select: select, // [object]: select(query?,options?)

        count: count, // int: count(query?)
        distinct: distinct, //
        group: group,

        setCollection: setCollection, // void: setCollection(name)
        setDatabase: setDatabase, // void: setDatabase(name)
    }

    extension(wraps);

    return wraps;

    async function connect() {
        var result = {};

        logger("Create Connection", connectionString);
        var session = await MongoClient.connect(connectionString);
        result.session = session;

        if (databaseName) {
            logger("Connecting Database", databaseName);
            var database = await session.db(databaseName);
            result.database = database;
            if (collectionName) {
                logger("Connecting Collection", collectionName);
                var collection = await database.collection(collectionName);
                result.collection = collection;
            }
        }
        return result;
    }

    async function insert(data) {
        logger("Inserting");
        var connection = await connect();
        var collection = await connection.collection;
        if (!collection)
            throw Error("No collection defined");
        logger("Insert: ", data);
        var result = await collection.insert(data);
        logger("Insert Result", result);
        connection.session.close();
        return result;
    }

    async function update(query, values) {
        logger("Updating");
        var connection = await connect();
        var collection = await connection.collection;
        if (!collection)
            throw Error("No collection defined");
        logger("Update Query: ", query, "Update Values: ", values);
        var result = await collection.updateMany(query, values);
        logger("Update Result", result);
        connection.session.close();
        return result;
    }

    async function select(query, options) {
        query = query || {};
        options = options || {};
        logger("Selecting");
        var connection = await connect();
        var collection = await connection.collection;
        if (!collection)
            throw Error("No collection defined");
        logger("Select Query: ", query, "Select Options", options);
        var cursor = collection.find(query);
        cursor = applySort(cursor, options);
        cursor = applySkip(cursor, options);
        cursor = applyLimit(cursor, options);
        var result = await cursor.toArray();
        logger("Select Result", result);
        connection.session.close();
        return result;
    }

    async function del(query) {
        logger("Deleting");
        var connection = await connect();
        var collection = await connection.collection;
        if (!collection)
            throw Error("No collection defined");
        logger("Delete Query: ", query);
        var result = await collection.remove(query);
        logger("Delete Result", result);
        connection.session.close();
        return result;
    }

    async function count(query) {
        logger("Counting");
        query = query || {};
        var connection = await connect();
        var collection = await connection.collection;
        if (!collection)
            throw Error("No collection defined");
        logger("Count Query", query);
        var result = await collection.find(query).count();
        logger("Count: ", result);
        connection.session.close();
        return result;
    }

    async function distinct(field, query, options) {
        logger("Distincting");
        query = query || {};
        var connection = await connect();
        var collection = await connection.collection;
        if (!collection)
            throw Error("No collection defined");
        logger("Distinct Query", query);
        var result = await collection.distinct(field, query, options);
        logger("Distinct: ", result);
        connection.session.close();
        return result;
    }

    async function group(keys, condition, initial, reduce, finalize, command, options) {
        logger("Grouping");
        keys = keys || {};
        condition = condition || {};
        initial = initial || {};
        reduce = reduce || function () {};
        finalize = finalize || function () {};
        options = options || {};

        var connection = await connect();
        var collection = await connection.collection;
        if (!collection)
            throw Error("No collection defined");
        var result = await collection.group(keys, condition, initial, reduce, finalize, command, options);
        logger("Grouping: ", result);
        connection.session.close();
        return result;
    }


    function setCollection(collection) {
        collectionName = collection;
    }

    function setDatabase(database) {
        databaseName = database;
    }

    function generateConnectionString() {
        var username = config.username;
        var password = config.password;
        var host = config.host || "localhost";
        var port = config.port || 27017;
        var database = config.database;
        var authSourceDatabase = config.authSource || "admin";

        var usernameAndPassword = "";
        var authSource = "";
        if (username && password) {

            usernameAndPassword = username + ":" + password + "@";
            authSource = "?authSource=" + authSourceDatabase;
        }
        var connectionString = connectionStringFormat
            .replace("{{usernameAndPassword}}", usernameAndPassword)
            .replace("{{host}}", host)
            .replace("{{port}}", port)
            .replace("{{database}}", database)
            .replace("{{authSource}}", authSource);
        return connectionString;
    }

    function requiredConfig(field) {
        if (!(field in config))
            throw Error("Required: ", field);

    }

    function applySort(cursor, options) {
        if (!options.sort)
            return cursor;
        return cursor.sort(options.sort);
    }

    function applySkip(cursor, options) {
        if (options.skip === undefined)
            return cursor;
        return cursor.skip(options.skip);
    }

    function applyLimit(cursor, options) {
        var limit = options.limit || defaultLimit || maximumLimit;
        if (limit > maximumLimit)
            limit = maximumLimit
        if (limit === undefined)
            return cursor;
        return cursor.limit(limit);
    }
}