
import {o, a} from "atp-sugar";
import rest from "atp-rest-client";
import {notEquals, hash, prop, remove, switchOn, filter, identity, debug} from 'atp-pointfree';

export const UPDATE_ENTITY = "atp-entity/update";
export const ENTITY_UPDATED = "atp-entity/updated";

export const ADD_CHILD = "atp-entity/addChild";
export const REMOVE_CHILD = "atp-entity/removeChild";

export const DELETE_ENTITY = "atp-entity/delete";
export const ENTITY_DELETED = "atp-entity/deleted";

export const UPDATE_ENTITIES = "atp-entity/update-multiple";
export const ENTITIES_UPDATED = "atp-entity/updated-multiple";

export const UPDATE_LIST = "atp-entity/update-list";

const _getEntity = (state, type, id) => state[type] && state[type][id] ? state[type][id] : {};

const _updateEntity = (state, type, entity, idField) => ({
    ...state,
    [type]: {
        ...(state[type] || {}),
        [entity[idField]]: {
            ..._getEntity(state, type, entity[idField]),
            ...entity
        }
    }
});

const _addChild = (state, entityType, entityId, childType, childId) => ({
    ...state,
    [entityType]: {
        ...state[entityType],
        [entityId]: {
            ..._getEntity(state, entityType, entityId),
            [childType]: (_getEntity(state, entityType, entityId)[childType] || []).concat(childId)
        }
    }
});

const _removeChild = (state, entityType, entityId, childType, childId) => ({
    ...state,
    [entityType]: {
        ...state[entityType],
        [entityId]: {
            ..._getEntity(state, entityType, entityId),
            [childType]: (_getEntity(state, entityType, entityId)[childType] || []).filter(notEquals(childId))
        }
    }
});

const _updateEntities = (state, type, entities, idField) => entities.reduce(
    (combined, entity) => _updateEntity(combined, type, entity, idField),
    state
);

const _updateList = (state, type, filters, entities, idField) => ({
    ...state,
    __lists: {
        ...(state.__lists || {}),
        [type]: {
            ...(state.__lists[type] || {}),
            [hash(filter(identity)(filters))]: entities.map(prop(idField))
        }
    }
});

const _deleteEntity = (state, type, id, idField) => ({
    ...state,
    [type]: remove(id)(state[type])
});

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
    __lists: {}
};

//Reducer
export default (state = initialState, action) =>
    switchOn(action.type, {
        [UPDATE_ENTITY]:      () => _updateEntity(state, action.entityType, action.entity, action.idField),
        [ADD_CHILD]:          () => _addChild(state, action.entityType, action.entityId, action.childType, action.childId),
        [REMOVE_CHILD]:       () => _removeChild(state, action.entityType, action.entityId, action.childType, action.childId),
        [DELETE_ENTITY]:      () => _deleteEntity(state, action.entityType, action.id, action.idField),
        [UPDATE_ENTITIES]:    () => _updateEntities(state, action.entityType, action.entities, action.idField),
        [UPDATE_LIST]:        () => _updateList(state, action.entityType, action.filters, action.entities, action.idField),
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
export const getEntitiesByList = (getState, type, filters) => ((getState().entities.__lists[type] || {})[hash(filter(identity)(filters))] || []).map(id => getEntity(getState, type, id));

//Action creators
export const updateEntity = (entityType, entity, idField) => ({type: UPDATE_ENTITY, entityType, idField, entity});
export const entityUpdated = (entityType, entity, idField) => ({type: ENTITY_UPDATED, entityType, idField, entity});

export const addChild = (entityType, entityId, childType, childId) => ({type: ADD_CHILD, entityType, entityId, childType, childId});
export const removeChild = (entityType, entityId, childType, childId) => ({type: REMOVE_CHILD, entityType, entityId, childType, childId});

export const deleteEntity = (entityType, id, idField) => ({type: DELETE_ENTITY, entityType, id, idField});
export const entityDeleted = (entityType, id, idField) => ({type: ENTITY_DELETED, entityType, id, idField});

export const updateEntities = (entityType, entities, idField) => ({type: UPDATE_ENTITIES, entityType, idField, entities});
export const entitiesUpdated = (entityType, entities, idField) => ({type: ENTITIES_UPDATED, entityType, idField, entities});

export const updateList = (entityType, filters, entities, idField) => ({type: UPDATE_LIST, entityType, filters, idField, entities});

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
                    .send(remove('columns')(filters))
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
        byList: (getState, filters) => getEntitiesByList(getState, type, filters)
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
                .send({
                    ...filters,
                    columns: ['id', 'version'].join(',')
                })
                .then(([data, dispatch, getState]) => {
                    dispatch(updateEntities(type, data.results, idField));
                })
                .thunk(),
            get: (filters = {}, callback = () => {}) => rest()
                .get(endPoint)
                .send(filter(identity)(filters))
                .then(([data, dispatch, getState]) => {
                    dispatch(updateEntities(type, data.results, idField));
                    dispatch(updateList(type, filters, data.results, idField));
                    callback(data);
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
