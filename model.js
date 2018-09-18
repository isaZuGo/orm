"use strict";
////////////////////////////////////////////////////////////////////////////////////////////
// The MIT License (MIT)                                                                  //
//                                                                                        //
// Copyright (C) 2018  Unicoderns SA - info@unicoderns.com - unicoderns.com               //
//                                                                                        //
// Permission is hereby granted, free of charge, to any person obtaining a copy           //
// of this software and associated documentation files (the "Software"), to deal          //
// in the Software without restriction, including without limitation the rights           //
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell              //
// copies of the Software, and to permit persons to whom the Software is                  //
// furnished to do so, subject to the following conditions:                               //
//                                                                                        //
// The above copyright notice and this permission notice shall be included in all         //
// copies or substantial portions of the Software.                                        //
//                                                                                        //
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR             //
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,               //
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE            //
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                 //
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,          //
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE          //
// SOFTWARE.                                                                              //
////////////////////////////////////////////////////////////////////////////////////////////
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const clc = __importStar(require("cli-color"));
const es6_promise_1 = require("es6-promise");
const decorators_1 = require("./decorators");
/**
 * Model Abstract
 */
class Model {
    /**
     * Create a table object.
     *
     * @param jsloth Core library
     * @param privacy To get all fields (secrets included), you need to set privacy as "unsafe" explicitly, in that way we ensure that this will not be a security breach in any wrong future upgrade.
     */
    constructor(DB, privacy) {
        this.tableName = (this.constructor.name).charAt(0).toLowerCase() + (this.constructor.name).slice(1); // Get the table name from the model name in camelcase.
        this.unsafe = false;
        this.fields = undefined;
        this.joins = [];
        this.DB = DB;
        if (privacy == "unsafe") {
            this.unsafe = true;
        }
    }
    /**
     * Create cache and return the model field list.
     *
     * If this.unsafe is set then merge public with secret fields.
     *
     * @return Fields Mapped
     */
    getFields() {
        let fields = this.fields;
        if (typeof fields == "undefined") {
            let tmp = decorators_1.getList(this.tableName);
            fields = tmp.get("public");
            if (this.unsafe) {
                var secret = tmp.get("secret");
                if ((secret) && (secret.size)) {
                    secret.forEach(function (value, key) {
                        if (typeof fields != "undefined") {
                            fields.set(key, value);
                        }
                    });
                }
            }
            this.fields = fields;
        }
        return fields;
    }
    /**
     * Convert a map in a array.
     */
    mapInArray(target) {
        let keys = [];
        if (typeof target !== "undefined") {
            target.forEach(item => {
                keys.push(item);
            });
        }
        else {
            console.error(clc.red("No fields in the model"));
        }
        return keys;
    }
    /**
     * Filter one array if keys don't exists in other array.
     */
    filterArrayInArray(target, scope) {
        let keys = [];
        if (typeof scope !== "undefined") {
            target.forEach(item => {
                if (scope.has(item)) {
                    keys.push(item);
                }
            });
        }
        else {
            console.error(clc.red("No fields in the model"));
        }
        return keys;
    }
    /**
     * Log if keys don't exists in other array.
     */
    logArrayInArray(target, scope) {
        if (typeof scope !== "undefined") {
            target.forEach(item => {
                if (!scope.has(item)) {
                    console.error(item + " field doesn't exists!");
                }
            });
        }
        else {
            console.error(clc.red("No fields in the model"));
        }
    }
    /*
        /////////////////////////////////////////////////////////////////////
        // Generate a report and filter fields
        /////////////////////////////////////////////////////////////////////
        private selectFieldsReport(select: string[]): Fields {
            let report: Fields;
            let fields = this.getFields();
    
            report.all = this.filterArrayInArray(select, fields.all);
            report.public = this.filterArrayInArray(select, fields.public);
            report.protected = this.filterArrayInArray(select, fields.protected);
            report.private = this.filterArrayInArray(select, fields.private);
    
            return this.getFields();
        }
    */
    /**
     * Clean and validate a select if is need it
     *
     * @var fields String array with field names.
     * @return Object cointaining the SQL and a field report
     */
    getSelectFieldsSQL(fields, prefix) {
        let fieldsSQL = "";
        let selectableFields = [];
        let modelFields = this.getFields();
        let config = this.DB.config;
        // Check if is an array or just SQL code
        if ((Array.isArray(fields)) && (fields.length)) {
            // Log missing fields in dev mode
            if (config.dev) {
                this.logArrayInArray(fields, modelFields);
            }
            // Check if the validations of fields is on and then filter (Always disallowed in dev mode)
            if (config.connection.validations.fields) {
                selectableFields = this.filterArrayInArray(fields, modelFields);
            }
            else {
                selectableFields = this.mapInArray(modelFields);
            }
        }
        else {
            selectableFields = this.mapInArray(modelFields);
        }
        if (typeof prefix == "undefined") {
            fieldsSQL = "`" + this.tableName + "`.`";
            fieldsSQL = fieldsSQL + selectableFields.join("`, `" + this.tableName + "`.`") + "`";
        }
        else {
            let formatedFields = [];
            selectableFields.forEach((field) => {
                formatedFields.push("`" + this.tableName + "`.`" + field + "` AS `" + this.tableName + "__" + field + "`");
            });
            fieldsSQL = formatedFields.join(", ");
        }
        return fieldsSQL;
    }
    /**
     * Generates a select string from the Join configuration
     *
     * @var fields String array with field names.
     * @return Object cointaining the SQL and a field report
     */
    getJoinSelectFieldsSQL() {
        let joins = this.joins;
        let joinsStringArray = [];
        let joinsSQL = "";
        if (joins.length) {
            joins.forEach(function (join) {
                joinsStringArray.push(join.keyField.model.getSelectFieldsSQL(join.fields, true));
            });
            joinsSQL = joinsStringArray.join(", ");
            joinsSQL = ", " + joinsSQL;
        }
        return joinsSQL;
    }
    /**
     * Generate join sql code
     *
     * @return String with the where sql code
     */
    generateJoinCode() {
        let joins = this.joins;
        let joinsStringArray = [];
        let joinsSQL = "";
        if (joins.length) {
            joins.forEach((join) => {
                let linkedTableName = join.keyField.model.tableName;
                joinsStringArray.push(" " + join.kind.toUpperCase() + " JOIN " +
                    "`" + linkedTableName + "`" +
                    " ON `" + this.tableName + "`.`" + join.keyField.localField + "` = " +
                    "`" + linkedTableName + "`.`" + join.keyField.linkedField + "`");
            });
            joinsSQL = joinsStringArray.join(" ");
        }
        return joinsSQL;
    }
    /////////////////////////////////////////////////////////////////////
    // Generate "AND" chained where sql code
    // @return string
    /////////////////////////////////////////////////////////////////////
    generateWhereCodeChain(where) {
        let values = [];
        let keys = [];
        let filteredKeys = [];
        let modelFields = this.getFields();
        let config = this.DB.config;
        for (let key in where) {
            keys.push(key);
        }
        // Check if the validations of fields is on and then filter (Always disallowed in dev mode)
        if ((config.connection.validations.fields) && (!config.dev)) {
            filteredKeys = this.filterArrayInArray(keys, modelFields);
        }
        else {
            if (config.dev) {
                this.logArrayInArray(keys, modelFields);
            }
            filteredKeys = keys;
        }
        if (typeof where !== "undefined") {
            let sql = "`" + this.tableName + "`.`";
            sql = sql + filteredKeys.join("` = ? AND `" + this.tableName + "`.`");
            sql = sql + "` = ?";
            // getting values
            filteredKeys.forEach((item) => {
                values.push(where[item]);
            });
            return {
                sql: sql,
                values: values
            };
        }
        else {
            return {
                sql: "",
                values: []
            };
        }
    }
    /**
     * Generate where sql code
     *
     * @var where Array of key/value objects with the conditions
     * @return String with the where sql code
     */
    generateWhereCode(where) {
        if (where == "*") {
            return {
                sql: "",
                values: []
            };
        }
        else {
            let generated = {
                sql: "",
                values: []
            };
            if (Array.isArray(where)) {
                let values = [];
                let SQLChains = [];
                where.forEach((chain) => {
                    let localChain = this.generateWhereCodeChain(chain);
                    values = values.concat(localChain.values);
                    SQLChains.push(localChain.sql);
                });
                generated.sql = "(" + SQLChains.join(") OR (") + ")";
                generated.values = values;
            }
            else {
                generated = this.generateWhereCodeChain(where);
            }
            if (generated.sql) {
                generated.sql = " WHERE " + generated.sql;
                return generated;
            }
            else {
                return generated;
            }
        }
    }
    /**
     * Plain query
     *
     * Any query over any table can be done here
     *
     * Warnings:
     * - Field privacity or data integrity will not apply to a direct query, you are responsable for the data security.
     *
     * @var sql MySQL query
     * @var values Values to replace in the query
     * @return Promise with query result
     */
    query(query) {
        return this.DB.query(query);
    }
    /**
     * Select private query
     *
     * @var fields If is NOT set "*" will be used, if there's a string then it will be used as is, a plain query will be
     * executed, if in the other hand an array is provided (Recommended), then it will filter the keys and run the query.
     * @var where Key/Value object used to filter the query, an array of Key/Value objects will generate a multiple filter separated by an "OR".
     * @var orderBy String with column_name and direction E.g.: "id, name ASC"
     * @var groupBy String with column_name E.g.: "id, name"
     * @var limit Number of rows to retrieve
     * @return Promise with query result
     *
     * TODO:
     * @var orderBy should be an array of fields, then they can be tested
     * @var groupBy should be an array of fields, then they can be tested
     * Join at least 2 tables is important
     * Group this using functions like select("").orderBy() is just easier to understand
     */
    select(select) {
        let fieldsSQL = this.getSelectFieldsSQL(select.fields);
        let joinFieldsSQL = this.getJoinSelectFieldsSQL();
        let joinCode = this.generateJoinCode();
        let whereCode = this.generateWhereCode(select.where);
        let groupBy = select.groupBy;
        let orderBy = select.orderBy;
        let limit = select.limit;
        let extra = "";
        if ((typeof groupBy !== "undefined") && (groupBy !== null)) {
            extra += " GROUP BY " + groupBy;
        }
        if ((typeof orderBy !== "undefined") && (orderBy !== null)) {
            extra += " ORDER BY " + orderBy;
        }
        if ((typeof limit !== "undefined") && (limit !== null)) {
            extra += " LIMIT " + limit;
        }
        let sql = "SELECT " + fieldsSQL + joinFieldsSQL + " FROM `" + this.tableName + "`" + joinCode + whereCode.sql + extra + ";";
        this.joins = [];
        return this.query({ sql: sql, values: whereCode.values });
    }
    /**
     * Get item - Select query
     *
     * @var fields If is NOT set "*" will be used, if there's a string then it will be used as is, a plain query will be
     * executed, if in the other hand an array is provided (Recommended), then it will filter the keys and run the query.
     * @var where Key/Value object used to filter the query, an array of Key/Value objects will generate a multiple filter separated by an "OR".
     * @var orderBy String with column_name and direction E.g.: "id, name ASC"
     * @var groupBy String with column_name E.g.: "id, name"
     * @return Promise with query result
     */
    get(select) {
        // Create promise
        const p = new es6_promise_1.Promise((resolve, reject) => {
            let sqlPromise = this.select({
                fields: select.fields,
                where: select.where,
                groupBy: select.groupBy,
                orderBy: select.orderBy,
                limit: 1
            });
            sqlPromise.then((data) => {
                resolve(data[0]);
            }).catch(err => {
                reject(err);
            });
        });
        return p;
    }
    /**
     * Get some item - Select query
     *
     * @var fields If is NOT set "*" will be used, if there's a string then it will be used as is, a plain query will be
     * executed, if in the other hand an array is provided (Recommended), then it will filter the keys and run the query.
     * @var where Key/Value object used to filter the query, an array of Key/Value objects will generate a multiple filter separated by an "OR".
     * @var orderBy String with column_name and direction E.g.: "id, name ASC"
     * @var groupBy String with column_name E.g.: "id, name"
     * @var limit Number of rows to retrieve
     * @return Promise with query result
     */
    getSome(select) {
        return this.select(select);
    }
    /**
     * Get all items - Select query
     *
     * @var fields If is NOT set "*" will be used, if there's a string then it will be used as is, a plain query will be
     * executed, if in the other hand an array is provided (Recommended), then it will filter the keys and run the query.
     * @var where Key/Value object used to filter the query, an array of Key/Value objects will generate a multiple filter separated by an "OR".
     * @var orderBy String with column_name and direction E.g.: "id, name ASC"
     * @var groupBy String with column_name E.g.: "id, name"
     * @return Promise with query result
     */
    getAll(select) {
        return this.select(select);
    }
    /**
     * Join a table
     *
     * Specify a field that needs to be joined
     *
     * Warning: It works only with select requests
     *
     * @var keyField Model foreign key
     * @var fields String array with names of fields to join
     * @var kind Type of Join to apply E.g.: INNER, LEFT
     * @return Model
     */
    join(join) {
        this.joins.push({
            keyField: join.keyField,
            fields: join.fields,
            kind: join.kind
        });
        return this;
    }
    /**
     * Insert query
     *
     * @var data object to be inserted in the table
     * @return Promise with query result
     */
    insert(data) {
        let fields = [];
        let wildcards = [];
        let values = [];
        for (let key in data) {
            fields.push(key);
            wildcards.push("?");
            values.push(data[key]);
        }
        let query = "INSERT INTO `" + this.tableName + "` (`" + fields.join("`, `") + "`) VALUES (" + wildcards.join(", ") + ");";
        return this.query({ sql: query, values: values });
    }
    /**
     * Update query
     *
     * @var data object data to be update in the table
     * @var where Key/Value object used to filter the query, an array of Key/Value objects will generate a multiple filter separated by an "OR".
     * @return Promise with query result
     */
    update(update) {
        let fields = [];
        let values = [];
        let unifiedValues = [];
        let data = update.data;
        let where = update.where;
        for (let key in data) {
            if (data[key] == "now()") {
                fields.push("`" + key + "` = now()");
            }
            else {
                fields.push("`" + key + "` = ?");
                values.push(data[key]);
            }
        }
        let whereCode = this.generateWhereCode(where);
        let query = "UPDATE `" + this.tableName + "` SET " + fields.join(", ") + whereCode.sql + ";";
        unifiedValues = values.concat(whereCode.values);
        return this.query({ sql: query, values: unifiedValues });
    }
    /**
     * Delete query
     *
     * @var where Key/Value object used to filter the query, an array of Key/Value objects will generate a multiple filter separated by an "OR", a "*" string wildcard is required for security reasons if you want to match all rows.
     * @return Promise with query result
     */
    delete(where) {
        let whereCode = this.generateWhereCode(where);
        let query = "DELETE FROM `" + this.tableName + "`" + whereCode.sql + ";";
        return this.query({ sql: query, values: whereCode.values });
    }
}
exports.Model = Model;
//# sourceMappingURL=model.js.map