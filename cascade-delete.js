'use strict';

var debug = require('debug')('loopback:mixins:cascade-delete');
var _ = require('lodash');

module.exports = function (Model, options) {
    function getWhereId (ctx){
        var returnValue = undefined;

        if (ctx.where) {
            _.forEach(ctx.where.and, function (element) {
                if (element.id !== undefined) {
                    returnValue = element.id;
                }
            })
        }

        return returnValue
    }

    Model.observe('after delete', function (ctx, next) {
        var name = idName(Model);
        var hasInstanceId = ctx.instance && ctx.instance[name];
        var hasWhereId = ctx.where && ctx.where[name];
        var hasMixinOption = options && _.isArray(options.relations);

        if (!(hasWhereId || hasInstanceId)) {
            debug('Skipping delete for ', Model.definition.name);
            return next();
        }

        if (!hasMixinOption) {
            debug('Skipping delete for', Model.definition.name, 'Please add mixin options');
            return next();
        }
        var modelInstanceId = getIdValue(Model, ctx.instance || ctx.where);

        var deletedRelations = _.map(cascadeDeletes(), function (deleteRelation) {
            return deleteRelation(modelInstanceId);
        });

        Promise.all(deletedRelations)
          .then(function () {
              debug('Cascade delete has successfully finished');
              next();
          })
          .catch(function (err) {
              debug('Error with cascading deletes', err);
              next(err);
          });
    });

    Model.observe('after save', function (ctx, next) {
        var name = idName(Model);
        var hasInstanceId = ctx.instance && ctx.instance[name];
        var hasWhereId = getWhereId(ctx)
        var hasMixinOption = options && _.isArray(options.relations);

        if (!(hasWhereId || hasInstanceId)) {
            debug('Skipping delete for ', Model.definition.name);
            return next();
        }

        if (!hasMixinOption) {
            debug('Skipping delete for', Model.definition.name, 'Please add mixin options');
            return next();
        }

        if (ctx.data === undefined || ctx.data === null || ctx.data[options.marker] === false) {
            debug('Skipping delete for ', Model.definition.name, 'Not marked as deleted via marker');
            return next();
        }
        var modelInstanceId = getIdValue(Model, ctx.instance || ctx.where);

        var deletedRelations = _.map(cascadeDeletes(), function (deleteRelation) {
            return deleteRelation(modelInstanceId);
        });

        Promise.all(deletedRelations)
          .then(function () {
              debug('Cascade delete has successfully finished');
              next();
          })
          .catch(function (err) {
              debug('Error with cascading deletes', err);
              next(err);
          });
    });

    function cascadeDeletes() {
        return _.map(options.relations, function (relation) {
            return function (modelId) {
                debug('Relation ' + relation + ' model ' + Model.definition.name);

                if (!Model.relations[relation]) {
                    debug('Relation ' + relation + ' not found for model ' + Model.definition.name);
                    throw 'Relation ' + relation + ' not found for model ' + Model.definition.name;
                }


                var relationModel = Model.relations[relation].modelTo;
                var relationKey = Model.relations[relation].keyTo;

                if (Model.relations[relation].modelThrough) {
                    relationModel = Model.relations[relation].modelThrough;
                }

                var where = {};
                where[relationKey] = modelId;

                return relationModel.destroyAll(where);
            }
        });
    }

    function idName(m) {
        return m.definition.idName() || 'id';
    }

    function getIdValue(m, data) {
        return data && data[idName(m)];
    }
};
