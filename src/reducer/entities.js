/**
 * Created by Andy on 3/27/2017.
 */

import {o, a, mergeFlags} from "atp-sugar";
import rest from "atp-rest-client";
import {notEqual} from 'atp-pointfree';

export const UPDATE_ENTITY = "atp-entity/update";
export const ENTITY_UPDATED = "atp-entity/updated";

export const ADD_CHILD = "atp-entity/addChild";
export const REMOVE_CHILD = "atp-entity/removeChild";

export const DELETE_ENTITY = "atp-entity/delete";
export const ENTITY_DELETED = "atp-entity/deleted";

export const UPDATE_ENTITIES = "atp-entity/update-multiple";
export const ENTITIES_UPDATED = "atp-entity/updated-multiple";

const _getEntity = (state, type, id) => state[type] && state[type][id] ? state[type][id] : {};

const _updateEntity = (state, type, entity, idField) => o(state).merge({
    [type]: {
        [entity[idField]]: o(_getEntity(state, type, entity[idField])).merge(entity, mergeFlags.NONE).raw
    }
}, mergeFlags.RECURSIVE).raw;

const _addChild = (state, entityType, entityId, childType, childId) => o(state).merge({
    [entityType]: {
        [entityId]: o(_getEntity(state, entityType, entityId)).as(entity => o(entity).merge({
            [childType]: (entity[childType] || []).concat(childId)
        }, mergeFlags.NONE)).raw
    }
}, mergeFlags.RECURSIVE).raw;

const _removeChild = (state, entityType, entityId, childType, childId) => o(state).merge({
    [entityType]: {
        [entityId]: o(_getEntity(state, entityType, entityId)).as(entity => o(entity).merge({
            [childType]: (entity[childType] || []).filter(notEqual(childId))
        }, mergeFlags.NONE)).raw
    }
}, mergeFlags.RECURSIVE).raw;

const _updateEntities = (state, type, entities, idField) => entities.reduce(
    (combined, entity) => _updateEntity(combined, type, entity, idField),
    state
);

const _deleteEntity = (state, type, id, idField) => o(state).merge({
    [type]: o(state[type]).filter(obj => obj[idField] !== id).raw
}, null).raw;

const _getChangedEntityIdList = (getState, type, results, idField) => {
    return [].concat(
        //Get entities that have not already been loaded
        a(results.map(entity => entity[idField])).difference(o(getState().entities[type]).keys()),

        ///Get entities that have already been loaded, but have a higher version
        results.filter(entity => o(getEntity(getState, type, entity[idField])).as(existingEntity =>
            typeof existingEntity !== 'undefined' && entity.version > existingEntity.version
        )).map(entity => entity[idField])
    );
}  //Note:  No need to check for duplicates since these two lists are mutually exclusive

//Initial state
const initialState = {
};

//Reducer
export default (state = initialState, action) =>
    o(action.type).switch({
        [UPDATE_ENTITY]:      () => _updateEntity(state, action.entityType, action.entity, action.idField),
        [ADD_CHILD]:          () => _addChild(state, action.entityType, action.entityId, action.childType, action.childId),
        [REMOVE_CHILD]:       () => _removeChild(state, action.entityType, action.entityId, action.childType, action.childId),
        [DELETE_ENTITY]:      () => _deleteEntity(state, action.entityType, action.id, action.idField),
        [UPDATE_ENTITIES]:    () => _updateEntities(state, action.entityType, action.entities, action.idField),
        default: () => state
    });

//Selectors
export const entityExists = (getState, type, id) => id && getState().entities[type] && getState().entities[type][id];
export const getEntity = (getState, type, id) =>
    entityExists(getState, type, id)
        ? getState().entities[type][id]
        : undefined;
export const getAllEntities = (getState, type) => getState().entities[type] || {};
export const getEntitiesById = (getState, type, idList) => idList.map(id => getEntity(getState, type, id));

//Action creators
export const updateEntity = (entityType, entity, idField) => ({type: UPDATE_ENTITY, entityType, idField, entity});
export const entityUpdated = (entityType, entity, idField) => ({type: ENTITY_UPDATED, entityType, idField, entity});

export const addChild = (entityType, entityId, childType, childId) => ({type: ADD_CHILD, entityType, entityId, childType, childId});
export const removeChild = (entityType, entityId, childType, childId) => ({type: REMOVE_CHILD, entityType, entityId, childType, childId});

export const deleteEntity = (entityType, id, idField) => ({type: DELETE_ENTITY, entityType, id, idField});
export const entityDeleted = (entityType, id, idField) => ({type: ENTITY_DELETED, entityType, id, idField});

export const updateEntities = (entityType, entities, idField) => ({type: UPDATE_ENTITIES, entityType, idField, entities});
export const entitiesUpdated = (entityType, entities, idField) => ({type: ENTITIES_UPDATED, entityType, idField, entities});

//Boilerplate
export const entityBoilerplate = (type, endPoint, idField = "id") => ({
    children: (childEndPoint, model) => {
        const childrenUrl = id => endPoint + "/" + id + "/" + childEndPoint;
        return {
            select: {
                all: (getState, id) => entityExists(getState, type, id)
                    ? getEntity(getState, type, id)[childEndPoint] || []
                    : []
            },
            action: {
                list: (id, filters) => rest()
                    .get(childrenUrl(id))
                    .send(o(filters).delete('columns').raw)
                    .then(([data, dispatch, getState]) => {
                        dispatch(updateEntity(type, {
                            [idField]: id,
                            [childEndPoint]: data.results.map(child => child.id)
                        }, idField));
                        dispatch(model().action.collection.updateCache(data.results, filters.columns));
                    })
                    .thunk(),
                post: (parentId, childId) => rest()
                    .post(childrenUrl(parentId))
                    .send({[childEndPoint + "Id"]: childId})
                    .then(([data, dispatch, getState]) => {
                        dispatch(addChild(type, parentId, childEndPoint, childId));
                    })
                    .thunk(),
                delete: (parentId, childId) => rest()
                    .delete(childrenUrl(parentId) + "/" + childId)
                    .then(([data, dispatch, getState]) => {
                        dispatch(removeChild(type, parentId, childEndPoint, childId));
                    })
                    .thunk()
            }
        }
    },
    select: {
        one: (getState, id) => getEntity(getState, type, id),
        all:  (getState) => o(getAllEntities(getState, type)).values(),
        some: (getState, filter = () => true) => o(getAllEntities(getState, type))
            .values()
            .filter(filter),
        byIdList: (getState, idList) => getEntitiesById(getState, type, idList),
    },
    action: {
        type: {
            update: "atp-entity/update/" + type,
            updated: "atp-entity/updated/" + type,
            delete: "atp-entity/delete/" + type,
            deleted: "atp-entity/deleted/" + type,
            updateMultiple: "atp-entity/update-multiple/" + type,
            updatedMultiple: "atp-entity/updated-multiple/" + type
        },
        save: {
            single: entity => updateEntity(type, entity, idField),
            multiple: entities => updateEntities(type, entities, idField)
        },
        collection: {
            updateCache: (ids, columns = null) => (dispatch, getState) => {
                const idsToUpdate = _getChangedEntityIdList(getState, type, ids, idField);
                if(idsToUpdate.length > 0) {
                    dispatch(rest()
                        .get(endPoint)
                        .send(columns ? {columns} : {})
                        .then(([data, dispatch]) => {
                            dispatch(updateEntities(type, data.results, idField));
                            onEntityLoad(dispatch, data.results);
                        })
                        .thunk()
                    );
                }
            },
            getVersions: (filters = {}) => rest()
                .get(endPoint)
                .send(o(filters).merge({
                    columns: ['id', 'version'].join(',')
                }).raw)
                .then(([data, dispatch, getState]) => {
                    dispatch(updateEntities(type, data.results, idField));
                })
                .thunk(),
            get: (filters = {}) => rest()
                .get(endPoint)
                .send(filters)
                .then(([data, dispatch, getState]) => {
                    dispatch(updateEntities(type, data.results, idField));
                })
                .thunk(),
        },
        fetch: (id, callback = () => {}) => rest()
            .get(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, data.results, idField));
                callback(data, dispatch, getState);
            })
            .thunk(),
        create: (entity, callback = () => {}) => rest()
            .post(endPoint)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, data.results, idField));
                dispatch(entityUpdated(type, data.results, idField));
                callback(data, dispatch, getState);
            })
            .send(entity)
            .thunk(),
        move: (action, targetId, sourceId, callback = () => {}) => rest()
            .post(endPoint + "/move")
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntities(type, data.results, idField));
                callback(data, dispatch, getState);
            })
            .send({action, targetId, sourceId})
            .thunk(),
        replace: (id, entity, callback = () => {}) => rest()
            .put(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, data.results, idField));
                dispatch(entityUpdated(type, data.results, idField));
                callback(data, dispatch, getState);
            })
            .send(entity)
            .thunk(),
        update: (id, entity, callback = () => {}) => rest()
            .patch(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, data.results, idField));
                dispatch(entityUpdated(type, data.results, idField));
                callback(data, dispatch, getState);
            })
            .send(entity)
            .thunk(),
        delete: (id, callback = () => {}) => rest()
            .delete(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(deleteEntity(type, id, idField));
                dispatch(entityDeleted(type, id, idField));
                callback(data, dispatch, getState);
            })
            .thunk()
    }
});
